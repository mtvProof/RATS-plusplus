#!/bin/bash

# RATS++ Docker Deployment Script
# This script helps you deploy the RATS++ bot using Docker

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
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

check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    print_success "Docker is installed"
    
    # Check for docker compose
    if command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
    elif docker compose version &> /dev/null 2>&1; then
        COMPOSE_CMD="docker compose"
    else
        print_error "Docker Compose is not installed. Please install Docker Compose."
        exit 1
    fi
    print_success "Docker Compose is available"
}

check_env_file() {
    if [ ! -f .env ]; then
        print_warning ".env file not found!"
        echo -e "${YELLOW}Would you like to create it from .env.example? (y/n)${NC}"
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            cp .env.example .env
            print_success "Created .env file"
            print_warning "Please edit .env and add your Discord token and client ID"
            echo -e "${YELLOW}Opening .env in nano...${NC}"
            sleep 2
            nano .env
        else
            print_error "Cannot continue without .env file"
            exit 1
        fi
    else
        print_success ".env file exists"
    fi
    
    # Check if required variables are set
    source .env
    if [ -z "$RPP_DISCORD_TOKEN" ] || [ "$RPP_DISCORD_TOKEN" == "your_discord_bot_token_here" ]; then
        print_error "RPP_DISCORD_TOKEN not set in .env file"
        exit 1
    fi
    if [ -z "$RPP_DISCORD_CLIENT_ID" ] || [ "$RPP_DISCORD_CLIENT_ID" == "your_discord_client_id_here" ]; then
        print_error "RPP_DISCORD_CLIENT_ID not set in .env file"
        exit 1
    fi
    print_success "Required environment variables are set"
}

create_directories() {
    print_header "Creating required directories"
    mkdir -p credentials instances database logs maps
    print_success "Directories created"
}

deploy_compose() {
    print_header "Deploying with Docker Compose"
    check_env_file
    create_directories
    
    echo -e "${BLUE}Building and starting container...${NC}"
    $COMPOSE_CMD up -d --build
    
    print_success "Bot deployed successfully!"
    echo ""
    echo -e "${GREEN}View logs with: $COMPOSE_CMD logs -f${NC}"
    echo -e "${GREEN}Stop bot with: $COMPOSE_CMD down${NC}"
    if [ "$RPP_WEBUI_ENABLED" != "false" ]; then
        echo -e "${GREEN}Web UI available at: http://localhost:${RPP_WEBUI_PORT:-3000}${NC}"
    fi
}

deploy_stack() {
    print_header "Deploying with Docker Stack"
    check_env_file
    
    if ! docker node ls &> /dev/null; then
        print_warning "Docker Swarm is not initialized"
        echo -e "${YELLOW}Would you like to initialize Docker Swarm? (y/n)${NC}"
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            docker swarm init
            print_success "Docker Swarm initialized"
        else
            print_error "Cannot deploy stack without Swarm"
            exit 1
        fi
    fi
    
    echo -e "${BLUE}Building YOUR image from local code...${NC}"
    docker build -t mtvproof-ratspp:latest .
    
    echo -e "${BLUE}Deploying stack...${NC}"
    docker stack deploy -c docker-stack.yml ratspp
    
    print_success "Stack deployed successfully!"
    echo ""
    echo -e "${GREEN}View services: docker stack services ratspp${NC}"
    echo -e "${GREEN}View logs: docker service logs -f ratspp_rustplusbot${NC}"
    echo -e "${GREEN}Remove stack: docker stack rm ratspp${NC}"
}

stop_bot() {
    print_header "Stopping RATS++ Bot"
    
    if $COMPOSE_CMD ps &> /dev/null 2>&1; then
        $COMPOSE_CMD down
        print_success "Docker Compose deployment stopped"
    fi
    
    if docker stack ls | grep -q ratspp; then
        docker stack rm ratspp
        print_success "Docker Stack deployment removed"
    fi
}

view_logs() {
    if $COMPOSE_CMD ps &> /dev/null 2>&1 && [ "$($COMPOSE_CMD ps -q)" ]; then
        $COMPOSE_CMD logs -f
    elif docker service ls | grep -q ratspp_rustplusbot; then
        docker service logs -f ratspp_rustplusbot
    else
        print_error "No running RATS++ container found"
    fi
}

backup_data() {
    print_header "Backing up RATS++ data"
    
    BACKUP_FILE="ratspp-backup-$(date +%Y%m%d-%H%M%S).tar.gz"
    
    if [ -d "./credentials" ]; then
        tar -czf "$BACKUP_FILE" credentials instances database logs maps
        print_success "Backup created: $BACKUP_FILE"
    else
        print_error "No data directories found to backup"
    fi
}

show_menu() {
    print_header "RATS++ Docker Deployment Menu"
    echo "1. Deploy with Docker Compose (recommended for single host)"
    echo "2. Deploy with Docker Stack (for Swarm/multi-host)"
    echo "3. Stop bot"
    echo "4. View logs"
    echo "5. Backup data"
    echo "6. Exit"
    echo ""
    echo -n "Select an option (1-6): "
}

# Main
print_header "RATS++ Docker Deployment"
check_docker

if [ $# -eq 0 ]; then
    # Interactive mode
    while true; do
        show_menu
        read -r choice
        case $choice in
            1)
                deploy_compose
                break
                ;;
            2)
                deploy_stack
                break
                ;;
            3)
                stop_bot
                break
                ;;
            4)
                view_logs
                break
                ;;
            5)
                backup_data
                break
                ;;
            6)
                echo "Goodbye!"
                exit 0
                ;;
            *)
                print_error "Invalid option"
                ;;
        esac
    done
else
    # Command line mode
    case $1 in
        compose)
            deploy_compose
            ;;
        stack)
            deploy_stack
            ;;
        stop)
            stop_bot
            ;;
        logs)
            view_logs
            ;;
        backup)
            backup_data
            ;;
        *)
            echo "Usage: $0 [compose|stack|stop|logs|backup]"
            exit 1
            ;;
    esac
fi
