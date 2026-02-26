#!/bin/bash

# RATS++ Startup Diagnostic Script
# This helps diagnose bot startup issues

echo "========================================="
echo "RATS++ Startup Diagnostic"
echo "========================================="
echo ""

# Check network connectivity
echo "[1/6] Checking network connectivity..."
if ping -c 2 discord.com &> /dev/null; then
    echo "✓ Can reach discord.com"
else
    echo "✗ FAILED: Cannot reach discord.com"
    echo "  This is likely causing your bot hangs!"
    echo "  Check your network connection."
fi
echo ""

# Check DNS resolution
echo "[2/6] Checking DNS resolution..."
if nslookup discord.com &> /dev/null; then
    echo "✓ DNS resolution working"
else
    echo "✗ FAILED: DNS resolution not working"
    echo "  Your Pi may not have proper DNS configured."
fi
echo ""

# Check if bot is already running
echo "[3/6] Checking for already running instances..."
BOT_PROCESSES=$(pgrep -f "node.*index" | wc -l)
if [ $BOT_PROCESSES -gt 0 ]; then
    echo "⚠ WARNING: Found $BOT_PROCESSES bot process(es) already running"
    echo "  Running PIDs: $(pgrep -f 'node.*index' | tr '\n' ' ')"
    echo "  Kill them with: pkill -f 'node.*index'"
    echo ""
    echo "  Multiple instances can cause hangs due to:"
    echo "  - Port conflicts"
    echo "  - Rate limiting from Discord"
    echo "  - Resource exhaustion"
else
    echo "✓ No existing bot processes found"
fi
echo ""

# Check system resources
echo "[4/6] Checking system resources..."
MEMORY_FREE=$(free -m | awk 'NR==2{print $7}')
LOAD_AVG=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}')

echo "  Available memory: ${MEMORY_FREE}MB"
echo "  Load average: ${LOAD_AVG}"

if [ $MEMORY_FREE -lt 100 ]; then
    echo "⚠ WARNING: Low memory (less than 100MB free)"
    echo "  This can cause hangs and crashes"
fi
echo ""

# Check config file exists
echo "[5/6] Checking configuration..."
if [ -f "config/index.js" ]; then
    echo "✓ Config file exists"
    
    # Check if using default token (which might be invalid)
    if grep -q "MTM4MDIwODE5OTY4ODI1NzY2OA" config/index.js; then
        echo "⚠ WARNING: Using default Discord token from config"
        echo "  This token may be invalid or expired"
        echo "  Set RPP_DISCORD_TOKEN environment variable with your token"
    fi
else
    echo "✗ FAILED: config/index.js not found"
fi
echo ""

# Check recent logs for errors
echo "[6/6] Checking recent log entries..."
if [ -f "logs/discordBot.log" ]; then
    LAST_LOGIN=$(grep "LOGGED IN AS" logs/discordBot.log | tail -1)
    if [ -n "$LAST_LOGIN" ]; then
        echo "  Last successful login:"
        echo "  $LAST_LOGIN"
    else
        echo "  No successful login found in logs"
    fi
    
    RECENT_ERRORS=$(tail -20 logs/discordBot.log | grep -c "ERROR")
    echo "  Recent errors in last 20 lines: $RECENT_ERRORS"
else
    echo "  No log file found yet"
fi
echo ""

echo "========================================="
echo "Recommendations:"
echo "========================================="
echo "1. Run bot with: npm start 2>&1 | tee startup.log"
echo "   This will show AND save all output"
echo ""
echo "2. If it hangs, check startup.log for the last"
echo "   message before hang"
echo ""
echo "3. Wait 30 seconds - the bot now has a timeout"
echo "   that will show error details"
echo ""
echo "4. Only run ONE bot at a time initially to"
echo "   isolate the issue"
echo "========================================="
