#!/bin/bash

# RATS++ Docker Test Script
# Quick validation that everything is configured correctly for Docker

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}RATS++ Docker Configuration Test${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Test 1: Check Docker
echo -n "Checking Docker installation... "
if command -v docker &> /dev/null; then
    echo -e "${GREEN}✓${NC}"
    docker --version
else
    echo -e "${RED}✗ Docker not found${NC}"
    exit 1
fi
echo ""

# Test 2: Check Docker Compose
echo -n "Checking Docker Compose... "
if command -v docker-compose &> /dev/null; then
    echo -e "${GREEN}✓${NC}"
    docker-compose --version
    COMPOSE_CMD="docker-compose"
elif docker compose version &> /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
    docker compose version
    COMPOSE_CMD="docker compose"
else
    echo -e "${RED}✗ Docker Compose not found${NC}"
    echo "  Install with: sudo apt install docker-compose-plugin"
    exit 1
fi
echo ""

# Test 3: Check required files
echo "Checking required files..."
FILES=("Dockerfile" "docker-compose.yml" ".env.example" ".dockerignore")
for file in "${FILES[@]}"; do
    echo -n "  $file... "
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${RED}✗ Missing${NC}"
        exit 1
    fi
done
echo ""

# Test 4: Check .env file
echo -n "Checking .env file... "
if [ -f ".env" ]; then
    echo -e "${GREEN}✓ Exists${NC}"
    
    # Check for required variables
    source .env
    echo "  Checking required variables..."
    
    echo -n "    RPP_DISCORD_TOKEN... "
    if [ -n "$RPP_DISCORD_TOKEN" ] && [ "$RPP_DISCORD_TOKEN" != "your_discord_bot_token_here" ]; then
        echo -e "${GREEN}✓ Set${NC}"
    else
        echo -e "${RED}✗ Not set or using placeholder${NC}"
        echo -e "    ${YELLOW}Action: Edit .env and set your Discord bot token${NC}"
    fi
    
    echo -n "    RPP_DISCORD_CLIENT_ID... "
    if [ -n "$RPP_DISCORD_CLIENT_ID" ] && [ "$RPP_DISCORD_CLIENT_ID" != "your_discord_client_id_here" ]; then
        echo -e "${GREEN}✓ Set${NC}"
    else
        echo -e "${RED}✗ Not set or using placeholder${NC}"
        echo -e "    ${YELLOW}Action: Edit .env and set your Discord client ID${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Not found${NC}"
    echo -e "  ${YELLOW}Action: Copy .env.example to .env and edit it${NC}"
fi
echo ""

# Test 5: Check data directories
echo "Checking data directories..."
DIRS=("credentials" "instances" "database" "logs" "maps")
for dir in "${DIRS[@]}"; do
    echo -n "  $dir/... "
    if [ -d "$dir" ]; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${YELLOW}⚠ Will be created${NC}"
    fi
done
echo ""

# Test 6: Validate docker-compose.yml
echo -n "Validating docker-compose.yml... "
if $COMPOSE_CMD config > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗ Invalid configuration${NC}"
    $COMPOSE_CMD config
    exit 1
fi
echo ""

# Test 7: Check for port conflicts
echo -n "Checking port 3000 availability... "
if command -v lsof &> /dev/null; then
    if lsof -i:3000 &> /dev/null; then
        echo -e "${YELLOW}⚠ Port 3000 is in use${NC}"
        echo "  Currently used by:"
        lsof -i:3000
        echo -e "  ${YELLOW}You may need to change RPP_WEBUI_PORT in .env${NC}"
    else
        echo -e "${GREEN}✓${NC}"
    fi
elif command -v netstat &> /dev/null; then
    if netstat -tuln | grep :3000 &> /dev/null; then
        echo -e "${YELLOW}⚠ Port 3000 appears to be in use${NC}"
    else
        echo -e "${GREEN}✓${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Cannot check (lsof/netstat not available)${NC}"
fi
echo ""

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

if [ -f ".env" ]; then
    source .env
    if [ -n "$RPP_DISCORD_TOKEN" ] && [ "$RPP_DISCORD_TOKEN" != "your_discord_bot_token_here" ] && \
       [ -n "$RPP_DISCORD_CLIENT_ID" ] && [ "$RPP_DISCORD_CLIENT_ID" != "your_discord_client_id_here" ]; then
        echo -e "${GREEN}✓ Ready to deploy!${NC}"
        echo ""
        echo "Deploy with:"
        echo "  ./docker-deploy.sh"
        echo "or"
        echo "  docker-compose up -d --build"
    else
        echo -e "${YELLOW}⚠ Almost ready!${NC}"
        echo ""
        echo "Next steps:"
        echo "1. Edit .env and set your Discord credentials"
        echo "2. Run this test again"
        echo "3. Deploy with: ./docker-deploy.sh"
    fi
else
    echo -e "${YELLOW}⚠ Configuration needed${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Copy .env.example to .env"
    echo "2. Edit .env and set your Discord credentials"
    echo "3. Run this test again"
    echo "4. Deploy with: ./docker-deploy.sh"
fi
