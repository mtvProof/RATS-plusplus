# Multi-stage build for smaller final image
FROM node:22-alpine AS builder

# Install build dependencies (Alpine uses apk instead of apt-get)
RUN apk add --no-cache python3 make g++ graphicsmagick

WORKDIR /app

# Copy only package files first for better layer caching
COPY package.json package-lock.json ./

# Use npm install instead of npm ci to handle lock file sync
RUN npm install --omit=dev

# Copy TypeScript config for build
COPY tsconfig.json ./

# Copy source code
COPY . .

# Production stage - smaller final image
FROM node:22-alpine

# Install only runtime dependencies
RUN apk add --no-cache graphicsmagick tini

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S ratspp && \
    adduser -S -D -H -u 1001 -h /app -s /sbin/nologin -G ratspp -g ratspp ratspp

# Copy installed node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application code
COPY --from=builder /app .

# Create volume directories and set proper permissions
RUN mkdir -p /app/credentials /app/instances /app/database /app/logs /app/maps && \
    chown -R ratspp:ratspp /app

# Use volumes for persistent data
VOLUME ["/app/credentials", "/app/instances", "/app/database", "/app/logs", "/app/maps"]

# Switch to non-root user
USER ratspp

# Expose Web UI port (default 3000)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "process.exit(0)" || exit 1

# Use tini as init system to handle signals properly
ENTRYPOINT ["/sbin/tini", "--"]

# Start the bot
CMD ["npm", "start"]
