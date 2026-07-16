# Deploying RATS++ to Mini PC with Portainer

## Two Deployment Options

### Option 1: Build on Mini PC (Recommended)

This builds the image locally on your mini PC from your custom code.

#### Steps:

**1. Copy your code to the Mini PC:**
```bash
# On your development machine
rsync -avz --exclude 'node_modules' --exclude '.git' \
  /home/mtvproof/Desktop/RATS-plusplus/ \
  user@minipc:/home/user/RATS-plusplus/
```

**2. Build the image on the Mini PC:**
```bash
# SSH into mini PC
ssh user@minipc

# Navigate to the code
cd /home/user/RATS-plusplus

# Build the image
docker compose build

# Verify image exists
docker images | grep mtvproof-ratspp
```

**3. Deploy via Portainer:**
- Open Portainer UI (usually http://minipc-ip:9000)
- Go to "Stacks" → "Add stack"
- Name: `ratspp`
- Copy the contents of `portainer-stack.yml`
- **IMPORTANT**: Edit the environment variables in the YAML:
  ```yaml
  - RPP_DISCORD_TOKEN=your_actual_token
  - RPP_DISCORD_CLIENT_ID=your_actual_client_id
  ```
- Click "Deploy the stack"

---

### Option 2: Use Official Image

Use the official FaiThiX image (may not have your customizations).

#### Steps:

**1. Edit portainer-stack.yml:**
Change the image line to:
```yaml
image: ghcr.io/faithix/rustplusplus:master
```

**2. Deploy via Portainer:**
- Open Portainer UI
- Go to "Stacks" → "Add stack"
- Name: `ratspp`
- Paste the modified YAML
- Edit environment variables with your credentials
- Click "Deploy the stack"

---

## Portainer Stack YAML

Use this YAML in Portainer. **Make sure to replace the environment variable values!**

```yaml
services:
  rustplusbot:
    # Option 1: Use your built image (after building on mini PC)
    image: mtvproof-ratspp:latest
    
    # Option 2: Use official image (uncomment to use)
    # image: ghcr.io/faithix/rustplusplus:master
    
    container_name: rustplusbot
    
    environment:
      # REQUIRED: Replace with your actual Discord credentials!
      - RPP_DISCORD_TOKEN=YOUR_ACTUAL_DISCORD_TOKEN_HERE
      - RPP_DISCORD_CLIENT_ID=YOUR_ACTUAL_CLIENT_ID_HERE
      
      # Optional settings (customize as needed):
      - RPP_DISCORD_USERNAME=RATS++
      - RPP_LANGUAGE=en
      - RPP_WEBUI_ENABLED=true
      - RPP_WEBUI_PORT=3000
      - NODE_ENV=production
      - TZ=America/New_York
    
    # Named volumes - data persists across container updates
    volumes:
      - ratspp_credentials:/app/credentials
      - ratspp_instances:/app/instances
      - ratspp_database:/app/database
      - ratspp_logs:/app/logs
      - ratspp_maps:/app/maps
    
    ports:
      - "3000:3000"
    
    restart: unless-stopped
    
    healthcheck:
      test: ["CMD", "node", "-e", "process.exit(0)"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

# Named volumes - managed by Docker
volumes:
  ratspp_credentials:
  ratspp_instances:
  ratspp_database:
  ratspp_logs:
  ratspp_maps:
```

---

## Step-by-Step Portainer Deployment

### 1. Access Portainer
Navigate to your mini PC's Portainer instance:
```
http://MINIPC_IP:9000
```

### 2. Create New Stack
1. Click **"Stacks"** in the left menu
2. Click **"+ Add stack"** button
3. Enter name: `ratspp`

### 3. Paste Configuration
1. Select **"Web editor"** tab
2. Copy the YAML from above
3. Paste into the editor

### 4. Configure Environment Variables
**In the YAML editor, replace these values:**

```yaml
- RPP_DISCORD_TOKEN=YOUR_ACTUAL_DISCORD_TOKEN_HERE
- RPP_DISCORD_CLIENT_ID=YOUR_ACTUAL_CLIENT_ID_HERE
```

Get these from: https://discord.com/developers/applications

**Optional: Adjust timezone:**
```yaml
- TZ=America/New_York  # Change to your timezone
```

### 5. Deploy
1. Scroll down
2. Click **"Deploy the stack"**
3. Wait for deployment to complete

### 6. Verify Deployment
1. Go to **"Containers"** in Portainer
2. Find `rustplusbot` container
3. Check status is **"running"**
4. Click on container → **"Logs"** to view output

### 7. Access Web UI
Open in browser:
```
http://MINIPC_IP:3000
```

---

## Managing Your Deployment

### View Logs
In Portainer:
1. Go to **"Containers"**
2. Click on **rustplusbot**
3. Click **"Logs"** tab
4. Enable **"Auto-refresh"**

### Restart Bot
In Portainer:
1. Go to **"Containers"**
2. Click on **rustplusbot**
3. Click **"Restart"**

### Update Configuration
To change environment variables:
1. Go to **"Stacks"** → **ratspp**
2. Click **"Editor"**
3. Modify environment variables
4. Click **"Update the stack"**
5. Check **"Re-pull image and redeploy"** if using official image
6. Click **"Update"**

### Update Code (Option 1 - Custom Build)
When you update your code:

```bash
# 1. Copy new code to mini PC
rsync -avz /home/mtvproof/Desktop/RATS-plusplus/ user@minipc:/home/user/RATS-plusplus/

# 2. SSH to mini PC
ssh user@minipc

# 3. Rebuild image
cd /home/user/RATS-plusplus
docker compose build

# 4. In Portainer, go to Stacks → ratspp → Click "Update the stack"
```

### View Data Volumes
In Portainer:
1. Go to **"Volumes"**
2. Look for volumes starting with `ratspp_`
3. Click to browse files (if enabled)

---

## Data Persistence

Your bot data is stored in Docker named volumes:

| Volume | Purpose | Can Delete? |
|--------|---------|-------------|
| `ratspp_credentials` | Rust+ auth tokens | ❌ NO - You'll lose pairing |
| `ratspp_instances` | Server configs | ❌ NO - You'll lose settings |
| `ratspp_database` | Bot database | ❌ NO - You'll lose data |
| `ratspp_logs` | Application logs | ✅ Yes - Can clear |
| `ratspp_maps` | Map cache | ✅ Yes - Will regenerate |

**Important:** These volumes persist even if you delete the container or stack!

---

## Backing Up Data

### Using Portainer

Unfortunately, Portainer doesn't have built-in volume backup. Use SSH instead.

### Using SSH to Mini PC

```bash
# SSH into mini PC
ssh user@minipc

# Create backup directory
mkdir -p ~/ratspp-backups

# Backup all volumes
docker run --rm \
  -v ratspp_credentials:/credentials:ro \
  -v ratspp_instances:/instances:ro \
  -v ratspp_database:/database:ro \
  -v ~/ratspp-backups:/backup \
  alpine tar czf /backup/ratspp-backup-$(date +%Y%m%d).tar.gz \
  -C / credentials instances database

# List backups
ls -lh ~/ratspp-backups/
```

### Restore from Backup

```bash
# SSH into mini PC
ssh user@minipc

# Extract backup
docker run --rm \
  -v ratspp_credentials:/credentials \
  -v ratspp_instances:/instances \
  -v ratspp_database:/database \
  -v ~/ratspp-backups:/backup \
  alpine sh -c "cd / && tar xzf /backup/ratspp-backup-YYYYMMDD.tar.gz"

# Restart container in Portainer
```

---

## Troubleshooting

### Container Won't Start

**Check logs in Portainer:**
1. Containers → rustplusbot → Logs

**Common issues:**
- Invalid Discord token → Fix environment variable
- Invalid client ID → Fix environment variable
- Port 3000 already in use → Change `RPP_WEBUI_PORT`

### Can't Access Web UI

**Check:**
1. Container is running (Portainer → Containers)
2. Port mapping is correct (should show `0.0.0.0:3000->3000/tcp`)
3. Firewall allows port 3000
4. Try: `http://minipc-ip:3000` from another device

**If using reverse proxy:**
Set up nginx/Traefik in front of port 3000

### Bot Not Connecting to Rust+

**First time setup:**
1. Invite bot to Discord server
2. Run `/credentials` command
3. Follow pairing process

**Already paired but not working:**
- Check credentials volume exists
- Re-pair using `/credentials`
- Check logs for errors

### Image Not Found

**If using custom image:**
```bash
# SSH to mini PC
ssh user@minipc
cd /home/user/RATS-plusplus
docker compose build
docker images | grep mtvproof-ratspp
```

**If using official image:**
Change stack YAML to:
```yaml
image: ghcr.io/faithix/rustplusplus:master
```

### Permission Issues

Named volumes handle permissions automatically. If issues persist:

```bash
# SSH to mini PC
docker run --rm -v ratspp_credentials:/data alpine chown -R 1001:1001 /data
docker run --rm -v ratspp_instances:/data alpine chown -R 1001:1001 /data
docker run --rm -v ratspp_database:/data alpine chown -R 1001:1001 /data
```

---

## Comparison: Our Setup vs Original

### Original FaiThiX Setup:
```yaml
image: ghcr.io/faithix/rustplusplus:master
environment:
  - RPP_DISCORD_TOKEN=TOKEN
  - RPP_DISCORD_CLIENT_ID=CLIENT_ID
volumes:
  - ./logs:/app/logs
  - ./instances:/app/instances
  - ./credentials:/app/credentials
  - ./maps:/app/maps
```

### Our Setup:
```yaml
image: mtvproof-ratspp:latest  # Your custom build
environment:
  - RPP_DISCORD_TOKEN=YOUR_TOKEN
  - RPP_DISCORD_CLIENT_ID=YOUR_ID
  # Plus additional optional settings
volumes:
  - ratspp_credentials:/app/credentials  # Named volumes (better for Portainer)
  - ratspp_instances:/app/instances
  - ratspp_database:/app/database
  - ratspp_logs:/app/logs
  - ratspp_maps:/app/maps
```

### Key Differences:
1. **Image**: We use your custom build vs official image
2. **Volumes**: Named volumes (managed by Docker) vs bind mounts
3. **Database**: We include database volume (they don't mention it)
4. **More ENV vars**: More configuration options

**Both approaches work!** Ours gives you:
- ✅ Your custom code/modifications
- ✅ Better volume management in Portainer
- ✅ More configuration options
- ✅ Included database persistence

---

## Quick Start Checklist

- [ ] Decide: Custom build or official image?
- [ ] If custom: Copy code to mini PC and build
- [ ] Get Discord token and client ID
- [ ] Open Portainer on mini PC
- [ ] Create new stack named `ratspp`
- [ ] Paste portainer-stack.yml content
- [ ] Edit environment variables with real credentials
- [ ] Deploy stack
- [ ] Check container is running
- [ ] View logs for any errors
- [ ] Access Web UI at http://minipc-ip:3000
- [ ] Invite bot to Discord server
- [ ] Run `/credentials` to pair with Rust+

---

## Need Help?

- Check container logs in Portainer first
- Verify environment variables are set correctly
- Ensure image exists (if using custom build)
- Test network connectivity to mini PC
- Consult main docs: [DOCKER_COMPLETE_GUIDE.md](DOCKER_COMPLETE_GUIDE.md)
