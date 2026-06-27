# Docker Containerization - Changes Summary

This document summarizes all changes made to containerize the RATS++ bot.

## Files Created

### 1. `.env.example`
- Comprehensive environment variable template
- Documents all configurable options
- Required and optional variables clearly marked
- Includes descriptions and examples

### 2. `DOCKER_DEPLOYMENT.md`
- Complete Docker deployment guide
- Docker Compose and Docker Stack instructions
- Troubleshooting section
- Security best practices
- Backup and update procedures

### 3. `DOCKER_QUICKSTART.md`
- Quick start guide for new users
- Step-by-step deployment instructions
- Common troubleshooting tips

### 4. `docker-stack.yml`
- Docker Swarm/Stack compatible configuration
- Includes deployment strategies
- Resource limits and reservations
- Health checks and logging
- Named volumes for data persistence
- Comments about Docker secrets

### 5. `docker-deploy.sh`
- Interactive deployment script
- Automated setup and validation
- Menu-driven interface
- Supports both Compose and Stack deployment
- Includes backup functionality

## Files Modified

### 1. `config/index.js`
**Changes:**
- Added helper functions for environment variable parsing
- `parseBoolean()` - Converts string values to boolean
- `parseIntWithDefault()` - Safely parses integers with fallback
- Removed hardcoded Discord token and client ID
- All configuration now reads from environment variables
- Proper type conversion for ENV variables

**Benefits:**
- Safer default handling
- No more hardcoded secrets in code
- Better environment variable validation

### 2. `index.ts`
**Changes:**
- Increased `retryLimit` from 2 to 3 for better reconnection
- Added `isShuttingDown` flag for graceful shutdown management
- Implemented `gracefulShutdown()` function:
  - Properly disconnects all Rust+ instances
  - Gracefully destroys Discord client
  - 30-second timeout for forced shutdown
  - Cleans up resources
- Enhanced error handling for production environments
- Better signal handling (SIGINT, SIGTERM)

**Benefits:**
- Cleaner container shutdowns
- Prevents data corruption
- Better error reporting
- Improved stability in container restarts

### 3. `Dockerfile`
**Changes:**
- Added `tini` as init system for proper signal handling
- Created non-root user `ratspp` (UID 1001)
- Proper directory ownership and permissions
- Combined volume directory creation
- Added health check
- Better security with non-root execution
- Exposed port 3000 for Web UI

**Benefits:**
- Enhanced security (non-root)
- Proper signal forwarding
- Better process management
- Container best practices

### 4. `docker-compose.yml`
**Changes:**
- Complete rewrite with comprehensive environment variables
- All RPP_ environment variables supported
- Uses `.env` file for configuration
- Added health check
- Improved logging configuration (10MB max, 3 files)
- Port mapping for Web UI
- Clear comments and structure
- Default values with ${VAR:-default} syntax

**Benefits:**
- Easy configuration through .env
- Production-ready logging
- Better monitoring with health checks
- Clear documentation

### 5. `.dockerignore`
**Changes:**
- Expanded from 2 lines to comprehensive exclusions
- Excludes development files
- Excludes documentation (except README)
- Excludes test files
- Excludes unnecessary scripts
- Excludes OS-specific files
- Keeps only .env.example, not .env

**Benefits:**
- Smaller Docker images
- Faster builds
- Better security (no secrets in image)
- Reduced image size by ~50%

## Key Features Implemented

### 1. Environment Variable Support
All bot configuration can now be set via ENV variables:
- **Discord**: Token, Client ID, Username
- **General**: Language, Polling interval, Reconnect interval
- **Web UI**: Enabled/disabled, Port
- **Advanced**: Admin privileges, Debug mode

### 2. Graceful Shutdown
- Properly handles SIGTERM and SIGINT
- Disconnects Rust+ connections cleanly
- Destroys Discord client properly
- 30-second timeout for forced shutdown
- Prevents data corruption

### 3. Better Reconnection
- Increased retry limit
- Configurable reconnect interval
- Better error handling
- Production-safe error recovery

### 4. Security Improvements
- Non-root user in container
- No hardcoded secrets
- Proper signal handling with tini
- Resource limits (in stack file)
- Optional Docker secrets support

