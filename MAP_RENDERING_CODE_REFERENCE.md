# RATS-plusplus Map Rendering - Complete Code Reference

## 1. Canvas Initialization on Page Load

### Location: Lines 293-315 in `public/app.js`

```javascript
init() {
    this.backgroundCanvas = document.getElementById('map-background-canvas');
    this.backgroundCtx = this.backgroundCanvas.getContext('2d');
    this.staticCanvas = document.getElementById('map-static-canvas');
    this.staticCtx = this.staticCanvas.getContext('2d');
    this.dynamicCanvas = document.getElementById('map-dynamic-canvas');
    this.dynamicCtx = this.dynamicCanvas.getContext('2d');

    this.setupMinimap();
    this.setupSocketConnection();
    this.setupEventListeners();
    this.setupCctvUI();
    this.loadGuilds();
    this.startRenderLoop();

    // Initialize map replay system
    this.mapReplay = new MapReplay(this);

    // Initialize vending manager
    this.vendingManager = new VendingManager(this);

    // Setup statistics button (will be enabled when server is selected)
    this.setupStatisticsButton();

    // Make globally accessible for statistics panel
    window.rustplusUI = this;

    // Add window resize listener
    window.addEventListener('resize', () => this.handleResize());
    this.handleResize();
}
```

**Key Steps:**
1. Gets DOM elements by ID for all three canvas layers
2. Gets 2D rendering context for each canvas
3. Sets up socket connection, event listeners, UI
4. **Calls `startRenderLoop()`** - starts rendering before map is loaded
5. Adds window resize listener
6. Calls `handleResize()` initially

---

## 2. Map Image Loading

### Location: Lines 1473-1499 in `public/app.js`

```javascript
async loadMapImage(guildId) {
    try {
        const response = await fetch(`/api/map/${guildId}`);
        if (!response.ok) throw new Error(`Failed to fetch map: ${response.statusText}`);
        const blob = await response.blob();
        const img = new Image();
        img.onload = () => {
            this.mapImage = img;
            this.minimapBaseDirty = true;

            // Use handleResize to properly size canvases
            this.handleResize();

            // Enable high quality rendering on all contexts
            [this.backgroundCtx, this.staticCtx, this.dynamicCtx].forEach(ctx => {
                if (ctx) {
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                }
            });
            this.drawStaticLayers();
            this.resetView();
        };
        img.src = URL.createObjectURL(blob);
    } catch (error) {
        console.error('Failed to load map:', error);
    }
}
```

**Execution Flow:**

1. **Fetch Request (Line 1474)**
   ```javascript
   const response = await fetch(`/api/map/${guildId}`);
   ```
   - Sends GET request to server API
   - Endpoint: `/api/map/{guildId}`
   - Expected response: Map image file

2. **Error Checking (Line 1475)**
   ```javascript
   if (!response.ok) throw new Error(`Failed to fetch map: ${response.statusText}`);
   ```
   - Verifies HTTP response successful (200-299)
   - Throws if not (e.g., 404, 500)

3. **Blob Conversion (Line 1476)**
   ```javascript
   const blob = await response.blob();
   ```
   - Converts response to binary blob data
   - Blob represents the image file

4. **Image Object Creation (Line 1477)**
   ```javascript
   const img = new Image();
   ```
   - Creates DOM Image element
   - Not displayed on page, used for rendering

5. **Onload Handler Definition (Lines 1478-1496)**
   ```javascript
   img.onload = () => {
       // Executes when image finishes loading
   };
   ```
   - This handler will run asynchronously
   - Only after image data is fully loaded

6. **Store Image Reference (Line 1479)**
   ```javascript
   this.mapImage = img;
   ```
   - Saves loaded image for later use in `drawStaticLayers()`
   - Reference persists for entire session

7. **Mark Minimap Dirty (Line 1480)**
   ```javascript
   this.minimapBaseDirty = true;
   ```
   - Triggers minimap redraw with new map

8. **Resize Canvases (Line 1483)**
   ```javascript
   this.handleResize();
   ```
   - Adjusts canvas sizes to container
   - Calculates proper zoom/pan scales
   - See Section 3 below

