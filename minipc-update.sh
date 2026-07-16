#!/bin/bash

# RATS++ MiniPC Update Script
# Run this on your miniPC to pull the latest Docker image and restart

echo "🔄 Pulling latest image from GitHub Container Registry..."
docker pull ghcr.io/mtvproof/rats-plusplus:latest

echo ""
echo "🛑 Stopping current container..."
docker stop rustplusbot 2>/dev/null || echo "Container not running"

echo ""
echo "🗑️  Removing old container..."
docker rm rustplusbot 2>/dev/null || echo "Container not found"

echo ""
echo "🚀 Starting updated container..."
# If using Portainer Stack, just restart the stack:
echo "Go to Portainer UI and click 'Update the stack' or run:"
echo "docker-compose up -d"

echo ""
echo "✅ Update complete! Check logs with:"
echo "docker logs -f rustplusbot"
