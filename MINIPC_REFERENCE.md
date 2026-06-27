# 📝 RATS++ MiniPC Quick Reference

## 🚀 Initial Setup on MiniPC

```bash
# 1. Clone your repo
git clone https://github.com/yourusername/rustplusplus RATS-plusplus
cd RATS-plusplus

# 2. Import data from Raspberry Pi
./migrate-data.sh import

# 3. Verify configuration
./docker-test.sh

# 4. Build image
docker build -t mtvproof-ratspp:latest .

# 5. Initialize Swarm (once)
docker swarm init

# 6. Deploy!
docker stack deploy -c docker-stack.yml ratspp
```

## 📊 Daily Operations

### Check Status
```bash
docker stack services ratspp
docker service ps ratspp_rustplusbot
```

### View Logs
```bash
docker service logs -f ratspp_rustplusbot
docker service logs --tail 100 ratspp_rustplusbot
```

### Web UI
```
http://minipc-ip:3000
```

## 🔄 Code Updates (NO DATA LOSS)

```bash
cd ~/RATS-plusplus
git pull
docker build -t mtvproof-ratspp:latest .
docker service update --image mtvproof-ratspp:latest ratspp_rustplusbot

# OR full redeploy (also safe):
docker stack deploy -c docker-stack.yml ratspp
```

**Your credentials/instances/database are ALWAYS preserved!**

## 💾 Backup

```bash
docker run --rm \
  -v ratspp_credentials:/data/credentials:ro \
  -v ratspp_instances:/data/instances:ro \
  -v ratspp_database:/data/database:ro \
  -v $(pwd):/backup alpine \
  tar -czf /backup/backup-$(date +%Y%m%d).tar.gz -C /data .
```

## 🛑 Stop/Start

### Stop (keeps data)
```bash
docker stack rm ratspp
# Data volumes remain! Safe to redeploy later.
```

### Start
```bash
docker stack deploy -c docker-stack.yml ratspp
```

### Restart Service
```bash
docker service update --force ratspp_rustplusbot
```

## 🔍 Debugging

### Check Volumes
```bash
docker volume ls | grep ratspp
```

### View Volume Contents
```bash
docker run --rm -v ratspp_credentials:/data:ro alpine ls -la /data
docker run --rm -v ratspp_instances:/data:ro alpine ls -la /data
```

### Service Details
```bash
docker service inspect ratspp_rustplusbot
```

### Resource Usage
```bash
docker stats $(docker ps -q -f name=ratspp)
```

## ⚠️ Important Notes

✅ **SAFE Operations** (Data Persists):
- `git pull` → `docker build` → `docker service update`
- `docker stack rm ratspp` → `docker stack deploy`
- `docker service update --force`
- System reboots (if Docker auto-starts)

❌ **DANGER Operations** (Data Loss):
- `docker volume rm ratspp_*`
- `docker system prune --volumes`

## 🎯 Volumes Explained

| Volume | Contains | Persists? |
|--------|----------|-----------|
| `ratspp_credentials` | Rust+ account tokens | ✅ YES |
| `ratspp_instances` | Bot configs per guild | ✅ YES |
| `ratspp_database` | Bot database | ✅ YES |
| `ratspp_logs` | Application logs | ✅ YES |
| `ratspp_maps` | Map images | ✅ YES |

**These volumes survive:**
- Stack removal (`docker stack rm`)
- Service updates
- Code updates
- Container restarts
- System reboots

## 📞 Quick Checks

```bash
# Is bot running?
docker service ls | grep ratspp

# Any errors?
docker service logs --tail 50 ratspp_rustplusbot | grep -i error

# Data volumes healthy?
docker volume ls | grep ratspp | wc -l
# Should show: 5

# How long running?
docker service ps ratspp_rustplusbot
```

## 🔄 Weekly Maintenance

```bash
# 1. Backup data
./migrate-data.sh export  # or use volume backup above

# 2. Check for updates
git pull

# 3. Rebuild and update
docker build -t mtvproof-ratspp:latest .
docker service update --image mtvproof-ratspp:latest ratspp_rustplusbot

# 4. Clean old images
docker image prune -f
```

---

**Need help?** See [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md) for detailed info.