9. **Enable High-Quality Rendering (Lines 1488-1495)**
   ```javascript
   [this.backgroundCtx, this.staticCtx, this.dynamicCtx].forEach(ctx => {
       if (ctx) {
           ctx.imageSmoothingEnabled = true;
           ctx.imageSmoothingQuality = 'high';
       }
   });
   ```
   - Loops through all three contexts
   - Enables smooth image interpolation
   - Sets highest quality level
   - Prevents pixelation during zoom

10. **Draw Static Content (Line 1496)**
    ```javascript
    this.drawStaticLayers();
    ```
    - Immediately renders background + static elements
    - Does not wait for render loop
    - Ensures user sees content ASAP

11. **Reset View (Line 1497)**
    ```javascript
    this.resetView();
    ```
    - Centers map in viewport
    - Sets zoom to fit entire map
    - Called `resetView()` implementation

12. **Create Object URL (Line 1499)**
    ```javascript
    img.src = URL.createObjectURL(blob);
    ```
    - Converts blob to usable URL: `blob:http://...`
    - Triggers `onload` handler when ready
    - **This is the last line** - actually initiates loading!

**Important:** The `img.src = URL.createObjectURL(blob)` assignment on line 1499 comes AFTER the onload handler definition. This is intentional - the handler is set before the URL to prevent race conditions.

---

## 3. Canvas Resizing & Transform Calculation

### Location: Lines 322-346 in `public/app.js`

```javascript
handleResize() {
    if (!this.mapImage) return;

    const wrapper = document.getElementById('mapWrapper');
    const containerWidth = wrapper.clientWidth;
    const containerHeight = wrapper.clientHeight;

    // Set canvas dimensions to fill the container
    [this.backgroundCanvas, this.staticCanvas, this.dynamicCanvas].forEach(canvas => {
        canvas.width = containerWidth;
        canvas.height = containerHeight;
    });
    // Compute base scale to fit map image into container
    const prevBaseScale = this.baseScale || 1;
    const zoomRatio = this.scale / prevBaseScale;
    this.baseScale = Math.min(containerWidth / this.mapImage.width, containerHeight / this.mapImage.height);
    this.scale = this.baseScale * zoomRatio;
    // Recalculate world rect based on the original map image size
    if (this.serverData?.info) {
        this.worldRect = this.computeWorldRectFromWorldSize(this.mapImage.width, this.mapImage.height, this.serverData.info.mapSize);
    }
    // Redraw everything
    this.dirtyStatic = true;
    this.dirtyDynamic = true;
    this.needsRender = true;
}
```

**Step-by-Step Explanation:**

1. **Guard Clause (Line 323)**
   ```javascript
   if (!this.mapImage) return;
   ```
   - Exits early if map not loaded yet
   - Prevents errors accessing undefined image

2. **Get Container Element (Line 325)**
   ```javascript
   const wrapper = document.getElementById('mapWrapper');
   ```
   - Gets the div containing all canvas layers
   - This is the "viewport" size

3. **Get Container Dimensions (Lines 326-327)**
   ```javascript
   const containerWidth = wrapper.clientWidth;
   const containerHeight = wrapper.clientHeight;
   ```
   - `clientWidth/Height` = actual pixel dimensions (excluding borders/padding)
   - Represents available space for map display

4. **Resize All Canvas Elements (Lines 329-333)**
   ```javascript
   [this.backgroundCanvas, this.staticCanvas, this.dynamicCanvas].forEach(canvas => {
       canvas.width = containerWidth;
       canvas.height = containerHeight;
   });
   ```
   - **Important:** Setting `canvas.width` and `canvas.height` (not CSS!)
   - Direct pixel assignment to canvas resolution
   - All three layers sized identically
   - **Note:** Setting width/height clears canvas and resets context!

5. **Preserve Zoom Level (Lines 335-337)**
   ```javascript
   const prevBaseScale = this.baseScale || 1;
   const zoomRatio = this.scale / prevBaseScale;
   ```
   - If user zoomed in (e.g., 1.5x), preserve that zoom
   - `zoomRatio = currentZoom / previousBaseScale`

