# SAM Site Tracking System - Implementation Summary

## Overview
A complete SAM site tracking system has been implemented for your RATS++ bot that includes:
1. Discord command system (`/samloc`) to manage SAM site locations
2. Real-time helicopter detection based on player movement speed
3. Automatic team chat warnings when helicopters approach SAM sites
4. Live map visualization of SAM site locations (RED markers on WebUI)

---

## Features Implemented

### 1. Discord Command: `/samloc`
**Location:** `src/commands/samloc.js`

#### Subcommands:
```
/samloc add <grid>     - Add a grid with SAM sites (e.g., /samloc add C25)
/samloc list          - List all registered SAM site grids
/samloc remove <grid> - Remove a grid from SAM sites
```

**Example Usage:**
```
/samloc add C25        → SAM site grid C25 has been added.
/samloc list          → Registered SAM site grids: C25, D30, E15
/samloc remove C25    → SAM site grid C25 has been removed.
```

---

### 2. Helicopter Detection System
**Location:** `src/util/samSiteUtils.js`

The system automatically detects when a player is flying a helicopter based on movement speed:
- **Detection Method:** Calculates movement speed per second
- **Helicopter Threshold:** > 12 units/second (walking ~5.7 u/s, running ~9 u/s)
- **Grid-Based Tracking:** Converts x,y coordinates to grid format (A-Z columns, 0-51 rows)

#### Key Functions:
- `isPlayerFlyingHelicopter()` - Detects helicopter movement
- `checkPlayerHeadingTowardSamSite()` - Checks if helicopter approaches SAM site
- `getGridFromCoordinates()` - Converts map coordinates to grid string
- `getAdjacentGrids()` - Gets neighboring grids for proximity detection

---

### 3. Real-Time Warning System
**Location:** `src/handlers/teamHandler.js` (modified)

When a player is flying a helicopter toward a SAM site:

**In-Game Team Chat Message:**
```
@@@ SAM SITE AHEAD, C25 @@@
@@@ SAM SITE AHEAD, C25 @@@
@@@ SAM SITE AHEAD, C25 @@@
```

#### Features:
- **Cooldown System:** 3-second minimum between warnings (prevents spam)
- **Per-Player Tracking:** Individual cooldowns for each team member
- **Adjacent Grid Detection:** Warns about SAM sites in nearby grids too
- **Conditional:** Only activates if SAM sites are registered

---

### 4. Live Map Visualization
**Location:** `src/webserver/WebServer.js` (modified)

SAM site locations are now displayed on your WebUI live map as RED markers:
- **Method:** `getSamSiteMarkers()` converts grid coordinates to map positions
- **Marker Type:** "samSite" with radius visualization
- **Updates:** Real-time updates as SAM sites are added/removed via Discord

---

### 5. Data Storage
**Location:** `src/util/CreateInstanceFile.js` (modified)

SAM site data is automatically stored in your instance configuration:
```json
{
  "samSites": ["C25", "D30", "E15"]
}
```

Data persists across bot restarts.

---

## How It Works - Step by Step

### Adding SAM Sites:
1. Use `/samloc add C25` in Discord
2. Bot saves "C25" to instance configuration
3. Map immediately shows RED marker at C25
4. Team chat warnings enabled for that area

### When Flying a Helicopter:
1. Player movement is tracked every team update
2. System calculates speed (distance / time)
3. If speed > 12 u/s, helicopter flying detected ✓
4. Check if current position matches/adjacent to SAM site grid
5. If yes, send team chat warning (with 3s cooldown)
6. Warning repeats if helicopter continues toward site

### Listing SAM Sites:
1. Use `/samloc list` in Discord
2. Get response: "Registered SAM site grids: C25, D30"

### Removing SAM Sites:
1. Use `/samloc remove C25` in Discord
2. Bot removes "C25" from configuration
3. Map marker disappears
4. Warnings no longer sent for that area

---

## Technical Details

### Grid Coordinate System
- **Rust Map Size:** ~2048x2048 units
- **Grid Square Size:** 50 units each
- **Grid Format:** Letter (A-Z, 26 columns) + Number (0-51, 52 rows)
- **Examples:** A0, C25, Z51

