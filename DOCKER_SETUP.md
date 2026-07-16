# Docker Setup Complete ✓

Your RATS++ bot is now fully configured for Docker deployment!

## What's Been Set Up

### 1. Environment Configuration
- ✓ `.env` file created with all necessary variables
- ✓ `.env.example` updated as a template
- ✓ Configuration reads from environment variables
- ✓ `.gitignore` properly excludes sensitive files

### 2. Docker Files
- ✓ `Dockerfile` - Multi-stage build for production
- ✓ `docker-compose.yml` - Standard Docker Compose deployment
- ✓ `portainer-stack.yml` - Alternative for Portainer deployments

### 3. Helper Scripts
- ✓ `docker-deploy.sh` - Automated deployment script
- ✓ `docker-validate.sh` - Pre-deployment validation
- ✓ All scripts are executable

### 4. Data Persistence
All bot data will be stored in mounted volumes:
- `credentials/` - Rust+ authentication
- `instances/` - Discord server configurations  
- `database/` - Bot database
- `logs/` - Application logs
- `maps/` - Map images

These directories will be created automatically and persist across container restarts.

## Next Steps

### 1. Add Your Discord Credentials

Edit the `.env` file and add your Discord bot credentials:

```bash
nano .env
```

Required fields:
- `RPP_DISCORD_TOKEN` - Your Discord bot token
- `RPP_DISCORD_CLIENT_ID` - Your Discord application client ID

Get these from: https://discord.com/developers/applications

### 2. Validate Your Setup (Optional)

```bash
./docker-validate.sh
```

### 3. Deploy the Bot

```bash
# Option A: Using the automated script
./docker-deploy.sh
# Then select option 1

# Option B: Manual deployment  
docker compose up -d --build
```

### 4. Monitor the Bot

```bash
# View logs
docker compose logs -f

# Check status
docker compose ps
```

### 5. First-Time Configuration

Once running:
1. Invite bot to your Discord server
2. Use `/credentials` command to pair with Rust+
3. Configure settings via Discord commands or Web UI at http://localhost:3000

## Configuration Details

### Environment Variables

The bot reads all configuration from environment variables set in `.env`:

**Required:**
- `RPP_DISCORD_TOKEN` - Discord bot token
- `RPP_DISCORD_CLIENT_ID` - Discord client ID

**Optional (with defaults):**
- `RPP_DISCORD_USERNAME` - Bot display name (default: RATS++)
- `RPP_LANGUAGE` - Interface language (default: en)
- `RPP_POLLING_INTERVAL` - Rust+ polling interval in ms (default: 7000)
- `RPP_RECONNECT_INTERVAL` - Reconnection delay in ms (default: 15000)
- `RPP_WEBUI_ENABLED` - Enable web interface (default: true)
- `RPP_WEBUI_PORT` - Web UI port (default: 3000)
- `NODE_ENV` - Node environment (default: production)
- `TZ` - Timezone for logs (default: UTC)

### How It Works

1. **Environment Variables**: The bot reads from `process.env` variables
2. **Docker Compose**: Loads variables from `.env` file into container
3. **Configuration**: `config/index.js` reads the environment variables
4. **Data Storage**: Volumes mount local directories into container
5. **Persistence**: Data survives container restarts and rebuilds

### Updating Instance/Credentials Files

You can still manually edit files in:
- `instances/<guild_id>.json` - Discord server configurations
- `credentials/<guild_id>.json` - Rust+ authentication tokens

These files are stored on your host machine (not in the container) so they persist across deployments.

## Common Operations

### Start Bot
```bash
docker compose up -d
```

### Stop Bot
```bash
docker compose down
```

### Restart Bot
```bash
docker compose restart
```

### View Logs
```bash
docker compose logs -f
```

### Rebuild After Code Changes
```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

### Access Container Shell
```bash
docker compose exec rustplusbot sh
```

### Backup Data
```bash
tar -czf ratspp-backup-$(date +%Y%m%d).tar.gz credentials instances database
```

### Restore Data
```bash
tar -xzf ratspp-backup-YYYYMMDD.tar.gz
```

## Troubleshooting

### Bot Crashes or Won't Start
```bash
# Check logs for errors
docker compose logs

# Verify environment variables
docker compose config

# Check if credentials are valid
cat .env
```

### Cannot Access Web UI
- Ensure `RPP_WEBUI_ENABLED=true` in `.env`
- Check port 3000 is not blocked: `netstat -tuln | grep 3000`
- Try: http://localhost:3000 or http://127.0.0.1:3000

### Permission Errors
```bash
# Fix ownership of data directories
sudo chown -R 1001:1001 credentials instances database logs maps

# Or run container as your user (not recommended)
# Add to docker-compose.yml under rustplusbot service:
#   user: "$(id -u):$(id -g)"
```

### Port Already in Use
```bash
# Change the port in .env
RPP_WEBUI_PORT=3001

# Rebuild and restart
docker compose down
docker compose up -d
```

### Credentials Not Persisting
Ensure volumes are mounted correctly. Check:
```bash
docker compose config | grep volumes -A 10
```

Should show local directories mounted to /app paths.

## Production Deployment

For production use, consider:

1. **Use Docker volumes** instead of bind mounts:
   ```yaml
   volumes:
     - ratspp_credentials:/app/credentials
   ```

2. **Set up automated backups** with cron:
   ```bash
   0 2 * * * tar -czf /backups/ratspp-$(date +\%Y\%m\%d).tar.gz -C /path/to/bot credentials instances database
   ```

3. **Use a reverse proxy** for Web UI (nginx/Traefik)

4. **Enable container auto-restart**:
   ```yaml
   restart: unless-stopped
   ```

5. **Monitor with health checks** (already configured)

6. **Secure your .env file**:
   ```bash
   chmod 600 .env
   ```

## Reference Documentation

- [DOCKER_QUICKSTART.md](DOCKER_QUICKSTART.md) - Quick start guide
- [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md) - Detailed deployment guide  
- [README.md](README.md) - Main bot documentation
- [docs/commands.md](docs/commands.md) - Discord commands

## Support

- Your Repository: https://github.com/mtvProof/RATS-plusplus
- Original Project: https://github.com/FaiThiX/rustplusplus

---

**Note**: Your credentials and bot data remain on your local machine in the mounted directories. The container only runs the application code. You can safely rebuild or update the container without losing data.