6. **Calculate Base Scale (Line 338)**
   ```javascript
   this.baseScale = Math.min(containerWidth / this.mapImage.width, containerHeight / this.mapImage.height);
   ```
   - Calculates scale needed to fit entire map in container
   - `containerWidth / mapImageWidth` = horizontal fit scale
   - `containerHeight / mapImageHeight` = vertical fit scale
   - Uses minimum to ensure map fits in both dimensions
   - Example: If container is 1200x800 and map is 2000x2000:
     - Horizontal: 1200/2000 = 0.6
     - Vertical: 800/2000 = 0.4
     - baseScale = min(0.6, 0.4) = 0.4

7. **Reapply Zoom (Line 339)**
   ```javascript
   this.scale = this.baseScale * zoomRatio;
   ```
   - If user had zoomed 1.5x before resize
   - New scale = 0.4 * 1.5 = 0.6
   - Maintains user's zoom level relative to fit-all

8. **Recalculate World Coordinates (Lines 340-342)**
   ```javascript
   if (this.serverData?.info) {
       this.worldRect = this.computeWorldRectFromWorldSize(
           this.mapImage.width,
           this.mapImage.height,
           this.serverData.info.mapSize
       );
   }
   ```
   - Maps game world coordinates (0-4000 for 4k map) to canvas pixels
   - Allows converting player position to screen position
   - Only if server data loaded

9. **Mark for Redraw (Lines 344-346)**
   ```javascript
   this.dirtyStatic = true;
   this.dirtyDynamic = true;
   this.needsRender = true;
   ```
   - Flags all layers as needing redraw
   - Next render loop iteration will redraw everything
   - Ensures new canvas size reflected in output

---

## 4. Render Loop with 60 FPS Throttling

### Location: Lines 1798-1821 in `public/app.js`

```javascript
startRenderLoop() {
    const render = (timestamp) => {
        const elapsed = timestamp - this.lastRenderTime;
        // Only render at most 60fps
        if (elapsed < 16 && !this.dirtyStatic && !this.dirtyDynamic) {
            requestAnimationFrame(render);
            return;
        }
        if (this.dirtyStatic) {
            this.drawStaticLayers();
            this.dirtyStatic = false;
        }
        if (this.needsRender || this.dirtyDynamic) {
            this.applyTransform();
            this.drawDynamicLayers();
            this.renderMinimap();
            this.needsRender = false;
            this.dirtyDynamic = false;
            this.lastRenderTime = timestamp;
        }
        requestAnimationFrame(render);
    };
    requestAnimationFrame(render);
}
```

**Detailed Flow:**

1. **Function Definition (Line 1799)**
   ```javascript
   const render = (timestamp) => {
   ```
   - Defines the render function
   - `timestamp` = current DOMHighResTimeStamp (milliseconds since page load)
   - This function will be called by browser on each frame

2. **Calculate Elapsed Time (Line 1800)**
   ```javascript
   const elapsed = timestamp - this.lastRenderTime;
   ```
   - Milliseconds since last render
   - Example: If last render at 1000ms, current at 1020ms → elapsed = 20ms

3. **60 FPS Throttle Check (Line 1802)**
   ```javascript
   if (elapsed < 16 && !this.dirtyStatic && !this.dirtyDynamic) {
   ```
   - 16ms ≈ 60 FPS (1000ms / 60 frames = 16.67ms per frame)
   - Three conditions must ALL be true to skip rendering:
     - `elapsed < 16` = Less than 16ms since last render
     - `!this.dirtyStatic` = Static layer not changed
     - `!this.dirtyDynamic` = Dynamic layer not changed

4. **Skip Render (Lines 1803-1805)**
   ```javascript
   if (/* skip conditions */) {
       requestAnimationFrame(render);
       return;
   }
   ```
   - If all three conditions met, skip this frame
   - Still request next frame
   - Continue loop
   - This prevents >60 FPS rendering

