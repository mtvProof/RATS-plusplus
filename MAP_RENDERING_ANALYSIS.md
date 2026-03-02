# RATS-plusplus Map Rendering & Initialization Analysis

## Overview
This document details the complete map loading and rendering flow in the RATS-plusplus web UI (`public/app.js`), including canvas setup, image loading, initialization, and the render loop implementation.

---

## 1. Canvas Context Setup & Initialization

### 1.1 Canvas Element Retrieval (Lines 293-298)
```javascript
init() {
    this.backgroundCanvas = document.getElementById('map-background-canvas');
    this.backgroundCtx = this.backgroundCanvas.getContext('2d');
    this.staticCanvas = document.getElementById('map-static-canvas');
    this.staticCtx = this.staticCanvas.getContext('2d');
    this.dynamicCanvas = document.getElementById('map-dynamic-canvas');
    this.dynamicCtx = this.dynamicCanvas.getContext('2d');
```

**Key Points:**
- Three separate canvas layers are used for efficient rendering:
  - **Background Canvas**: Contains the map image
  - **Static Canvas**: Contains static elements (grid, monuments, vending machines)
  - **Dynamic Canvas**: Contains dynamic elements (players, trails, markers)
- 2D canvas contexts are retrieved for each canvas for drawing operations

### 1.2 High-Quality Image Rendering Setup (Lines 1488-1495)
```javascript
// Enable high quality rendering on all contexts
[this.backgroundCtx, this.staticCtx, this.dynamicCtx].forEach(ctx => {
    if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
    }
});
```

**Key Points:**
- Image smoothing is enabled for all contexts to ensure high-quality rendering
- `imageSmoothingQuality` is set to 'high' for optimal visual fidelity
- Applied during map image loading, not just initialization

---

## 2. Map Image Loading

### 2.1 Complete loadMapImage Function (Lines 1473-1497)
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

**Complete Loading Flow:**

1. **Fetch Map Data** (Line 1474)
   - Fetches map image from `/api/map/{guildId}` endpoint
   - Server returns map image as blob data

2. **Create Image Object** (Line 1476)
   - New Image object created to hold the map

3. **Define onload Handler** (Lines 1477-1496)
   - Executes when image finishes loading
   - Stores reference to loaded image: `this.mapImage = img`
   - Marks minimap as dirty for redraw: `this.minimapBaseDirty = true`

4. **Canvas Setup** (Line 1485)
   - Calls `handleResize()` to properly size all canvas elements
   - Ensures canvas dimensions match container

5. **Enable High-Quality Rendering** (Lines 1488-1495)
   - Sets `imageSmoothingEnabled = true` for smooth scaling
   - Sets `imageSmoothingQuality = 'high'` for optimal quality

6. **Draw Initial Content** (Line 1496)
   - Calls `drawStaticLayers()` to render background and static elements

7. **Reset View** (Line 1497)
   - Calls `resetView()` to center and fit map in viewport

8. **Create Object URL** (Line 1499)
   - Converts blob to object URL: `URL.createObjectURL(blob)`
   - Sets as image source: `img.src = ...`

---

## 3. Canvas Resizing & Scaling

### 3.1 handleResize Function (Lines 322-346)
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

**Key Operations:**

1. **Guard Clause** (Line 323)
   - Returns early if map image not loaded

2. **Get Container Dimensions** (Lines 325-327)
   - Gets wrapper element: `document.getElementById('mapWrapper')`
   - Retrieves actual pixel dimensions: `clientWidth` and `clientHeight`

3. **Set Canvas Dimensions** (Lines 329-333)
   - Sets all three canvas elements to container width/height
   - Direct pixel assignment (not CSS sizing)

4. **Calculate Base Scale** (Lines 334-338)
   - Preserves previous zoom ratio: `zoomRatio = this.scale / prevBaseScale`
   - Calculates base scale to fit entire map: `Math.min(containerWidth / this.mapImage.width, containerHeight / this.mapImage.height)`
   - Reapplies zoom ratio to new base scale

