#!/bin/bash
# RUN THIS ON YOUR MINIPC (192.168.0.25)

set -e

echo "=========================================="
echo "RATS++ MINIPC DEPLOYMENT"
echo "=========================================="
echo ""

# Check if migration file exists
if [ ! -f ~/ratspp-migration-20260627-004417.tar.gz ]; then
    echo "ERROR: Migration file not found in home directory"
    echo "Please ensure the SCP transfer completed successfully"
    exit 1
fi

echo "✓ Migration file found"
echo ""

# Clone repository
echo "Step 1: Cloning repository from GitHub..."
cd ~
if [ -d "RATS-plusplus" ]; then
    echo "Directory exists, pulling latest changes..."
    cd RATS-plusplus
    git pull
else
    git clone https://github.com/mtvProof/RATS-plusplus.git
    cd RATS-plusplus
fi
echo "✓ Repository ready"
echo ""

# Move migration file
echo "Step 2: Moving migration file..."
mv ~/ratspp-migration-20260627-004417.tar.gz .
echo "✓ Migration file moved"
echo ""

# Import data
echo "Step 3: Importing your data (credentials, instances, database)..."
./migrate-data.sh import
echo ""

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    echo "Step 4: Creating .env file..."
    echo "Please enter your Discord Bot Token:"
    read -r DISCORD_TOKEN
    echo "Please enter your Discord Client ID:"
    read -r CLIENT_ID
    
    cat > .env << EOF
# Discord Configuration
RPP_DISCORD_TOKEN=$DISCORD_TOKEN
RPP_DISCORD_CLIENT_ID=$CLIENT_ID

# Optional Settings (defaults are fine)
RPP_DISCORD_USERNAME=RATS++
RPP_LANGUAGE=en
RPP_POLLING_INTERVAL=7000
RPP_RECONNECT_INTERVAL=15000
RPP_WEBUI_ENABLED=true
RPP_WEBUI_PORT=3000
NODE_ENV=production
TZ=UTC
EOF
    echo "✓ .env file created"
else
    echo "Step 4: .env file already exists"
fi
echo ""

# Test configuration
echo "Step 5: Testing configuration..."
./docker-test.sh
echo ""

# Build image
echo "Step 6: Building Docker image from YOUR code..."
docker build -t mtvproof-ratspp:latest .
echo "✓ Image built"
echo ""

# Initialize Swarm if needed
echo "Step 7: Initializing Docker Swarm..."
if docker node ls >/dev/null 2>&1; then
    echo "✓ Swarm already initialized"
else
    docker swarm init
    echo "✓ Swarm initialized"
fi
echo ""

# Deploy stack
echo "Step 8: Deploying stack..."
docker stack deploy -c docker-stack.yml ratspp
echo "✓ Stack deployed!"
echo ""

# Show status
echo "=========================================="
echo "DEPLOYMENT COMPLETE!"
echo "=========================================="
echo ""
echo "Checking status..."
sleep 5
docker stack services ratspp
echo ""
echo "View logs with:"
echo "  docker service logs -f ratspp_rustplusbot"
echo ""
echo "Check volumes:"
echo "  docker volume ls | grep ratspp"
echo ""
echo "Access Web UI:"
echo "  http://192.168.0.25:3000"
echo ""
echo "Your data is persistent and safe!"
