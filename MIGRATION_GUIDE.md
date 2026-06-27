# 🚀 RATS++ Migration Guide: Raspberry Pi → MiniPC

## Overview

This guide walks you through migrating your RATS++ bot from your Raspberry Pi to your MiniPC homelab while **preserving all your data** (credentials, instances, database).

## 🎯 Your Data Will Persist

When running on your MiniPC with Docker Stack, your data is stored in **Docker named volumes** which:
- ✅ Persist across stack redeployments (e.g., code updates)
- ✅ Persist across container restarts
- ✅ Only deleted if you explicitly remove them
- ✅ Survive `docker stack rm ratspp` commands

## 📋 Migration Process

### Step 1: On Raspberry Pi - Export Your Data

```bash
cd ~/Desktop/RATS-plusplus

# Create backup of all your data
./migrate-data.sh export
```

This creates a file like `ratspp-migration-20260627-143022.tar.gz` containing:
- `credentials/` - All your Rust+ credentials
- `instances/` - All your bot configurations
- `database/` - Bot database
- `.env` - Your environment variables (if exists)

### Step 2: Transfer to MiniPC

Transfer the backup file to your MiniPC:

```bash
# Option 1: SCP (if you have SSH access)
scp ratspp-migration-*.tar.gz user@minipc-ip:/home/user/

# Option 2: USB drive
# Copy file to USB, then mount on MiniPC

# Option 3: Network share
# Copy to shared folder accessible from MiniPC
```

### Step 3: On MiniPC - Setup

```bash
# Clone your repository on MiniPC
cd ~
git clone https://github.com/yourusername/rustplusplus RATS-plusplus
cd RATS-plusplus

# Copy the migration backup here
# (if you used SCP, it's already there)
```

### Step 4: On MiniPC - Import Data

```bash
# Import your data
./migrate-data.sh import

# This will extract:
# - credentials/
# - instances/
# - database/
# - .env
```

### Step 5: On MiniPC - Configure & Deploy

```bash
# 1. Verify your .env file
cat .env
# Make sure RPP_DISCORD_TOKEN and RPP_DISCORD_CLIENT_ID are set

# 2. Test configuration
./docker-test.sh

# 3. Build your image
docker build -t mtvproof-ratspp:latest .

# 4. Initialize Docker Swarm (if not already done)
docker swarm init

# 5. Deploy the stack
docker stack deploy -c docker-stack.yml ratspp
```

## 🔒 Data Persistence on MiniPC

### How Docker Stack Volumes Work

When you deploy with Docker Stack, data is stored in **named volumes**:

```yaml
volumes:
  ratspp_credentials:/app/credentials
  ratspp_instances:/app/instances
  ratspp_database:/app/database
  ratspp_logs:/app/logs
  ratspp_maps:/app/maps
```

**What this means:**
- Docker creates volumes named `ratspp_credentials`, `ratspp_instances`, etc.
- Data is stored in Docker's volume storage (usually `/var/lib/docker/volumes/`)
- These volumes persist even when you remove the stack

### Redeploying After Code Updates

```bash
# 1. Pull your latest code
cd ~/RATS-plusplus
git pull

# 2. Rebuild the image
docker build -t mtvproof-ratspp:latest .

# 3. Update the stack (seamless - no data loss!)
docker stack deploy -c docker-stack.yml ratspp

# OR rolling update:
docker service update --image mtvproof-ratspp:latest ratspp_rustplusbot
```

**Your data is NEVER touched** during these operations!

### Verifying Data Persistence

```bash
# List volumes
docker volume ls | grep ratspp

# Output should show:
# local     ratspp_credentials
# local     ratspp_database
# local     ratspp_instances
# local     ratspp_logs
# local     ratspp_maps

# Inspect a volume
docker volume inspect ratspp_credentials

# View files in a volume
docker run --rm -v ratspp_credentials:/data:ro alpine ls -la /data
```

## 🔄 Common Operations on MiniPC

### View Stack Status
```bash
docker stack services ratspp
docker stack ps ratspp
```

### View Logs
```bash
docker service logs -f ratspp_rustplusbot
```

### Update After Code Changes
```bash
# Safe - preserves all data!
git pull
docker build -t mtvproof-ratspp:latest .
docker service update --image mtvproof-ratspp:latest ratspp_rustplusbot
```

### Remove Stack (data persists!)
```bash
# This STOPS the bot but keeps all your data
docker stack rm ratspp

# Volumes remain! Check with:
docker volume ls | grep ratspp
```