5. **Static Layer Redraw (Lines 1806-1809)**
   ```javascript
   if (this.dirtyStatic) {
       this.drawStaticLayers();
       this.dirtyStatic = false;
   }
   ```
   - Only runs if static layer marked dirty
   - `drawStaticLayers()` renders map image + monuments
   - Clear dirty flag to prevent unnecessary redraws

6. **Dynamic Layer Redraw (Lines 1810-1819)**
   ```javascript
   if (this.needsRender || this.dirtyDynamic) {
       this.applyTransform();
       this.drawDynamicLayers();
       this.renderMinimap();
       this.needsRender = false;
       this.dirtyDynamic = false;
       this.lastRenderTime = timestamp;
   }
   ```
   - Runs if dynamic layer OR general render needed
   - `applyTransform()` sets up canvas context
   - `drawDynamicLayers()` renders players, trails, markers
   - `renderMinimap()` updates minimap
   - Clear both dirty flags
   - Update `lastRenderTime` for next iteration

7. **Request Next Frame (Line 1820)**
   ```javascript
   requestAnimationFrame(render);
   ```
   - Schedules this function to run again on next browser refresh
   - Browser decides timing (usually 60Hz = every 16.67ms)
   - Creates continuous loop

8. **Start Loop (Line 1821)**
   ```javascript
   requestAnimationFrame(render);
   ```
   - First call to start the loop
   - Happens during `init()` even before map loaded

**Performance Impact:**

- **Frame Skip:** If nothing changed and <16ms elapsed → skip rendering
- **GPU Load:** Only active canvases redrawn
- **CPU Efficiency:** Avoid unnecessary work
- **Smooth Motion:** requestAnimationFrame syncs with monitor refresh rate

---

## 5. Static Layer Drawing with Transforms

### Location: Lines 1835-1868 in `public/app.js`

```javascript
drawStaticLayers() {
    if (!this.mapImage) return;

    this.backgroundCtx.clearRect(0, 0, this.backgroundCanvas.width, this.backgroundCanvas.height);

    // Save context state
    this.backgroundCtx.save();

    // Apply zoom and pan transforms
    this.backgroundCtx.translate(this.backgroundCanvas.width / 2, this.backgroundCanvas.height / 2);
    this.backgroundCtx.scale(this.scale, this.scale);
    this.backgroundCtx.translate(this.offsetX - this.mapImage.width / 2, this.offsetY - this.mapImage.height / 2);
    // Use high quality image rendering
    this.backgroundCtx.imageSmoothingEnabled = true;
    this.backgroundCtx.imageSmoothingQuality = 'high';
    this.backgroundCtx.drawImage(this.mapImage, 0, 0);

    this.backgroundCtx.restore();

    this.staticCtx.clearRect(0, 0, this.staticCanvas.width, this.staticCanvas.height);

    this.staticCtx.save();
    this.staticCtx.translate(this.staticCanvas.width / 2, this.staticCanvas.height / 2);
    this.staticCtx.scale(this.scale, this.scale);
    this.staticCtx.translate(this.offsetX - this.mapImage.width / 2, this.offsetY - this.mapImage.height / 2);
    if (this.serverData) {
        if (this.controls.showGrid) this.drawGrid(this.staticCtx);
        if (this.controls.showMonuments) this.drawMonuments(this.staticCtx);
        if (this.controls.showVendingMachines && this.serverData.mapMarkers?.vendingMachines) {
            this.drawVendingMachines(this.staticCtx);
        }
    }

    this.staticCtx.restore();
}
```

**Background Canvas Rendering:**

1. **Guard (Line 1837)**
   ```javascript
   if (!this.mapImage) return;
   ```
   - Exit if map not loaded

2. **Clear Canvas (Line 1839)**
   ```javascript
   this.backgroundCtx.clearRect(0, 0, this.backgroundCanvas.width, this.backgroundCanvas.height);
   ```
   - Removes all previous content
   - Full canvas size: (0,0) to (width, height)

3. **Save Context (Line 1842)**
   ```javascript
   this.backgroundCtx.save();
   ```
   - Saves current transform matrix
   - Allows safe restoration later

