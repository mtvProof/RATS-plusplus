#!/bin/bash

# RATS++ Docker Setup Validator
# This script validates your Docker configuration before deployment

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}RATS++ Docker Setup Validator${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

ERRORS=0
WARNINGS=0

# Check Docker
echo -n "Checking Docker... "
if command -v docker &> /dev/null; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗ Docker not found${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check Docker Compose
echo -n "Checking Docker Compose... "
if command -v docker-compose &> /dev/null || docker compose version &> /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗ Docker Compose not found${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check .env file
echo -n "Checking .env file... "
if [ -f .env ]; then
    echo -e "${GREEN}✓${NC}"
    
    # Load .env
    export $(grep -v '^#' .env | xargs)
    
    # Check required variables
    echo -n "  Checking RPP_DISCORD_TOKEN... "
    if [ -n "$RPP_DISCORD_TOKEN" ] && [ "$RPP_DISCORD_TOKEN" != "your_discord_bot_token_here" ]; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${RED}✗ Not set or using default${NC}"
        ERRORS=$((ERRORS + 1))
    fi
    
    echo -n "  Checking RPP_DISCORD_CLIENT_ID... "
    if [ -n "$RPP_DISCORD_CLIENT_ID" ] && [ "$RPP_DISCORD_CLIENT_ID" != "your_discord_client_id_here" ]; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${RED}✗ Not set or using default${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}✗ .env file not found${NC}"
    ERRORS=$((ERRORS + 1))
    echo -e "${YELLOW}Run: cp .env.example .env${NC}"
fi

# Check required files
echo -n "Checking Dockerfile... "
if [ -f Dockerfile ]; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗ Dockerfile not found${NC}"
    ERRORS=$((ERRORS + 1))
fi

echo -n "Checking docker-compose.yml... "
if [ -f docker-compose.yml ]; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗ docker-compose.yml not found${NC}"
    ERRORS=$((ERRORS + 1))
fi

echo -n "Checking package.json... "
if [ -f package.json ]; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗ package.json not found${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check data directories
echo -n "Checking data directories... "
missing_dirs=""
for dir in credentials instances database logs maps; do
    if [ ! -d "$dir" ]; then
        missing_dirs="$missing_dirs $dir"
    fi
done

if [ -z "$missing_dirs" ]; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${YELLOW}⚠ Missing:$missing_dirs${NC}"
    echo -e "  ${BLUE}Will be created automatically${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

# Check for existing containers
echo -n "Checking for existing container... "
if docker ps -a --format '{{.Names}}' | grep -q '^rustplusbot$'; then
    echo -e "${YELLOW}⚠ Container 'rustplusbot' already exists${NC}"
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${GREEN}✓ No conflicts${NC}"
fi

# Check port availability
echo -n "Checking port 3000 availability... "
if command -v netstat &> /dev/null; then
    if netstat -tuln | grep -q ":3000 "; then
        echo -e "${YELLOW}⚠ Port 3000 appears to be in use${NC}"
        WARNINGS=$((WARNINGS + 1))
    else
        echo -e "${GREEN}✓${NC}"
    fi
elif command -v ss &> /dev/null; then
    if ss -tuln | grep -q ":3000 "; then
        echo -e "${YELLOW}⚠ Port 3000 appears to be in use${NC}"
        WARNINGS=$((WARNINGS + 1))
    else
        echo -e "${GREEN}✓${NC}"
    fi
else
    echo -e "${BLUE}ℹ Cannot check (netstat/ss not available)${NC}"
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "Summary:"
echo -e "  Errors: ${RED}$ERRORS${NC}"
echo -e "  Warnings: ${YELLOW}$WARNINGS${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✓ Configuration looks good!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Review your .env file: nano .env"
    echo "  2. Build and start: ./docker-deploy.sh"
    echo "  3. View logs: docker-compose logs -f"
    echo ""
    exit 0
else
    echo -e "${RED}✗ Please fix the errors above before deploying${NC}"
    exit 1
fi
