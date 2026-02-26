#!/bin/bash

# Safe bot startup script with proper error handling

echo "========================================="
echo "Starting RATS++ Bot (Safe Mode)"
echo "========================================="
echo ""

# Kill any existing instances
EXISTING=$(pgrep -f "node.*index" | wc -l)
if [ $EXISTING -gt 0 ]; then
    echo "⚠ Killing $EXISTING existing bot process(es)..."
    pkill -f "node.*index"
    sleep 2
fi

# Run diagnostic first
echo "Running pre-flight diagnostics..."
echo ""
./diagnose-startup.sh
echo ""

# Ask for confirmation
read -p "Continue with bot startup? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Startup cancelled."
    exit 1
fi

echo ""
echo "Starting bot with full logging..."
echo "Output will be saved to startup-$(date +%Y%m%d-%H%M%S).log"
echo ""
echo "If bot hangs:"
echo "  - Wait 30 seconds for timeout message"
echo "  - Press Ctrl+C to stop"
echo "  - Check the .log file for details"
echo ""
echo "========================================="
echo ""

# Start with timeout and full logging
npm start 2>&1 | tee "startup-$(date +%Y%m%d-%H%M%S).log"
