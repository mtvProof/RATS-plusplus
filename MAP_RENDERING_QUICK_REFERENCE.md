# RATS-plusplus Map Rendering - Quick Reference

## Key Functions & Their Line Numbers

| Function | Lines | Purpose |
|----------|-------|---------|
| `init()` | 293-315 | Initialize canvases, contexts, and start render loop |
| `handleResize()` | 322-346 | Resize canvases and recalculate transforms |
| `loadMapImage(guildId)` | 1473-1499 | Fetch and load map image from API |
| `startRenderLoop()` | 1798-1821 | Begin main render loop with 60fps throttling |
| `applyTransform()` | 1823-1833 | Set up canvas context transforms |
| `drawStaticLayers()` | 1835-1868 | Render map image, grid, monuments |
| `drawDynamicLayers()` | 1870-1900+ | Render players, trails, markers, events |

---

## Canvas Layer Architecture

```
Dynamic Canvas (Top)
    ↓ Contains: Players, trails, markers, events
    ↓ Redrawn every frame if dirty
    
Static Canvas (Middle)
    ↓ Contains: Grid, monuments, vending machines
    ↓ Redrawn only when static content changes
    
Background Canvas (Bottom)
    ↓ Contains: Map image
    ↓ Redrawn only when pan/zoom changes
```

---

## Map Loading Flow

```
1. Page Load
   ↓
2. constructor() → init()
   ↓
3. init() gets canvas elements and calls startRenderLoop()
   ↓
4. Render loop starts (idle, no map yet)
   ↓
5. User selects server → selectServer(guildId)
   ↓
6. selectServer() → loadMapImage(guildId)
   ↓
7. Fetch `/api/map/{guildId}` as blob
   ↓
8. Image onload:
   - handleResize() → sizes canvases
   - drawStaticLayers() → renders background
   - resetView() → centers map
   ↓
9. Render loop detects dirty flags
   ↓
10. Continuous rendering with pan/zoom updates
```

---

## Transform Stack (Applied in Order)

```javascript
// In drawStaticLayers() and drawDynamicLayers():
ctx.save();
ctx.translate(canvas.width/2, canvas.height/2);     // Center origin
ctx.scale(this.scale, this.scale);                   // Apply zoom
ctx.translate(offsetX - width/2, offsetY - height/2); // Apply pan
// [Draw operations here]
ctx.restore();
```

**Result:** Zoom and pan centered on viewport

---

## Render Loop Throttling (60 FPS)

```javascript
const elapsed = timestamp - this.lastRenderTime;
if (elapsed < 16 && !this.dirtyStatic && !this.dirtyDynamic) {
    // Skip frame - less than 16ms elapsed and nothing changed
    requestAnimationFrame(render);
    return;
}
// Redraw if needed
this.lastRenderTime = timestamp;
```

**Target:** ~60 FPS (16.67ms per frame)
**Actual:** 30-60 FPS depending on dirty flags

---

## Dirty Flag System

| Flag | Triggers Redraw | When Set | When Cleared |
|------|-----------------|----------|--------------|
| `dirtyStatic` | Static canvas | Zoom, pan, settings change | After drawStaticLayers() |
| `dirtyDynamic` | Dynamic canvas | Player update, map data | After drawDynamicLayers() |
| `needsRender` | Dynamic canvas | User interaction | After drawDynamicLayers() |

---

## Canvas Context Properties (After Load)

```javascript
// Set on all contexts in loadMapImage():
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = 'high';
```

**Purpose:** Smooth upscaling/downscaling during zoom operations

---

## Key Properties

| Property | Type | Purpose |
|----------|------|---------|
| `this.mapImage` | Image | The loaded map image object |
| `this.scale` | number | Current zoom level (1.0 = fit to container) |
| `this.baseScale` | number | Scale to fit map entirely in container |
| `this.offsetX`, `this.offsetY` | number | Pan position (world coordinates) |
| `this.worldRect` | object | Maps game world coords to canvas pixels |
| `this.backgroundCanvas` | HTMLElement | Background layer |
| `this.staticCanvas` | HTMLElement | Static elements layer |
| `this.dynamicCanvas` | HTMLElement | Dynamic elements layer |

---

## Example: Zoom Operation

```javascript
// User scrolls mousewheel
zoom(factor) {
    this.scale *= factor;
    this.dirtyStatic = true;      // Mark static layer dirty
    this.dirtyDynamic = true;     // Mark dynamic layer dirty
    this.needsRender = true;      // Flag render
}
// On next render:
// 1. drawStaticLayers() runs (map + grid/monuments at new scale)
// 2. drawDynamicLayers() runs (players + trails at new scale)
// 3. All using same transform with updated this.scale
```

---

## Example: Pan Operation

```javascript
// User drags on map
mousemove event:
    this.offsetX += deltaX / this.scale;
    this.offsetY += deltaY / this.scale;
    this.dirtyDynamic = true;
    this.needsRender = true;

// On next render:
// translate(offsetX - width/2, offsetY - height/2) applies pan
```

---

## Browser Integration

- **Window Resize:** `window.addEventListener('resize', handleResize)`
- **Mouse Events:** Pan, zoom handled on `dynamicCanvas`
- **Wheel Events:** Zoom handled on `#mapWrapper`
- **Animation Loop:** `requestAnimationFrame(render)`

---

## API Endpoints Used

| Endpoint | Method | Returns | When Called |
|----------|--------|---------|------------|
| `/api/guilds` | GET | List of accessible guilds | Page load via `loadGuilds()` |
| `/api/map/{guildId}` | GET | Map image as blob | `selectServer()` → `loadMapImage()` |

---

## Performance Considerations

1. **Three Canvas Layers:** Prevents full redraw on small changes
2. **Dirty Flags:** Only redraws affected layers
3. **60 FPS Throttle:** Limits GPU load
4. **Image Smoothing:** Quality without major performance cost
5. **Context Save/Restore:** Efficient transform management
6. **requestAnimationFrame:** Browser-optimized timing

---

## High-Quality Rendering

The system explicitly avoids CSS transforms (`transform: 'none'`) which cause pixelation. Instead:

1. Canvas context transforms are applied during draw
2. `imageSmoothingQuality = 'high'` ensures smooth scaling
3. Image is redrawn at target scale (not upscaled)
4. Result: Crisp, clear map at all zoom levels
