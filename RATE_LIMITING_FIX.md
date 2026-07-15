# Rate Limiting Fix - July 15, 2026 (Updated)

## Problem
The bot was experiencing severe rate limiting from the Rust+ API with errors:
- "Tokens did not replenish in time"
- "Timeout reached while waiting for response"
- Frequent Battlemetrics API failures

## Root Cause
The Rust+ API uses a token bucket rate limiting system:
- **24 tokens maximum** (per player)
- **~2 tokens replenish per second** (actual rate accounting for latency)
- Each API request costs 1-5 tokens depending on the endpoint

The bot was making requests too frequently with **burst patterns**:
1. **4 concurrent API calls every poll** - making requests simultaneously without delay
2. **Smart device polling bursts** - checking ALL switches and storage monitors at once every 6 minutes
3. **No request spacing** - requests were made in rapid succession, exhausting the token bucket

## Changes Made (Updated July 15, 2026)

### 1. Aggressive Token Replenishment Reduction (Updated July 15 - Evening)
**File:** `src/structures/RustPlus.js`
- **Changed `TOKENS_REPLENISH` from `2` to `1.0` tokens per second** (down from 1.5)
- This is ULTRA conservative due to constant disconnects observed in production
- Ensures sustainable long-term operation without exhausting tokens

### 2. Extended Token Wait Timeout
**File:** `src/structures/RustPlus.js`
- Increased `waitForAvailableTokens` timeout from 60 seconds to 120 seconds
- Changed timeout counter from 180 iterations to 360 iterations
- Provides more patience for tokens to replenish during high-load periods

### 3. Increased Default Polling Interval (Updated July 15 - Evening)
**File:** `config/index.js`
- **Changed default `pollingIntervalMs` from `12000ms` to `20000ms` (20 seconds)** (up from 15s)
- Reduces baseline API request frequency from ~20/minute to ~12/minute
- More aggressive due to constant rate limiting observed in production

### 4. Request Spacing in Polling Handler
**File:** `src/handlers/pollingHandler.js`
- Added 300ms delays between the 4 main polling requests
- Prevents burst exhaustion of the token bucket
- Spreads requests over ~1.2 seconds instead of firing simultaneously

### 5. Smart Switch Check Spacing
**File:** `src/handlers/smartSwitchHandler.js`
- Added 500ms delays between individual switch health checks
- Prevents token bucket exhaustion when checking many switches
- Reduces burst impact when switch counter hits 0

### 6. Storage Monitor Check Spacing
**File:** `src/handlers/storageMonitorHandler.js`
- Added 500ms delays between individual storage monitor checks
- Prevents token bucket exhaustion when checking many monitors
- Reduces burst impact when monitor counter hits 0

### 7. Updated Docker Configurations
**Files:** `docker-compose.yml`, `portainer-stack.yml`
- Already set `RPP_POLLING_INTERVAL=15000` as recommended
- Updated comments to reflect the new default

### 8. Fixed Team Information Display Race Condition (July 15, 2026 - Evening)
**Files:** `src/handlers/pollingHandler.js`, `src/handlers/informationHandler.js`
- **Problem**: Team members randomly showed as AFK when all were offline
- **Root Cause**: When API requests failed due to rate limiting, `teamInfoValid = false`, but the bot still tried to display team information using stale/partially updated data
- **Fix**: 
  - Store validity flags in `rustplus.lastPollValidityFlags` after each poll
  - Only update team information message when `teamInfoValid = true`
  - Prevents displaying incorrect AFK/online status from stale data during API failures

## New Request Rate (Updated July 15 - Evening)
With the ULTRA conservative settings:
- **20 second polling interval**: ~12 base requests per minute
- **Request spacing**: Spreads 4 requests over 1.2 seconds per poll
- **Device checks**: Spaced 500ms apart when checking all devices
- **Token replenishment**: 1.0 tokens/second = 60 tokens/minute available

This provides a very comfortable safety margin:
- Regular polling (12 tokens/minute base)
- Smart device burst checks (10-20 tokens/minute when triggered)
- User commands and interactions (5-10 tokens/minute)
- Map requests and heavy operations (5 tokens each, occasional)
- **Total: ~30-45 tokens/minute peak usage vs 60 available**

## How to Apply

### Quick Fix (Restart Only)
```bash
# Stop the bot
npm stop  # or docker compose down

# Start the bot
npm start  # or docker compose up -d
```

### For Docker Compose Deployments
```bash
# Rebuild and restart
docker compose down
docker compose build --no-cache
docker compose up -d
```

### For Portainer Deployments
1. Pull the latest image or rebuild the stack
2. Redeploy the stack
3. Or manually set `RPP_POLLING_INTERVAL=20000` for extra safety

## Monitoring
After applying this fix, monitor your logs for:
- ✅ Absence of "Tokens did not replenish in time" errors
- ✅ Absence of "Timeout reached while waiting for response" errors
- ✅ Successful Battlemetrics API requests
- ✅ Normal bot operation with slightly slower updates

## Trade-offs
- **Slower updates**: Information updates every 15 seconds instead of 12 seconds
- **Slightly delayed device checks**: Small delays between checking multiple devices
- **More reliable**: Eliminates rate limiting errors and prevents API bans
- **Better API citizenship**: Respects Rust+ server limits

## Additional Recommendations

If you still experience rate limiting issues:
1. **Increase polling interval** to `20000` (20 seconds): Set `RPP_POLLING_INTERVAL=20000` in environment variables
2. **Reduce smart devices**: Unpair switches/monitors you don't actively use
3. **Disable unused features**: Turn off features that make additional API calls
- Respond to all commands reliably
- Update information consistently without errors
- Stay within rate limits even during peak usage

---
**Note**: These changes affect all users of this bot. If you're running a fork or custom version, ensure you merge these changes to avoid rate limiting issues.