5. **Recalculate World Coordinates** (Lines 339-342)
   - Calls `computeWorldRectFromWorldSize()` to map game world coordinates to canvas pixels
   - Uses map image dimensions and server map size

6. **Mark for Redraw** (Lines 344-346)
   - Sets `dirtyStatic = true` to redraw static layers
   - Sets `dirtyDynamic = true` to redraw dynamic layers
   - Sets `needsRender = true` to trigger render loop

---

## 4. Render Loop Implementation

### 4.1 startRenderLoop Function (Lines 1798-1815)
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

**Render Loop Flow:**

1. **Frame Timing Check** (Lines 1802-1807)
   - Calculates elapsed time: `timestamp - this.lastRenderTime`
   - Throttles to ~60 FPS (16ms per frame): `elapsed < 16`
   - Skips rendering if no changes: `!this.dirtyStatic && !this.dirtyDynamic`
   - Returns early if nothing changed

2. **Static Layer Rendering** (Lines 1808-1811)
   - Checks if static layers marked dirty: `if (this.dirtyStatic)`
   - Calls `drawStaticLayers()` to redraw background and monuments
   - Resets dirty flag: `this.dirtyStatic = false`

3. **Dynamic Layer Rendering** (Lines 1812-1819)
   - Checks if dynamic layers need update: `if (this.needsRender || this.dirtyDynamic)`
   - Calls `applyTransform()` to prepare context transforms
   - Calls `drawDynamicLayers()` to redraw players, trails, markers
   - Calls `renderMinimap()` to update minimap display
   - Resets dirty flags and updates timestamp

4. **Continuous Animation** (Line 1820)
   - Requests next animation frame: `requestAnimationFrame(render)`
   - Creates continuous loop using browser's optimal timing

5. **Initial Invocation** (Line 1821)
   - Starts render loop on first call: `requestAnimationFrame(render)`

### 4.2 Transform Application (Lines 1823-1833)
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

**Transform Strategy:**
- **Avoids CSS transforms** which cause pixelation
- **Uses Canvas Context Transforms** instead
- Explicitly sets `transform: 'none'` on canvas CSS
- Marks all layers dirty to force redraw with proper scaling

---

## 5. Static Layer Drawing

### 5.1 drawStaticLayers Function (Lines 1835-1868)
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

**Background Canvas Drawing (Lines 1839-1851):**

1. **Clear Canvas** (Line 1840)
   - `clearRect(0, 0, width, height)` - removes all previous content

2. **Save Context State** (Line 1843)
   - `save()` - stores transform state before modifications

3. **Apply Transforms** (Lines 1846-1848)
   - `translate(width/2, height/2)` - moves origin to center
   - `scale(this.scale, this.scale)` - applies zoom
   - `translate(offsetX - width/2, offsetY - height/2)` - applies pan

4. **Enable High-Quality Rendering** (Lines 1850-1851)
   - Sets `imageSmoothingEnabled = true`
   - Sets `imageSmoothingQuality = 'high'`

5. **Draw Map Image** (Line 1852)
   - `drawImage(this.mapImage, 0, 0)` - renders at current transform

6. **Restore Context** (Line 1854)
   - `restore()` - reverts to saved state

**Static Canvas Drawing (Lines 1856-1868):**

1. **Clear & Setup** (Lines 1856-1859)
   - Same clear and save operations as background

2. **Apply Same Transforms** (Lines 1860-1862)
   - Identical transform sequence for consistency

3. **Conditionally Draw Overlays** (Lines 1863-1867)
   - Grid: `if (this.controls.showGrid) this.drawGrid()`
   - Monuments: `if (this.controls.showMonuments) this.drawMonuments()`
   - Vending: `if (this.controls.showVendingMachines) this.drawVendingMachines()`

4. **Restore** (Line 1868)
   - Reverts context transformations

---

## 6. Complete Initialization Flow (Page Load)

### 6.1 Constructor to Render Loop

