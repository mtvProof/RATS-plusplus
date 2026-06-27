# ✅ You're All Set for MiniPC Deployment!

## What You Have Now

### 📦 Migration Tools
- ✅ **migrate-data.sh** - Export from Pi, Import on MiniPC
- ✅ **MIGRATION_GUIDE.md** - Complete step-by-step guide
- ✅ **MINIPC_REFERENCE.md** - Quick reference for daily operations

### 🔒 Data Protection
Your data **WILL PERSIST** on your MiniPC through:
- ✅ Stack redeployments (code updates)
- ✅ Container restarts
- ✅ System reboots
- ✅ Service updates

### 🎯 Docker Stack Configuration
- ✅ Uses Docker named volumes (persist across redeployments)
- ✅ Builds from **YOUR** code (not FaiThiX fork)
- ✅ All configs via environment variables

## 🚀 Migration Steps Summary

### On Raspberry Pi (NOW):
```bash
# 1. Export your data (DONE!)
./migrate-data.sh export

# This created: ratspp-migration-20260627-004417.tar.gz (16M)
# Contains:
#   ✓ credentials/1351633527011147866.json
#   ✓ credentials/1487548877430194357.json
#   ✓ instances/1351633527011147866.json
#   ✓ instances/1487548877430194357.json
#   ✓ database/statistics.db
#   ✓ .env (if exists)
```

### Transfer to MiniPC:
```bash
# Option 1: SCP
scp ratspp-migration-20260627-004417.tar.gz user@minipc-ip:/home/user/

# Option 2: Copy to USB drive
# Then mount USB on MiniPC
```

### On MiniPC:
```bash
# 1. Clone your repo
git clone https://github.com/yourusername/rustplusplus RATS-plusplus
cd RATS-plusplus

# 2. Place migration file here

# 3. Import data
./migrate-data.sh import

# 4. Build image
docker build -t mtvproof-ratspp:latest .

# 5. Initialize Swarm (once)
docker swarm init

# 6. Deploy!
docker stack deploy -c docker-stack.yml ratspp
```

## 🎯 After Deployment

### Your Data Location
On MiniPC, data is stored in Docker volumes:
```
/var/lib/docker/volumes/
├── ratspp_credentials/   ← Your Rust+ credentials
├── ratspp_instances/     ← Your bot configs
├── ratspp_database/      ← Your database
├── ratspp_logs/          ← Logs
└── ratspp_maps/          ← Map images
```

**These volumes persist even when you:**
- Remove the stack: `docker stack rm ratspp`
- Update the code: `git pull` + rebuild
- Restart the service

### Making Code Updates (NO DATA LOSS!)
```bash
# 1. Update code
git pull

# 2. Rebuild image
docker build -t mtvproof-ratspp:latest .

# 3. Update running service
docker service update --image mtvproof-ratspp:latest ratspp_rustplusbot

# Your credentials/instances/database are UNTOUCHED!
```

## 📊 Verification Checklist

After deploying on MiniPC, verify:

- [ ] Bot shows online in Discord
- [ ] Logs show no errors: `docker service logs ratspp_rustplusbot`
- [ ] Credentials loaded: Check logs for your Steam IDs
- [ ] Instances loaded: Check logs for guild connections
- [ ] Web UI accessible: `http://minipc-ip:3000`
- [ ] Volumes created: `docker volume ls | grep ratspp` shows 5 volumes
- [ ] Data persists after redeploy test:
  ```bash
  docker stack rm ratspp
  docker volume ls | grep ratspp  # Should still show volumes
  docker stack deploy -c docker-stack.yml ratspp
  ```

## 💾 Backup Strategy on MiniPC

### Weekly Backup
```bash
docker run --rm \
  -v ratspp_credentials:/data/credentials:ro \
  -v ratspp_instances:/data/instances:ro \
  -v ratspp_database:/data/database:ro \
  -v $(pwd):/backup alpine \
  tar -czf /backup/backup-$(date +%Y%m%d).tar.gz -C /data .
```

### Store Backups Off-Site
- Copy backups to NAS/cloud storage
- Recommended: Keep last 7 daily backups

## 🔧 Common Operations

### View Status
```bash
docker stack services ratspp
docker service ps ratspp_rustplusbot
```

### View Logs
```bash
docker service logs -f ratspp_rustplusbot
```

### Restart Service
```bash
docker service update --force ratspp_rustplusbot
```

### Stop Bot (keeps data)
```bash
docker stack rm ratspp
```

### Start Bot
```bash
docker stack deploy -c docker-stack.yml ratspp
```

## ⚠️ Important Reminders

### ✅ SAFE Operations (Data Persists)
- `docker stack deploy` - Creates/updates stack
- `docker stack rm` - Removes stack, keeps volumes
- `docker service update` - Updates service
- `git pull` → rebuild → update - Code updates

### ❌ DANGER Operations (Data Loss!)
- `docker volume rm ratspp_*` - Deletes volumes
- `docker system prune --volumes` - Deletes all unused volumes

## 📚 Documentation Reference

| File | Purpose |
|------|---------|
| **MIGRATION_GUIDE.md** | Detailed migration instructions |
| **MINIPC_REFERENCE.md** | Quick reference for daily ops |
| **DATA_PERSISTENCE_GUIDE.md** | How data persistence works |
| **DOCKER_QUICKSTART.md** | Quick start guide |
| **DOCKER_DEPLOYMENT.md** | Full deployment documentation |

## 🎉 Summary

**You're ready to migrate!** Your setup will:

✅ **Preserve all data** through redeployments
✅ **Build from YOUR code** (not FaiThiX fork)
✅ **Run reliably** in Docker Stack
✅ **Easy to update** with git pull + rebuild
✅ **Safe to backup** with volume snapshots

**Next Step:** Transfer the migration file to your MiniPC and follow the import steps!

---

**Questions?** All documentation is in the repo. Your data is safe! 🚀
