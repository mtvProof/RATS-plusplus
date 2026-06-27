# 🔒 Data Persistence & Image Source - Critical Info

## ✅ Your Data is SAFE!

### How Data Persistence Works

#### Docker Compose (Bind Mounts)
```
Your Host Machine          Container
/home/mtvproof/Desktop/RATS-plusplus/
├── credentials/           →  /app/credentials/
│   ├── 1351633527011147866.json  ←  Same files!
│   └── 1487548877430194357.json  ←  Same files!
├── instances/            →  /app/instances/
│   ├── 1351633527011147866.json  ←  Same files!
│   └── 1487548877430194357.json  ←  Same files!
├── database/             →  /app/database/
├── logs/                 →  /app/logs/
└── maps/                 →  /app/maps/
```

**What this means:**
- ✅ Container reads/writes directly to YOUR local directories
- ✅ When you `docker compose down`, files stay on your machine
- ✅ When you `docker compose up` again, same files are mounted back
- ✅ Even if you delete the container, your files remain safe

#### Docker Stack (Named Volumes)
```
Docker Volumes (persistent storage)     Container
ratspp_credentials                  →  /app/credentials/
ratspp_instances                    →  /app/instances/
ratspp_database                     →  /app/database/
ratspp_logs                         →  /app/logs/
ratspp_maps                         →  /app/maps/
```

**What this means:**
- ✅ Data stored in Docker-managed volumes
- ✅ Persists even when stack is removed
- ✅ Only deleted if you explicitly run `docker volume rm`
- ✅ Can back up with `docker run --rm -v ratspp_credentials:/data:ro ...`

### 🔴 When You LOSE Data

You will ONLY lose data if you:

**Docker Compose:**
```bash
# ❌ BAD - This deletes your local files!
rm -rf credentials/ instances/ database/

# ❌ BAD - This also deletes volumes
docker compose down -v  # The -v flag removes volumes!
```

**Docker Stack:**
```bash
# ❌ BAD - This deletes the volumes!
docker volume rm ratspp_credentials ratspp_instances ratspp_database
```

### ✅ Safe Operations

These are **SAFE** and will preserve your data:

```bash
# ✅ SAFE - Stops container, keeps data
docker compose down

# ✅ SAFE - Stops and removes stack, volumes persist
docker stack rm ratspp

# ✅ SAFE - Rebuilds image, keeps data
docker compose up -d --build

# ✅ SAFE - Updates and redeploys
docker compose down
git pull
docker compose up -d --build

# ✅ SAFE - Stack redeploy
docker stack rm ratspp
docker build -t mtvproof-ratspp:latest .
docker stack deploy -c docker-stack.yml ratspp
```

## 🎯 Image Source - YOUR Code vs FaiThiX Fork

### What Changed

**Before (pulling FaiThiX's image):**
```yaml
image: ghcr.io/faithix/rustplusplus:master  # ❌ External registry
```

**Now (building YOUR code):**
```yaml
# Docker Compose
build:
  context: .          # ✅ YOUR local directory
  dockerfile: Dockerfile
image: mtvproof-ratspp:latest  # ✅ Tagged as YOUR image

# Docker Stack
image: mtvproof-ratspp:latest  # ✅ Must build locally first
```

### How to Verify You're Using YOUR Code

1. **Check the image name:**
   ```bash
   docker images | grep ratspp
   # Should show: mtvproof-ratspp    latest    ...
   ```

2. **Check where it was built:**
   ```bash
   docker image inspect mtvproof-ratspp:latest | grep -A5 Labels
   # Will show it was built locally
   ```

3. **Verify the Dockerfile is being used:**
   ```bash
   # Your deployment always runs:
   docker build -t mtvproof-ratspp:latest .
   # This builds from YOUR current directory
   ```

### Deployment Workflow

**Docker Compose:**
```bash
docker compose up -d --build
# This automatically:
# 1. Builds from YOUR local Dockerfile
# 2. Tags as mtvproof-ratspp:latest
# 3. Starts the container
# 4. Mounts YOUR local data directories
```

**Docker Stack:**
```bash
# 1. Build YOUR image first
docker build -t mtvproof-ratspp:latest .

# 2. Deploy the stack
docker stack deploy -c docker-stack.yml ratspp
# Uses the locally-built mtvproof-ratspp:latest image
```

## 🔍 How to Check Your Data

### Docker Compose (bind mounts)

Just look at your local directories:
```bash
ls -la credentials/
ls -la instances/
# You'll see your files right there!
```

### Docker Stack (named volumes)

List volumes:
```bash
docker volume ls | grep ratspp
```

Inspect a volume:
```bash
docker volume inspect ratspp_credentials
```

View files in a volume:
```bash
docker run --rm -v ratspp_credentials:/data:ro alpine ls -la /data
```

## 📦 Backing Up Your Data

### Docker Compose (simple - it's just files!)

```bash
# Backup
tar -czf backup-$(date +%Y%m%d).tar.gz \
  credentials instances database maps

# Restore
tar -xzf backup-20260627.tar.gz
```

### Docker Stack (requires volume backup)

```bash
# Backup all volumes
docker run --rm \
  -v ratspp_credentials:/data/credentials:ro \
  -v ratspp_instances:/data/instances:ro \
  -v ratspp_database:/data/database:ro \
  -v $(pwd):/backup \
  alpine tar -czf /backup/volumes-backup-$(date +%Y%m%d).tar.gz -C /data .

# Restore (example)
docker run --rm \
  -v ratspp_credentials:/data/credentials \
  -v $(pwd):/backup \
  alpine tar -xzf /backup/volumes-backup-20260627.tar.gz -C /data
```

## 🎯 Summary

### Your Data is Protected Because:

1. **Docker Compose** mounts your local directories - files stay on your machine
2. **Docker Stack** uses named volumes - persist across redeployments
3. **Both methods** only lose data if you explicitly delete volumes or files

### You're Using YOUR Code Because:

1. **Image name** changed from `faithix/rustplusplus` to `mtvproof-ratspp`
2. **Build context** is your local directory (`.`)
3. **Dockerfile** in your directory is used for the build
4. **No pulling** from external registries

### Test It Yourself

```bash
# 1. Deploy
docker compose up -d --build

# 2. Check your image
docker images | grep mtvproof-ratspp

# 3. Verify your data is there
ls -la credentials/ instances/

# 4. Stop and restart
docker compose down
docker compose up -d

# 5. Check data is still there
ls -la credentials/ instances/
```

**You're all set!** Your credentials, instances, and all data are safe! 🎉
