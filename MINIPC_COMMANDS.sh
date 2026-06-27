#!/bin/bash
# Complete MiniPC Deployment Commands
# Copy and paste these commands on your respective machines

echo "=========================================="
echo "RATS++ DEPLOYMENT TO MINIPC"
echo "=========================================="
echo ""

# ============================================
# PART 1: ON RASPBERRY PI (192.168.0.X)
# ============================================
echo "=== PART 1: ON RASPBERRY PI ==="
echo ""
echo "# 1. Your data is already exported:"
echo "   File: ratspp-migration-20260627-004417.tar.gz (16M)"
echo ""
echo "# 2. Transfer data to MiniPC:"
echo "scp ~/Desktop/RATS-plusplus/ratspp-migration-20260627-004417.tar.gz mtvproof@192.168.0.25:~/"
echo ""
echo "# OR if you prefer, transfer to a specific directory:"
echo "scp ~/Desktop/RATS-plusplus/ratspp-migration-20260627-004417.tar.gz mtvproof@192.168.0.25:/home/mtvproof/"
echo ""

# ============================================
# PART 2: ON MINIPC (192.168.0.25)
# ============================================
echo ""
echo "=== PART 2: ON MINIPC (192.168.0.25) ==="
echo ""
echo "# 1. Clone your repository (with all new changes):"
echo "cd ~"
echo "git clone https://github.com/mtvProof/RATS-plusplus.git"
echo "cd RATS-plusplus"
echo ""

echo "# 2. Move the migration file here:"
echo "mv ~/ratspp-migration-20260627-004417.tar.gz ."
echo ""

echo "# 3. Import your data (credentials, instances, database):"
echo "./migrate-data.sh import"
echo ""

echo "# 4. Create .env file with your Discord credentials:"
echo "nano .env"
echo "# Add these lines:"
echo "# RPP_DISCORD_TOKEN=your_token_here"
echo "# RPP_DISCORD_CLIENT_ID=your_client_id_here"
echo "# Save and exit (Ctrl+X, Y, Enter)"
echo ""

echo "# 5. Test configuration:"
echo "./docker-test.sh"
echo ""

echo "# 6. Build YOUR image from local code:"
echo "docker build -t mtvproof-ratspp:latest ."
echo ""

echo "# 7. Initialize Docker Swarm (one-time setup):"
echo "docker swarm init"
echo ""

echo "# 8. Deploy the stack:"
echo "docker stack deploy -c docker-stack.yml ratspp"
echo ""

echo "# 9. Check status:"
echo "docker stack services ratspp"
echo "docker service logs -f ratspp_rustplusbot"
echo ""

# ============================================
# VERIFICATION
# ============================================
echo ""
echo "=== VERIFICATION ==="
echo ""
echo "# Check volumes were created:"
echo "docker volume ls | grep ratspp"
echo "# Should show 5 volumes: credentials, instances, database, logs, maps"
echo ""

echo "# Verify data in volumes:"
echo "docker run --rm -v ratspp_credentials:/data:ro alpine ls -la /data"
echo "docker run --rm -v ratspp_instances:/data:ro alpine ls -la /data"
echo ""

echo "# Access Web UI:"
echo "http://192.168.0.25:3000"
echo ""

# ============================================
# FUTURE UPDATES
# ============================================
echo ""
echo "=== FUTURE CODE UPDATES (NO DATA LOSS!) ==="
echo ""
echo "# On MiniPC, when you make code changes:"
echo "cd ~/RATS-plusplus"
echo "git pull"
echo "docker build -t mtvproof-ratspp:latest ."
echo "docker service update --image mtvproof-ratspp:latest ratspp_rustplusbot"
echo ""
echo "# Your credentials, instances, and database persist automatically!"
echo ""

# ============================================
# BACKUP
# ============================================
echo ""
echo "=== BACKUP COMMAND (Run on MiniPC) ==="
echo ""
echo "docker run --rm \\"
echo "  -v ratspp_credentials:/data/credentials:ro \\"
echo "  -v ratspp_instances:/data/instances:ro \\"
echo "  -v ratspp_database:/data/database:ro \\"
echo "  -v \$(pwd):/backup alpine \\"
echo "  tar -czf /backup/backup-\$(date +%Y%m%d).tar.gz -C /data ."
echo ""

echo "=========================================="
echo "All commands ready! Follow steps above."
echo "=========================================="
