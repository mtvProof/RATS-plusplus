# RATS++ Docker - Quick Reference Card

## Setup (First Time Only)

```bash
# 1. Edit environment variables
nano .env

# 2. Add your credentials
RPP_DISCORD_TOKEN=your_token_here
RPP_DISCORD_CLIENT_ID=your_client_id_here

# 3. Validate setup (optional)
./docker-validate.sh

# 4. Deploy
./docker-deploy.sh    # Select option 1
# OR
docker compose up -d --build
```

## Daily Operations

```bash
# Start bot
docker compose up -d

# Stop bot
docker compose down

# Restart bot
docker compose restart

# View logs (live)
docker compose logs -f

# Check status
docker compose ps
```

## Updates

```bash
# Update code
git pull
docker compose down
docker compose build
docker compose up -d

# Update config
nano .env
docker compose restart
```

## Troubleshooting

```bash
# View logs
docker compose logs

# Check config
cat .env

# Validate setup
./docker-validate.sh

# Rebuild from scratch
docker compose down
docker compose build --no-cache
docker compose up -d
```

## Backup

```bash
# Create backup
tar -czf backup-$(date +%Y%m%d).tar.gz credentials instances database

# Restore backup
tar -xzf backup-YYYYMMDD.tar.gz
```

## Important Files

| File | Purpose |
|------|---------|
| `.env` | Your configuration (EDIT THIS) |
| `credentials/` | Rust+ auth tokens (BACKUP THIS) |
| `instances/` | Server configs (BACKUP THIS) |
| `docker-compose.yml` | Docker config |

## Environment Variables

| Variable | Required | Default |
|----------|----------|---------|
| `RPP_DISCORD_TOKEN` | **YES** | - |
| `RPP_DISCORD_CLIENT_ID` | **YES** | - |
| `RPP_WEBUI_PORT` | No | 3000 |
| `RPP_LANGUAGE` | No | en |

## Web UI

- URL: http://localhost:3000
- Enable/disable: `RPP_WEBUI_ENABLED` in `.env`
- Change port: `RPP_WEBUI_PORT` in `.env`

## Data Locations

```
credentials/  → Rust+ tokens (persistent)
instances/    → Server configs (persistent)
database/     → Bot database (persistent)
logs/         → Application logs (can delete)
maps/         → Map images (can regenerate)
```

## Quick Help

```bash
# Get help
./docker-deploy.sh     # Interactive menu
./docker-validate.sh   # Check setup

# Read docs
cat DOCKER_QUICKSTART.md
cat DOCKER_COMPLETE_GUIDE.md
```

## Emergency Recovery

```bash
# Container won't start
docker compose logs
docker compose down
docker compose up

# Lost configuration
cp .env.example .env
nano .env

# Permission issues
sudo chown -R 1001:1001 credentials instances database logs maps
```

## First Time Setup in Discord

1. Invite bot to server
2. Run `/credentials` command
3. Follow pairing instructions
4. Configure via `/` commands or Web UI

---

**Quick Start:** Edit `.env` → Run `./docker-deploy.sh` → Select option 1 → Done!