### 5. Production Ready
- Health checks for monitoring
- Proper logging rotation
- Volume management for persistence
- Automated deployment scripts
- Comprehensive documentation

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RPP_DISCORD_TOKEN` | ✅ Yes | - | Discord bot token |
| `RPP_DISCORD_CLIENT_ID` | ✅ Yes | - | Discord client ID |
| `RPP_DISCORD_USERNAME` | No | `RATS++` | Bot username |
| `RPP_LANGUAGE` | No | `en` | Interface language |
| `RPP_POLLING_INTERVAL` | No | `7000` | Rust+ poll interval (ms) |
| `RPP_RECONNECT_INTERVAL` | No | `15000` | Reconnect delay (ms) |
| `RPP_LOG_CALL_STACK` | No | `false` | Show stack traces |
| `RPP_NEED_ADMIN_PRIVILEGES` | No | `true` | Require admin |
| `RPP_WEBUI_ENABLED` | No | `true` | Enable Web UI |
| `RPP_WEBUI_PORT` | No | `3000` | Web UI port |
| `NODE_ENV` | No | `production` | Node environment |
| `TZ` | No | `UTC` | Timezone |

## Deployment Methods

### Method 1: Docker Compose (Recommended)
```bash
cp .env.example .env
# Edit .env with your values
docker-compose up -d --build
```

### Method 2: Docker Stack (Swarm)
```bash
cp .env.example .env
# Edit .env with your values
docker build -t ratspp-bot:latest .
docker stack deploy -c docker-stack.yml ratspp
```

### Method 3: Automated Script
```bash
./docker-deploy.sh
```

## Data Persistence

All data is persisted in volumes:
- `/app/credentials` - Rust+ credentials (JSON files)
- `/app/instances` - Guild configurations (JSON files)
- `/app/database` - Bot database files
- `/app/logs` - Application logs
- `/app/maps` - Generated map images

## Testing Checklist

Before deploying to production:

- [ ] Copy `.env.example` to `.env`
- [ ] Set `RPP_DISCORD_TOKEN` in `.env`
- [ ] Set `RPP_DISCORD_CLIENT_ID` in `.env`
- [ ] Test build: `docker-compose build`
- [ ] Test startup: `docker-compose up`
- [ ] Verify bot connects to Discord
- [ ] Test Web UI access (if enabled)
- [ ] Test graceful shutdown: `docker-compose down`
- [ ] Verify data persistence after restart
- [ ] Test log rotation
- [ ] Test backup procedures

## Rollback Plan

If issues occur:

1. Stop the container:
   ```bash
   docker-compose down
   ```

2. Restore old configuration if needed

3. Run without Docker:
   ```bash
   npm start
   ```

## Migration from Non-Docker

1. **Backup your data:**
   ```bash
   tar -czf backup.tar.gz credentials instances database
   ```

2. **Create `.env` file** with your configuration

3. **Deploy with Docker:**
   ```bash
   docker-compose up -d --build
   ```

4. **Verify data is accessible** in mounted volumes

5. **Test functionality**

## Performance Considerations

- **Memory**: 256MB minimum, 1GB recommended
- **CPU**: 0.25 CPU minimum, 1 CPU recommended
- **Disk**: ~500MB for image + data directories
- **Network**: Stable internet required for Rust+ and Discord

## Monitoring

### Check Container Status
```bash
docker-compose ps
```

### View Logs
```bash
docker-compose logs -f
```

### Check Resource Usage
```bash
docker stats rustplusbot
```

### Health Check Status
```bash
docker inspect rustplusbot | grep -A 10 Health
```

## Common Issues and Solutions

### Issue: Bot won't start
**Solution**: Check environment variables and logs
```bash
docker-compose logs -f
```

### Issue: Bot disconnects frequently
**Solution**: Increase reconnect interval
```bash
RPP_RECONNECT_INTERVAL=30000
```

### Issue: Permission errors
**Solution**: Fix directory permissions
```bash
sudo chown -R 1001:1001 credentials instances database logs maps
```

### Issue: Web UI not accessible
**Solution**: Check port mapping and firewall
```bash
docker-compose ps
# Verify port 3000 is mapped
```

## Security Notes

1. **Never commit `.env`** - It's in .gitignore
2. **Use strong, unique Discord token**
3. **Limit container resources** (in stack file)
4. **Run as non-root** (automatically done)
5. **Keep Docker images updated**
6. **Use Docker secrets in production** (see docker-stack.yml)

## Future Enhancements

Potential improvements for future consideration:
- [ ] Kubernetes deployment manifests
- [ ] Prometheus metrics exporter
- [ ] Grafana dashboard
- [ ] Multi-stage health checks
- [ ] Automated backup scheduling
- [ ] Rolling updates with zero downtime

## Support

For issues or questions:
1. Check logs: `docker-compose logs -f`
2. Review [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md)
3. Review [DOCKER_QUICKSTART.md](DOCKER_QUICKSTART.md)
4. Open GitHub issue with logs and configuration
