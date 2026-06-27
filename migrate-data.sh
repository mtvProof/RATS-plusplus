#!/bin/bash

# RATS++ Data Migration Script
# Use this to migrate your bot data from Raspberry Pi to MiniPC

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Determine script mode
if [ "$1" == "export" ]; then
    MODE="export"
elif [ "$1" == "import" ]; then
    MODE="import"
else
    echo "Usage: $0 [export|import]"
    echo ""
    echo "  export - Create backup archive on Raspberry Pi"
    echo "  import - Restore data on MiniPC"
    exit 1
fi

BACKUP_FILE="ratspp-migration-$(date +%Y%m%d-%H%M%S).tar.gz"

if [ "$MODE" == "export" ]; then
    print_header "Exporting RATS++ Data from Raspberry Pi"
    
    # Check if directories exist
    if [ ! -d "credentials" ] || [ ! -d "instances" ]; then
        print_error "credentials/ or instances/ directory not found"
        print_error "Run this script from the RATS-plusplus directory"
        exit 1
    fi
    
    echo -e "${BLUE}Creating backup archive...${NC}"
    
    # Create comprehensive backup
    tar -czf "$BACKUP_FILE" \
        credentials/ \
        instances/ \
        database/ \
        .env 2>/dev/null || tar -czf "$BACKUP_FILE" \
        credentials/ \
        instances/ \
        database/
    
    print_success "Backup created: $BACKUP_FILE"
    echo ""
    echo -e "${GREEN}File size: $(du -h "$BACKUP_FILE" | cut -f1)${NC}"
    echo ""
    print_header "Next Steps"
    echo "1. Transfer this file to your MiniPC:"
    echo -e "   ${YELLOW}scp $BACKUP_FILE user@minipc:/path/to/RATS-plusplus/${NC}"
    echo ""
    echo "2. On your MiniPC, run:"
    echo -e "   ${YELLOW}./migrate-data.sh import${NC}"
    echo ""
    echo "3. Deploy the stack on MiniPC:"
    echo -e "   ${YELLOW}./docker-deploy.sh${NC}"
    
elif [ "$MODE" == "import" ]; then
    print_header "Importing RATS++ Data to MiniPC"
    
    # Find the most recent backup file
    LATEST_BACKUP=$(ls -t ratspp-migration-*.tar.gz 2>/dev/null | head -1)
    
    if [ -z "$LATEST_BACKUP" ]; then
        print_error "No backup file found (ratspp-migration-*.tar.gz)"
        echo "Please transfer the backup file from your Raspberry Pi first"
        exit 1
    fi
    
    echo -e "${BLUE}Found backup: $LATEST_BACKUP${NC}"
    echo -e "${YELLOW}This will overwrite existing data. Continue? (y/n)${NC}"
    read -r response
    
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        echo "Import cancelled"
        exit 0
    fi
    
    echo -e "${BLUE}Extracting data...${NC}"
    
    # Create directories if they don't exist
    mkdir -p credentials instances database logs maps
    
    # Extract backup
    tar -xzf "$LATEST_BACKUP"
    
    print_success "Data extracted successfully"
    
    # Show what was restored
    echo ""
    print_header "Restored Data"
    echo "Credentials:"
    ls -lh credentials/
    echo ""
    echo "Instances:"
    ls -lh instances/
    
    if [ -f ".env" ]; then
        echo ""
        print_success ".env file restored"
    else
        echo ""
        print_warning ".env file not found in backup"
        echo "You'll need to create one from .env.example"
    fi
    
    echo ""
    print_header "Next Steps"
    echo "1. Verify your .env file has correct credentials:"
    echo -e "   ${YELLOW}cat .env${NC}"
    echo ""
    echo "2. Test the configuration:"
    echo -e "   ${YELLOW}./docker-test.sh${NC}"
    echo ""
    echo "3. Deploy the stack:"
    echo -e "   ${YELLOW}./docker-deploy.sh${NC}"
    echo ""
    print_success "Import complete! Your data is ready."
fi
