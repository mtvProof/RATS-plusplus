# RATS++ Docker Deployment - Complete Guide

## Overview

Your RATS++ Discord bot is now fully configured to run in Docker containers. All configuration is handled through environment variables in a `.env` file, and all data persists in mounted volumes.

## Architecture

```
RATS++ Bot (Docker Container)
├── Application Code (in container)
├── Environment Variables (from .env)
└── Data Volumes (on host machine)
    ├── credentials/  - Rust+ authentication
    ├── instances/    - Discord server configs
    ├── database/     - Bot database
    ├── logs/         - Application logs
    └── maps/         - Map cache
```

## Quick Start (5 Minutes)

### 1. Configure Credentials

Edit `.env` and add your Discord bot credentials:

```bash
nano .env
```

Required fields:
```env
RPP_DISCORD_TOKEN=YOUR_ACTUAL_TOKEN_HERE
RPP_DISCORD_CLIENT_ID=YOUR_ACTUAL_CLIENT_ID_HERE
```

Get these from: https://discord.com/developers/applications

### 2. Validate Setup (Optional)

```bash
./docker-validate.sh
```

### 3. Deploy

```bash
./docker-deploy.sh
# Select option 1: Build and start the bot
```

Or manually:
```bash
docker compose up -d --build
```

### 4. Verify Running

```bash
# Check container status
docker compose ps

# View logs
docker compose logs -f
```

### 5. Configure Bot

1. Invite bot to Discord server
2. Use `/credentials` command in Discord to pair with Rust+
3. Access Web UI at http://localhost:3000

## Configuration Files

### `.env` - Main Configuration

All bot settings are configured through environment variables:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RPP_DISCORD_TOKEN` | ✓ Yes | - | Discord bot token |
| `RPP_DISCORD_CLIENT_ID` | ✓ Yes | - | Discord application client ID |
| `RPP_DISCORD_USERNAME` | No | RATS++ | Bot display name |
| `RPP_LANGUAGE` | No | en | UI language |
| `RPP_POLLING_INTERVAL` | No | 7000 | Rust+ poll interval (ms) |
| `RPP_RECONNECT_INTERVAL` | No | 15000 | Reconnect delay (ms) |
| `RPP_WEBUI_ENABLED` | No | true | Enable web interface |
| `RPP_WEBUI_PORT` | No | 3000 | Web UI port |
| `NODE_ENV` | No | production | Node environment |
| `TZ` | No | UTC | Timezone |

### `docker-compose.yml` - Standard Deployment

Used for local development and deployment with Docker Compose.

Features:
- Builds from local source code
- Mounts local directories for data persistence
- Loads environment from `.env` file
- Exposes Web UI on configurable port
- Includes health checks

### `portainer-stack.yml` - Portainer Deployment

Alternative deployment for Portainer or Docker Swarm.

Features:
- Uses pre-built image
- Named volumes for data persistence
- Environment variable configuration
- Suitable for production deployments

### `Dockerfile` - Container Build

Multi-stage build for production:
- Builder stage: Installs dependencies and builds
- Production stage: Minimal runtime image
- Non-root user for security
- Health checks included
- Optimized for Alpine Linux

## Data Persistence

### How It Works

Your bot data is stored in directories on your host machine, not in the container:

```
Host Machine               Docker Container
├── credentials/      →    /app/credentials
├── instances/        →    /app/instances  
├── database/         →    /app/database
├── logs/             →    /app/logs
└── maps/             →    /app/maps
```

**Important**: The container only runs the application. Your data remains on your machine and persists across:
- Container restarts
- Container rebuilds
- Container removals
- Code updates

### Instance Configuration

Each Discord server gets a configuration file:
- Location: `instances/<discord_guild_id>.json`
- Contains: Server settings, smart devices, notifications, etc.
- Editable: Yes, can be manually edited while bot is stopped

### Credentials Storage

Rust+ authentication for each paired account:
- Location: `credentials/<discord_guild_id>.json`
- Contains: Steam IDs, FCM tokens, Discord user mappings
- Sensitive: Yes, keep secure and backed up

## Common Operations

### Starting the Bot

```bash
# Using helper script
./docker-deploy.sh  # Select option 2

# Manually
docker compose up -d
```

### Stopping the Bot

```bash
# Using helper script  
./docker-deploy.sh  # Select option 3

# Manually
docker compose down
```

### Viewing Logs

```bash
# Real-time logs (Ctrl+C to exit)
docker compose logs -f

# Last 100 lines
docker compose logs --tail=100

# Specific service
docker compose logs rustplusbot
```

### Updating Code

```bash
# Pull latest changes
git pull

# Rebuild and restart
docker compose down
docker compose build --no-cache
docker compose up -d
```

### Changing Configuration

```bash
# 1. Edit .env
nano .env

# 2. Restart to apply changes
docker compose restart
```

### Accessing Container

```bash
# Open shell in running container
docker compose exec rustplusbot sh