### Speed Calculation
```
Speed (u/s) = Distance Moved / Time Elapsed
Distance = sqrt((x2-x1)² + (y2-y1)²)
```

### Cooldown System
- Tracks last warning time for each player at each SAM site
- Minimum 3 seconds between warnings at same location
- Different locations can have separate timers

---

## Translation Keys Added

The following translation keys have been added to all 12 language files:
- `commandsSamLocDesc` - Command description
- `commandsSamLocAddDesc` - Add subcommand
- `commandsSamLocListDesc` - List subcommand
- `commandsSamLocRemoveDesc` - Remove subcommand
- `commandsSamLocGridDesc` - Grid parameter description
- `samLocAdded` - Success message when SAM site added
- `samLocAlreadyExists` - Error when grid already exists
- `samLocEmpty` - Message when no SAM sites registered
- `samLocList` - List of SAM sites
- `samLocNotFound` - Error when grid to remove not found
- `samLocRemoved` - Success when SAM site removed
- `samSiteWarning` - In-game warning message

---

## Configuration

### Speed Threshold (Helicopter Detection)
**File:** `src/util/samSiteUtils.js` line ~45
```javascript
const helicopterSpeedThreshold = 12; // u/s
```
Adjust this value if helicopters aren't being detected or false positives occur.

### Warning Cooldown
**File:** `src/handlers/teamHandler.js` line ~132
```javascript
if (SamSiteUtils.shouldSendWarning(..., 3)) // 3 seconds
```
Change the `3` to adjust cooldown duration between warnings.

### Grid Square Size
**File:** `src/util/samSiteUtils.js` line ~55
```javascript
const gridSize = 50; // units per grid square
```
Change this if you want larger/smaller grid squares.

---

## Files Modified/Created

### New Files:
- ✅ `src/commands/samloc.js` - SAM location management command
- ✅ `src/util/samSiteUtils.js` - Helicopter detection & SAM utilities

### Modified Files:
- ✅ `src/util/CreateInstanceFile.js` - Added samSites array initialization
- ✅ `src/handlers/teamHandler.js` - Added helicopter detection logic
- ✅ `src/webserver/WebServer.js` - Added SAM site marker rendering
- ✅ All 12 language JSON files - Added translation keys

---

## Next Steps / Customization

### Optional Enhancements:

1. **Adjust Detection Sensitivity:**
   - Modify `helicopterSpeedThreshold` for different sensitivity
   - Adjust `gridSize` for larger/smaller warning zones

2. **Customize Warning Messages:**
   - Edit `samSiteWarning` translation in language files
   - Can add player name, coordinates, etc.

3. **Add Duration Persistence:**
   - SAM sites could have expiration times
   - Add `samSiteExpiry` to instance config

4. **Enhanced UI Visualization:**
   - Color-code markers by age (time added)
   - Show "danger zone" radius visually
   - Add SAM site icons instead of plain markers

5. **Admin Controls:**
   - Restrict `/samloc` command to role permissions
   - Add SAM site enable/disable toggle

---

## Troubleshooting

### Helicopters not being detected:
- Increase `helicopterSpeedThreshold` value (current: 12 u/s)
- Check that SAM sites are registered with `/samloc list`
- Verify player is actually in a helicopter (speed > threshold)

### Too many/few warnings:
- Adjust cooldown: Change `3` in teamHandler.js to different value
- Currently waits 3 seconds between warnings per SAM site

### Markers not showing on map:
- Verify SAM sites added with `/samloc add`
- Check WebUI shows correct guild/server
- Browser cache may need clearing

### Translation errors:
- All 12 languages have been updated
- If missing keys appear, translations follow existing pattern

---

## Summary

Your SAM site tracking system is now fully operational! Players can:
✅ Add/remove SAM site locations via `/samloc` command
✅ See SAM sites displayed as RED markers on the live map
✅ Receive automatic team chat warnings when flying helicopters toward SAM sites
✅ Have location data persist across bot restarts

The system is production-ready and can be customized as needed.