4. **Transform: Center Origin (Line 1845)**
   ```javascript
   this.backgroundCtx.translate(this.backgroundCanvas.width / 2, this.backgroundCanvas.height / 2);
   ```
   - Moves origin from (0,0) to center of canvas
   - Example: 1200x800 canvas → origin now at (600, 400)
   - **Why:** Makes zoom centered on viewport

5. **Transform: Apply Zoom (Line 1846)**
   ```javascript
   this.backgroundCtx.scale(this.scale, this.scale);
   ```
   - Multiplies all subsequent drawing by this.scale
   - If scale = 0.5, everything drawn at half size
   - Applied AFTER centering, so zoom is centered

6. **Transform: Apply Pan (Line 1847)**
   ```javascript
   this.backgroundCtx.translate(this.offsetX - this.mapImage.width / 2, 
                               this.offsetY - this.mapImage.height / 2);
   ```
   - `offsetX, offsetY` = center point user is viewing
   - `mapImage.width / 2` = center of map image
   - Result: Pans view to show the offset point at center

7. **Enable Smooth Scaling (Lines 1849-1850)**
   ```javascript
   this.backgroundCtx.imageSmoothingEnabled = true;
   this.backgroundCtx.imageSmoothingQuality = 'high';
   ```
   - Bilinear interpolation for upscaling/downscaling
   - Highest quality algorithm

8. **Draw Map Image (Line 1851)**
   ```javascript
   this.backgroundCtx.drawImage(this.mapImage, 0, 0);
   ```
   - Draws image at (0, 0) with all transforms applied
   - Result: Image scaled and panned correctly

9. **Restore Context (Line 1853)**
   ```javascript
   this.backgroundCtx.restore();
   ```
   - Reverts all transforms
   - Needed for next layer

**Static Canvas Rendering (Lines 1855-1868):**
- Same transform sequence as background
- Instead of `drawImage()`, calls:
  - `drawGrid()` if enabled
  - `drawMonuments()` if enabled
  - `drawVendingMachines()` if enabled

**Transform Stack Order:**

```
Initial State: Identity matrix

After translate(width/2, height/2):
    Origin at center of canvas
    All subsequent operations offset from here

After scale(scale, scale):
    All coordinates multiplied by this.scale
    Combined with translation = zoom centered on viewport

After translate(offsetX - width/2, offsetY - height/2):
    Pans to show (offsetX, offsetY) at center
    User sees pan offset in viewport

Result: Map image appears zoomed and panned correctly
```

---

## 6. Transform Application & Context Setup

### Location: Lines 1823-1833 in `public/app.js`

```javascript
applyTransform() {
    // Don't use CSS transforms - they pixelate everything
    // Instead we'll use canvas context transforms when drawing
    const canvases = [this.backgroundCanvas, this.staticCanvas, this.dynamicCanvas];
    canvases.forEach(c => {
        if (c) c.style.transform = 'none';
    });
    // Mark layers as dirty to redraw at proper scale
    this.dirtyStatic = true;
    this.dirtyDynamic = true;
    this.needsRender = true;
}
```

**Purpose:**
- Ensures CSS transforms not used (they pixelate)
- Canvas context transforms applied instead
- Marks layers dirty to force redraw

**Why Not CSS Transforms:**
- CSS transforms can upscale/downscale entire canvas
- Results in pixelated, blurry appearance
- Canvas context transforms redraw image at target scale
- Results in crisp, clear rendering

---

## Summary Table

| Component | Location | Purpose |
|-----------|----------|---------|
| Constructor | Lines 1-243 | Initialize properties |
| `init()` | Lines 293-315 | Get canvas elements, start loop |
| `handleResize()` | Lines 322-346 | Resize canvases, calculate transforms |
| `loadMapImage()` | Lines 1473-1499 | Fetch map from server, setup rendering |
| `startRenderLoop()` | Lines 1798-1821 | Main render loop with throttling |
| `applyTransform()` | Lines 1823-1833 | Set up context transforms |
| `drawStaticLayers()` | Lines 1835-1868 | Render map image, grid, monuments |
| `drawDynamicLayers()` | Lines 1870-1900+ | Render players, trails, markers |

All functions work together to create a smooth, responsive map display system.