**Phase 1: Constructor Initialization** (Lines 1-243)
```javascript
constructor() {
    // Canvas layer initialization
    this.backgroundCanvas = null;
    this.backgroundCtx = null;
    this.staticCanvas = null;
    this.staticCtx = null;
    this.dynamicCanvas = null;
    this.dynamicCtx = null;

    // Pan and zoom state initialization
    this.baseScale = 1;
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    
    // Render state initialization
    this.needsRender = true;
    this.lastRenderTime = 0;
    this.dirtyStatic = true;
    this.dirtyDynamic = true;
    
    // ... [other initialization] ...
    
    this.init();
}
```

**Phase 2: Canvas Initialization** (Lines 293-315)
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
    this.startRenderLoop();  // <-- STARTS RENDER LOOP HERE
    
    // ... [other setup] ...
    
    window.addEventListener('resize', () => this.handleResize());
    this.handleResize();
}
```

**Phase 3: Server Selection & Map Loading** (Lines 879-893)
```javascript
async selectServer(guildId) {
    // ... [authentication check] ...
    
    this.socket.emit('subscribe', guildId);
    this.loadMapImage(guildId);  // <-- LOADS MAP IMAGE
    
    // ... [other setup] ...
}
```

**Phase 4: Map Image Load** (Lines 1473-1499)
```javascript
async loadMapImage(guildId) {
    const response = await fetch(`/api/map/{guildId}`);
    const blob = await response.blob();
    const img = new Image();
    
    img.onload = () => {
        this.mapImage = img;
        this.minimapBaseDirty = true;
        this.handleResize();              // <-- RESIZE CANVAS
        // ... [enable high quality] ...
        this.drawStaticLayers();          // <-- DRAW STATIC
        this.resetView();
    };
    img.src = URL.createObjectURL(blob);
}
```

**Initialization Timeline:**
1. `constructor()` initializes properties
2. `constructor()` calls `init()`
3. `init()` gets canvas elements and contexts
4. `init()` calls `startRenderLoop()` (even though map isn't loaded yet)
5. Render loop enters idle state (no dirty flags from map load)
6. User selects server via `selectServer(guildId)`
7. `selectServer()` calls `loadMapImage(guildId)`
8. `loadMapImage()` fetches image from API
9. Image onload handler fires:
   - Stores image reference
   - Calls `handleResize()` to size canvases
   - Enables high-quality rendering
   - Calls `drawStaticLayers()` to render initial content
   - Calls `resetView()` to center map
10. Render loop detects dirty flags and renders continuously

---

## 7. Canvas Transform Stack Summary

### Transform Order in Drawing Functions

**All drawing functions apply transforms in this order:**

```
1. translate(canvas.width/2, canvas.height/2)  // Move origin to center
2. scale(this.scale, this.scale)                // Apply zoom level
3. translate(offsetX - width/2, offsetY - height/2)  // Apply pan offset
4. [DRAW OPERATIONS]
```

**Effect:** Zoom and pan operations are applied with canvas origin at center of viewport

**Scale Properties:**
- `this.baseScale` = Scale to fit entire map in container
- `this.scale` = Current zoom level (baseScale × user zoom)
- `this.offsetX`, `this.offsetY` = Pan position relative to image center

---

## 8. Dynamic Layer Rendering (Lines 1870-1900+)

The render loop also calls `drawDynamicLayers()` which applies the same transform sequence and then draws:
- Event markers
- Patrol markers
- Team death markers
- Custom markers
- Player trails
- Player positions
- Minimap

All with the same canvas context transforms for consistent positioning.

---

## Summary

The RATS-plusplus map rendering system uses:

1. **Three-Layer Canvas Architecture** for optimal performance
2. **Asynchronous Image Loading** from server API with blob conversion
3. **Context-Based Transforms** instead of CSS for quality rendering
4. **Efficient Dirty-Flag Rendering** to minimize redraws
5. **60 FPS Throttled Render Loop** using requestAnimationFrame
6. **Responsive Canvas Sizing** with handleResize listener
7. **High-Quality Image Smoothing** for smooth zoom/pan
8. **Persistent Transform State** saved and restored for each layer

This architecture allows smooth, responsive map display with minimal GPU usage while maintaining visual quality during pan and zoom operations.
