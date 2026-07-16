# Docker Containerization - Summary of Changes

## What Was Done

Your RATS++ bot has been fully configured for Docker deployment with environment variable configuration. Here's what was set up:

## Files Created/Modified

### Created Files:
1. **`.env`** - Main configuration file for environment variables
2. **`docker-validate.sh`** - Pre-deployment validation script
3. **`DOCKER_SETUP.md`** - Complete setup documentation
4. **`DOCKER_COMPLETE_GUIDE.md`** - Comprehensive deployment guide

### Modified Files:
1. **`docker-compose.yml`** - Updated to use `.env` file for configuration
2. **`portainer-stack.yml`** - Updated environment variable names
3. **`DOCKER_QUICKSTART.md`** - Enhanced quick start guide

### Existing Files (Already Configured):
- `Dockerfile` - Multi-stage build for production (✓ already good)
- `config/index.js` - Already reads from environment variables (✓ already good)
- `.env.example` - Template for environment configuration (✓ already good)
- `.gitignore` - Properly excludes sensitive files (✓ already good)
- `docker-deploy.sh` - Automated deployment script (✓ already good)

## Key Features

### 1. Environment Variable Configuration

All bot settings are now configured through the `.env` file:

**Required:**
- `RPP_DISCORD_TOKEN` - Your Discord bot token
- `RPP_DISCORD_CLIENT_ID` - Your Discord client ID

**Optional (with sensible defaults):**
- `RPP_DISCORD_USERNAME` - Bot name (default: RATS++)
- `RPP_LANGUAGE` - UI language (default: en)
- `RPP_POLLING_INTERVAL` - Rust+ polling (default: 7000ms)
- `RPP_RECONNECT_INTERVAL` - Reconnection delay (default: 15000ms)
- `RPP_WEBUI_ENABLED` - Web UI toggle (default: true)
- `RPP_WEBUI_PORT` - Web UI port (default: 3000)
- `NODE_ENV` - Environment (default: production)
- `TZ` - Timezone (default: UTC)

### 2. Data Persistence

All bot data persists on your host machine in mounted volumes:

```
credentials/  → Rust+ authentication tokens
instances/    → Discord server configurations
database/     → Bot database
logs/         → Application logs
maps/         → Generated map images
```

**Important:** The container is stateless - all your data lives outside the container!

### 3. Docker Deployment Options

#### Option A: Docker Compose (Recommended)
```bash
# Configure
nano .env

# Deploy
docker compose up -d --build

# Monitor
docker compose logs -f
```

#### Option B: Using Helper Scripts
```bash
# Validate setup
./docker-validate.sh

# Deploy
./docker-deploy.sh  # Select option 1
```

#### Option C: Portainer
Use `portainer-stack.yml` in Portainer UI

## How It Works

### Configuration Flow

```
1. You edit .env file
   ↓
2. Docker Compose loads .env
   ↓
3. Environment variables set in container
   ↓
4. config/index.js reads process.env
   ↓
5. Bot uses configuration
```

### Data Flow

```
Host Machine                  Docker Container
├── credentials/         →    /app/credentials
├── instances/           →    /app/instances
├── database/            →    /app/database
├── logs/                →    /app/logs
└── maps/                →    /app/maps
```

## Getting Started

### Step 1: Configure Environment

Edit `.env` file:
```bash
nano .env
```

Add your credentials:
```env
RPP_DISCORD_TOKEN=your_actual_token_here
RPP_DISCORD_CLIENT_ID=your_actual_client_id_here
```

### Step 2: Validate (Optional)

```bash
./docker-validate.sh
```

This checks:
- Docker is installed
- Environment variables are set
- Required files exist
- Ports are available

### Step 3: Deploy

```bash
# Using helper script
./docker-deploy.sh
# Select: 1 (Build and start)

# Or manually
docker compose up -d --build
```

### Step 4: Monitor

```bash
# View logs
docker compose logs -f

# Check status
docker compose ps

# Access Web UI
# Open http://localhost:3000
```

### Step 5: Configure Bot

1. Invite bot to your Discord server
2. Run `/credentials` command in Discord
3. Follow pairing process for Rust+
4. Configure via Discord commands or Web UI

## Managing the Bot

### Common Commands

```bash
# Start
docker compose up -d

# Stop
docker compose down

# Restart
docker compose restart

# View logs
docker compose logs -f

# Rebuild after code changes
docker compose down
docker compose build --no-cache
docker compose up -d

# Access container shell
docker compose exec rustplusbot sh
```