# Inside container
cd /app
ls -la
cat logs/discordBot.log
exit
```

### Backing Up Data

```bash
# Create backup
tar -czf ratspp-backup-$(date +%Y%m%d).tar.gz \
  credentials instances database

# Restore from backup
tar -xzf ratspp-backup-20260629.tar.gz
```

## Troubleshooting

### Bot Won't Start

**Check logs:**
```bash
docker compose logs
```

**Common issues:**
- Invalid Discord token → Update `RPP_DISCORD_TOKEN` in `.env`
- Invalid client ID → Update `RPP_DISCORD_CLIENT_ID` in `.env`
- Port 3000 in use → Change `RPP_WEBUI_PORT` in `.env`

### Bot Disconnects Frequently

**Check:**
```bash
docker compose logs | grep -i error
```

**Common causes:**
- Network issues → Check Docker network
- Invalid Rust+ credentials → Re-pair using `/credentials`
- Server wipe → Update server info in bot

### Web UI Not Accessible

**Verify:**
```bash
# Check container is running
docker compose ps

# Check port mapping
docker compose port rustplusbot 3000

# Check if port is listening
netstat -tuln | grep 3000
```

**Try:**
- http://localhost:3000
- http://127.0.0.1:3000
- http://YOUR_SERVER_IP:3000

### Permission Errors

**Fix ownership:**
```bash
sudo chown -R 1001:1001 credentials instances database logs maps
```

Or run as your user (add to `docker-compose.yml`):
```yaml
services:
  rustplusbot:
    user: "${UID:-1000}:${GID:-1000}"
```

### Container Keeps Restarting

**Check:**
```bash
# View recent logs
docker compose logs --tail=50

# Disable auto-restart temporarily
docker compose up --no-start
docker compose start
```

## Production Deployment

### Security Checklist

- [ ] Secure `.env` file permissions: `chmod 600 .env`
- [ ] Use strong, unique Discord bot token
- [ ] Enable firewall on host machine
- [ ] Use reverse proxy for Web UI (nginx/Traefik)
- [ ] Regular backups configured
- [ ] Monitor disk space for logs
- [ ] Update Docker images regularly

### Performance Optimization

**Resource Limits** (add to `docker-compose.yml`):
```yaml
services:
  rustplusbot:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
```

**Log Rotation** (already configured):
```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

### Automated Backups

Create cron job:
```bash
crontab -e
```

Add:
```cron
# Daily backup at 2 AM
0 2 * * * cd /path/to/RATS-plusplus && tar -czf /backups/ratspp-$(date +\%Y\%m\%d).tar.gz credentials instances database

# Weekly cleanup (keep 30 days)
0 3 * * 0 find /backups -name "ratspp-*.tar.gz" -mtime +30 -delete
```

### Monitoring

**Health Check** (already configured):
```yaml
healthcheck:
  test: ["CMD", "node", "-e", "process.exit(0)"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

**Monitor with:**
```bash
# Check health status
docker compose ps

# Monitor resources
docker stats rustplusbot

# Check logs for errors
docker compose logs | grep -i error
```

### Reverse Proxy (Nginx Example)

```nginx
server {
    listen 80;
    server_name bot.example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Migration from Non-Docker

If you're migrating from a non-Docker installation:

### 1. Backup Existing Data

```bash
# Copy existing data to new location
cp -r /old/path/credentials ./credentials
cp -r /old/path/instances ./instances
cp -r /old/path/database ./database
```

### 2. Configure Environment

Create `.env` from your old config:
```bash
# Extract values from old config files
# and add to .env
```

### 3. Test

```bash
# Start in foreground to watch logs
docker compose up

# If everything works, run in background
docker compose down
docker compose up -d
```

## Helper Scripts

### `docker-deploy.sh`

Interactive deployment script with options:
1. Build and start
2. Start (already built)
3. Stop
4. Restart
5. View logs
6. Rebuild and restart
7. Remove all

### `docker-validate.sh`

Pre-deployment validation:
- Checks Docker installation
- Validates `.env` configuration
- Verifies required files exist
- Checks port availability

## Support & Documentation

- [DOCKER_QUICKSTART.md](DOCKER_QUICKSTART.md) - Quick start guide
- [DOCKER_SETUP.md](DOCKER_SETUP.md) - Setup details
- [README.md](README.md) - Main documentation
- [docs/commands.md](docs/commands.md) - Bot commands

## Additional Resources

- Docker Documentation: https://docs.docker.com
- Docker Compose: https://docs.docker.com/compose
- Original Project: https://github.com/FaiThiX/rustplusplus
- Your Repository: https://github.com/mtvProof/RATS-plusplus

---

**Remember**: Your bot data (credentials, instances, database) is stored on your host machine in the mounted directories. The Docker container only runs the application code. You can safely rebuild or update containers without losing data.
