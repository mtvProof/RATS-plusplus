# Docker Deployment Guide for RATS++

This guide explains how to run RATS++ Discord Bot in a Docker container using either Docker Compose or Docker Stack/Swarm.

## Quick Start

### 1. Configure Environment Variables

Copy the example environment file and edit it with your values:

```bash
cp .env.example .env
nano .env  # or use your preferred editor
```

**Required values:**
- `RPP_DISCORD_TOKEN` - Your Discord bot token
- `RPP_DISCORD_CLIENT_ID` - Your Discord application client ID

### 2. Option A: Docker Compose (Recommended for single-host)

Build and start the bot:

```bash
docker-compose up -d --build
```

View logs:

```bash
docker-compose logs -f
```

Stop the bot:

```bash
docker-compose down
```

### 3. Option B: Docker Stack (For Swarm/Multi-host)

Build the image:

```bash
docker build -t ratspp-bot:latest .
```

Deploy the stack:

```bash
docker stack deploy -c docker-stack.yml ratspp
```

View service status:

```bash
docker stack services ratspp
docker service logs -f ratspp_rustplusbot
```

Remove the stack:

```bash
docker stack rm ratspp
```

## Environment Variables

All configuration is done through environment variables. See `.env.example` for a complete list.

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `RPP_DISCORD_TOKEN` | Discord bot token | `MTQ5MjMyNDU4M...` |
| `RPP_DISCORD_CLIENT_ID` | Discord application client ID | `1492324580394536960` |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `RPP_DISCORD_USERNAME` | `RATS++` | Bot display name |
| `RPP_LANGUAGE` | `en` | Bot language (en, es, fr, de, etc.) |
| `RPP_POLLING_INTERVAL` | `7000` | Rust+ API polling interval (ms) |
| `RPP_RECONNECT_INTERVAL` | `15000` | Reconnection delay after disconnect (ms) |
| `RPP_WEBUI_ENABLED` | `true` | Enable/disable Web UI |
| `RPP_WEBUI_PORT` | `3000` | Web UI port |
| `RPP_NEED_ADMIN_PRIVILEGES` | `true` | Require admin for sensitive operations |
| `NODE_ENV` | `production` | Node environment |
| `TZ` | `UTC` | Timezone for logs |

## Persistent Data

The following directories are mounted as volumes to persist data:

- `/app/credentials` - Rust+ account credentials
- `/app/instances` - Guild/server instance configurations
- `/app/database` - Bot database
- `/app/logs` - Application logs
- `/app/maps` - Generated map images

### Backing Up Data

Docker Compose (local directories):
```bash
tar -czf ratspp-backup-$(date +%Y%m%d).tar.gz \
  ./credentials ./instances ./database ./logs ./maps
```

Docker Swarm (named volumes):
```bash
# Backup all volumes
docker run --rm \
  -v ratspp_credentials:/data/credentials:ro \
  -v ratspp_instances:/data/instances:ro \
  -v ratspp_database:/data/database:ro \
  -v ratspp_logs:/data/logs:ro \
  -v ratspp_maps:/data/maps:ro \
  -v $(pwd):/backup \
  alpine tar -czf /backup/ratspp-backup-$(date +%Y%m%d).tar.gz -C /data .
```

## Web UI Access

If `RPP_WEBUI_ENABLED=true`, access the Web UI at:
- `http://localhost:3000` (Docker Compose)
- `http://<your-host>:3000` (Docker Stack)

## Troubleshooting

### Bot doesn't start

1. Check logs:
   ```bash
   docker-compose logs -f
   # or
   docker service logs -f ratspp_rustplusbot
   ```

2. Verify environment variables are set correctly:
   ```bash
   docker-compose config
   ```

3. Ensure Discord token and client ID are valid

### Bot disconnects frequently

- Increase `RPP_RECONNECT_INTERVAL` (default 15000ms)
- Check network connectivity
- Ensure host system has stable internet

### Permission errors

If using bind mounts (Docker Compose), ensure directories have correct permissions:

```bash
sudo chown -R 1001:1001 credentials instances database logs maps
```

### Memory issues

For Docker Stack, adjust resource limits in `docker-stack.yml`:

```yaml
resources:
  limits:
    memory: 2G  # Increase if needed
  reservations:
    memory: 512M
```

## Building for Production

### Multi-architecture builds

Build for multiple platforms:

```bash
docker buildx build --platform linux/amd64,linux/arm64 \
  -t ratspp-bot:latest \
  --push .
```

### Image optimization

The Dockerfile uses multi-stage builds to minimize image size:
- Builder stage: Compiles dependencies
- Production stage: Only runtime dependencies
- Final image size: ~300MB

## Security Best Practices

1. **Never commit `.env` file** - It contains secrets
2. **Use Docker secrets** for production (see `docker-stack.yml`)
3. **Run as non-root user** - Dockerfile creates `ratspp` user
4. **Keep image updated** - Regularly rebuild with latest base image
5. **Limit resources** - Set CPU/memory limits in stack file

## Docker Secrets (Advanced)

For enhanced security in Swarm mode, use Docker secrets:

```bash
# Create secrets
echo "your_discord_token" | docker secret create ratspp_discord_token -
echo "your_client_id" | docker secret create ratspp_discord_client_id -

# Update docker-stack.yml to use secrets
# Then deploy:
docker stack deploy -c docker-stack.yml ratspp
```

## Updating the Bot

### Docker Compose

```bash
git pull
docker-compose down
docker-compose up -d --build
```

### Docker Stack

```bash
git pull
docker build -t ratspp-bot:latest .
docker service update --image ratspp-bot:latest ratspp_rustplusbot
```

## Support

For issues, please check:
1. This guide's troubleshooting section
2. Main README.md
3. GitHub Issues: https://github.com/faithix/rustplusplus/issues