### Updating Configuration

1. Edit `.env` file
2. Restart container: `docker compose restart`

### Updating Code

```bash
# Pull latest code
git pull

# Rebuild and restart
docker compose down
docker compose build
docker compose up -d
```

## Data Management

### Your Data Location

All data is in these directories on your host:
- `credentials/` - Don't lose this! Contains authentication
- `instances/` - Server-specific configurations
- `database/` - Bot database
- `logs/` - Can be deleted safely
- `maps/` - Can be regenerated

### Backups

```bash
# Create backup
tar -czf backup-$(date +%Y%m%d).tar.gz \
  credentials instances database

# Restore backup
tar -xzf backup-20260629.tar.gz
```

### Manual File Editing

You can still manually edit:
- `instances/<guild_id>.json` - Server settings
- `credentials/<guild_id>.json` - Rust+ tokens

**Note:** Stop the bot before editing these files!

## Troubleshooting

### Bot Won't Start

```bash
# Check logs
docker compose logs

# Common issues:
# - Invalid token → Fix RPP_DISCORD_TOKEN in .env
# - Invalid client ID → Fix RPP_DISCORD_CLIENT_ID in .env
# - Port in use → Change RPP_WEBUI_PORT in .env
```

### Can't Access Web UI

```bash
# Verify container is running
docker compose ps

# Check port mapping
docker compose port rustplusbot 3000

# Try different URLs
# http://localhost:3000
# http://127.0.0.1:3000
```

### Permission Issues

```bash
# Fix ownership
sudo chown -R 1001:1001 credentials instances database logs maps
```

### Bot Disconnects

- Check credentials are valid
- Re-pair using `/credentials` if needed
- Check network connectivity

## What Stays the Same

### Bot Functionality
- All Discord commands work the same
- All Rust+ features work the same
- Web UI works the same
- Pairing process is identical

### File Structure
- `credentials/` - Same format
- `instances/` - Same format
- `database/` - Same format

### Bot Behavior
- No code changes affecting functionality
- Same reconnection logic
- Same polling intervals (unless you change them in .env)

## What's Different

### Configuration Method
- **Before:** Hardcoded or manual config files
- **Now:** Environment variables in `.env` file

### Deployment
- **Before:** Direct Node.js execution
- **Now:** Docker containerized

### Portability
- **Before:** System-dependent
- **Now:** Runs anywhere with Docker

### Updates
- **Before:** Pull code, restart process
- **Now:** Pull code, rebuild container

## Documentation

Read these guides in order:

1. **[DOCKER_QUICKSTART.md](DOCKER_QUICKSTART.md)** - Get started in 5 minutes
2. **[DOCKER_SETUP.md](DOCKER_SETUP.md)** - Detailed setup information
3. **[DOCKER_COMPLETE_GUIDE.md](DOCKER_COMPLETE_GUIDE.md)** - Comprehensive reference

## Next Steps

1. **Configure `.env` file** with your Discord credentials
2. **Run validation:** `./docker-validate.sh`
3. **Deploy:** `./docker-deploy.sh` (option 1)
4. **Monitor:** `docker compose logs -f`
5. **Configure bot** via Discord commands

## Important Notes

### Security
- `.env` file is in `.gitignore` - never commit it!
- `credentials/` is gitignored - keep it secure
- `instances/` is gitignored - contains server data

### Data Safety
- Your data is NOT in the container
- Your data is on your host machine
- Removing containers does NOT delete your data
- Always backup `credentials/` and `instances/`

### Git Status
The following files will show as modified/new:
- Modified: `docker-compose.yml`, `portainer-stack.yml`, `DOCKER_QUICKSTART.md`
- New: `.env`, `docker-validate.sh`, `DOCKER_SETUP.md`, `DOCKER_COMPLETE_GUIDE.md`

**Note:** `.env` won't be committed (it's in `.gitignore`)

## Support

If you encounter issues:
1. Check logs: `docker compose logs`
2. Validate setup: `./docker-validate.sh`
3. Review documentation in `DOCKER_*.md` files
4. Check original repo: https://github.com/FaiThiX/rustplusplus

---

**You're all set!** Your bot is ready to run in Docker with full environment variable configuration. All your existing credentials and instance configurations will work without changes.