### Completely Remove Everything (including data)
```bash
# WARNING: This deletes EVERYTHING!
docker stack rm ratspp
sleep 10  # Wait for stack to fully remove
docker volume rm ratspp_credentials ratspp_instances ratspp_database ratspp_logs ratspp_maps
```

## 💾 Backing Up Data on MiniPC

### Option 1: Volume Backup (Recommended)

```bash
# Backup all volumes to a single archive
docker run --rm \
  -v ratspp_credentials:/data/credentials:ro \
  -v ratspp_instances:/data/instances:ro \
  -v ratspp_database:/data/database:ro \
  -v ratspp_logs:/data/logs:ro \
  -v ratspp_maps:/data/maps:ro \
  -v $(pwd):/backup \
  alpine tar -czf /backup/ratspp-backup-$(date +%Y%m%d).tar.gz -C /data .
```

### Option 2: Individual Volume Backups

```bash
# Backup just credentials
docker run --rm \
  -v ratspp_credentials:/data:ro \
  -v $(pwd):/backup \
  alpine tar -czf /backup/credentials-backup.tar.gz -C /data .

# Backup just instances
docker run --rm \
  -v ratspp_instances:/data:ro \
  -v $(pwd):/backup \
  alpine tar -czf /backup/instances-backup.tar.gz -C /data .
```

### Restore from Backup

```bash
# Restore credentials
docker run --rm \
  -v ratspp_credentials:/data \
  -v $(pwd):/backup \
  alpine tar -xzf /backup/credentials-backup.tar.gz -C /data

# Restart the service to pick up changes
docker service update --force ratspp_rustplusbot
```

## 📊 Verification Checklist

After migration and deployment on MiniPC:

- [ ] Bot appears online in Discord
- [ ] Check logs: `docker service logs -f ratspp_rustplusbot`
- [ ] Verify credentials loaded: Check logs for "Loading credentials..."
- [ ] Verify instances loaded: Check logs for guild/server connections
- [ ] Test a bot command in Discord
- [ ] Check Web UI (if enabled): `http://minipc-ip:3000`
- [ ] Verify data volumes exist: `docker volume ls | grep ratspp`

## 🆘 Troubleshooting

### Bot doesn't start
```bash
# Check service status
docker service ps ratspp_rustplusbot

# Check logs
docker service logs ratspp_rustplusbot

# Common issues:
# - Check .env file has correct values
# - Verify image was built: docker images | grep mtvproof-ratspp
# - Check volume permissions
```

### Data not showing up
```bash
# Verify volumes are mounted
docker service inspect ratspp_rustplusbot | grep -A10 Mounts

# Check volume contents
docker run --rm -v ratspp_credentials:/data:ro alpine ls -la /data
docker run --rm -v ratspp_instances:/data:ro alpine ls -la /data
```

### Need to re-import data
```bash
# Stop the stack
docker stack rm ratspp

# Remove volumes
docker volume rm ratspp_credentials ratspp_instances ratspp_database

# Re-import
./migrate-data.sh import

# Redeploy
docker stack deploy -c docker-stack.yml ratspp
```

## 🎯 Quick Reference

### Migration Commands
```bash
# On Raspberry Pi
./migrate-data.sh export
scp ratspp-migration-*.tar.gz user@minipc:/path/

# On MiniPC
./migrate-data.sh import
docker build -t mtvproof-ratspp:latest .
docker stack deploy -c docker-stack.yml ratspp
```

### Update Workflow (After Code Changes)
```bash
git pull
docker build -t mtvproof-ratspp:latest .
docker service update --image mtvproof-ratspp:latest ratspp_rustplusbot
```

### Backup Workflow
```bash
# Create backup
docker run --rm -v ratspp_credentials:/data/credentials:ro \
  -v ratspp_instances:/data/instances:ro \
  -v ratspp_database:/data/database:ro \
  -v $(pwd):/backup alpine \
  tar -czf /backup/backup-$(date +%Y%m%d).tar.gz -C /data .
```

## ✅ Summary

**Your data WILL persist** across:
- ✅ Stack redeployments (`docker stack deploy`)
- ✅ Service updates (`docker service update`)
- ✅ Code updates (git pull + rebuild)
- ✅ Container restarts
- ✅ System reboots (with Docker configured to start on boot)

**Your data will ONLY be lost if:**
- ❌ You explicitly run `docker volume rm ratspp_*`
- ❌ You use the `-v` flag with `docker stack rm` (which you shouldn't)
- ❌ You manually delete files from `/var/lib/docker/volumes/`

**You're all set for production on your MiniPC!** 🎉
