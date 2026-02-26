# Bot Startup Hang Troubleshooting

## Problem
Your bot starts with `npm start` but hangs with no output, showing:
```
> start
> node index.js run



```

## Root Causes

### 1. **Discord Login Failure (Most Common)**
The bot tries to connect to Discord but fails silently. This happens when:
- Network is unreachable
- Discord API is down
- Invalid/expired Discord token
- DNS resolution fails
- Rate limiting from starting multiple bots simultaneously

### 2. **Already Running Instance**
Another bot instance is already using resources, causing:
- Port conflicts
- Discord rate limiting
- Memory exhaustion

### 3. **System Resource Issues**
Raspberry Pi running low on:
- RAM (causing swap thrashing)
- CPU (high load average)

## Solutions Applied

### Immediate Fixes Added:
1. **Startup Logging** - Now shows:
   - Bot start timestamp
   - Node version
   - Login attempt message
   - Success/failure status

2. **Login Timeout** - Bot exits after 30 seconds if login fails, showing:
   - Error details
   - Possible causes
   - Troubleshooting steps

3. **Better Error Messages** - Login failures now display on console with:
   - Error code and message
   - Specific issue identified
   - Recommended solutions

## How to Use

### Quick Start (Recommended)
```bash
./start-safe.sh
```
This script:
- Runs diagnostics
- Kills existing instances
- Starts bot with full logging
- Saves output to timestamped log file

### Diagnostics Only
```bash
./diagnose-startup.sh
```
Checks:
- Network connectivity
- DNS resolution
- Running processes
- System resources
- Configuration issues
- Recent log errors

### Manual Start with Logging
```bash
npm start 2>&1 | tee startup.log
```

## Common Issues & Fixes

### Issue: "Login timeout after 30 seconds"
**Cause:** Cannot reach Discord API  
**Fix:**
```bash
# Check network
ping discord.com

# Check DNS
nslookup discord.com

# Restart networking
sudo systemctl restart networking
```

### Issue: Bot hangs when starting second instance
**Cause:** Discord rate limiting  
**Fix:** 
- Start bots 60+ seconds apart
- Use different tokens for each bot
- Check if first bot is still running: `ps aux | grep node`

### Issue: "Invalid Discord token"
**Cause:** Token expired or incorrect  
**Fix:**
1. Get new token from Discord Developer Portal
2. Set environment variable:
   ```bash
   export RPP_DISCORD_TOKEN="your_token_here"
   ```
3. Or edit `config/index.js`

### Issue: High memory usage causing hangs
**Cause:** Multiple instances or memory leak  
**Fix:**
```bash
# Check memory
free -h

# Kill all node processes
pkill -f "node.*index"

# Start fresh
./start-safe.sh
```

## Prevention

### For Two Bots on Same Pi:

1. **Stagger Startups** - Don't start both simultaneously
   ```bash
   # Terminal 1
   cd ~/Desktop/bot1
   ./start-safe.sh
   
   # Wait 60 seconds, then Terminal 2
   cd ~/Desktop/bot2  
   ./start-safe.sh
   ```

2. **Use Systemd Services** (Auto-restart on failure)
   ```bash
   sudo systemctl enable ratspp-bot.service
   sudo systemctl start ratspp-bot.service
   ```

3. **Monitor Resources**
   ```bash
   # Install htop if not available
   sudo apt install htop
   
   # Monitor in real-time
   htop
   ```

4. **Check Logs Regularly**
   ```bash
   tail -f logs/discordBot.log
   ```

## What Changed in Code

### index.ts
- Added startup console logs
- Added 30-second login timeout
- Shows clear error messages on console
- Auto-exits on timeout with diagnostic info

### src/structures/DiscordBot.js
- Login failures now print to console
- Detailed error messages by error type
- Troubleshooting steps in error output
- Process exits on login failure (no silent hang)

## Next Steps

1. Run `./diagnose-startup.sh` to check your system
2. Use `./start-safe.sh` to start bot with diagnostics
3. If it hangs:
   - Wait 30 seconds for timeout error
   - Read the error message
   - Check `startup-YYYYMMDD-HHMMSS.log` file
   - Apply suggested fixes

4. For persistent issues:
   - Check Discord status: https://discordstatus.com
   - Verify network: `ping discord.com`
   - Review full logs: `tail -100 logs/discordBot.log`
   - Ensure only one instance running: `pgrep -f "node.*index"`

## Questions?

Check the main docs:
- [Installation Guide](docs/installation.md)
- [FAQ](FAQ.md)
- [Discord Bot Setup](docs/discord_bot_setup.md)
