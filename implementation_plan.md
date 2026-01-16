# Leaf Herbivory Counter - Implementation Plan

## Problem Statement

Researchers need to quantify herbivory (insect damage) on leaves from ~170 photos. Each photo contains leaves on white paper with a ruler for scale and a handwritten ID. The tool must enable efficient, consistent measurement across all images.

## Technical Architecture

### Stack
- **Framework**: Electron (cross-platform desktop app)
- **Language**: TypeScript
- **Database**: SQLite via `better-sqlite3`
- **Testing**: Jest (unit/component) + Playwright (E2E)
- **Canvas**: HTML5 Canvas API for image manipulation

### Project Structure
```
herbivory-counter/
├── src/
│   ├── main/           # Electron main process
│   │   ├── index.ts
│   │   └── database.ts
│   ├── renderer/       # UI code
│   │   ├── index.html
│   │   ├── app.ts
│   │   ├── components/
│   │   │   ├── ImageCanvas.ts
│   │   │   ├── PolygonTool.ts
│   │   │   ├── ScaleTool.ts
│   │   │   ├── GridOverlay.ts
│   │   │   └── CategoryPanel.ts
│   │   └── styles/
│   └── shared/         # Shared types and utilities
│       ├── types.ts
│       └── calculations.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── package.json
└── electron-builder.yml
```

### Database Schema
```sql
-- Images table
CREATE TABLE images (
  id INTEGER PRIMARY KEY,
  filepath TEXT UNIQUE NOT NULL,
  sheet_id TEXT,
  scale_px_per_cm REAL,
  scale_line_start_x REAL,
  scale_line_start_y REAL,
  scale_line_end_x REAL,
  scale_line_end_y REAL,
  scale_cm_value REAL,
  completed BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Polygons (leaves) table
CREATE TABLE polygons (
  id INTEGER PRIMARY KEY,
  image_id INTEGER NOT NULL,
  leaf_id TEXT NOT NULL,  -- e.g., "01", "02"
  vertices TEXT NOT NULL,  -- JSON array of {x, y}
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (image_id) REFERENCES images(id)
);

-- Cell classifications table
CREATE TABLE cells (
  id INTEGER PRIMARY KEY,
  polygon_id INTEGER NOT NULL,
  grid_row INTEGER NOT NULL,
  grid_col INTEGER NOT NULL,
  category TEXT NOT NULL,  -- 'absent', 'present', 'unsure'
  researcher TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (polygon_id) REFERENCES polygons(id)
);

-- App state table
CREATE TABLE app_state (
  key TEXT PRIMARY KEY,
  value TEXT
);
```

---

## Task Specifications

Each task follows the TDD pattern: **write tests → implement → verify → commit**.

---

### Phase 1: Project Foundation

#### Task 1.1: Initialize Electron Project

**Description**: Set up a new Electron project with TypeScript, basic build configuration, and dev tooling.

**Acceptance Criteria**:
- [ ] `npm run dev` starts the app with hot reload
- [ ] `npm run build` creates distributable for current platform
- [ ] TypeScript compiles without errors
- [ ] Basic window opens with "Hello World"

**Test Cases**:
```typescript
// tests/e2e/app.spec.ts
test('app window opens', async () => {
  const window = await electronApp.firstWindow();
  expect(await window.title()).toBe('Herbivory Counter');
});
```

**Implementation Notes**:
- Use `electron-forge` or `electron-vite` for scaffolding
- Configure `electron-builder` for packaging
- Set up path aliases for clean imports

---

#### Task 1.2: Set Up Testing Infrastructure

**Description**: Configure Jest for unit tests and Playwright for E2E tests.

**Acceptance Criteria**:
- [ ] `npm test` runs all unit tests
- [ ] `npm run test:e2e` runs Playwright tests against built app
- [ ] Coverage reporting enabled
- [ ] Tests run in CI (GitHub Actions)

**Test Cases**:
```typescript
// tests/unit/example.spec.ts
test('test infrastructure works', () => {
  expect(1 + 1).toBe(2);
});
```

**Implementation Notes**:
- Use `@playwright/test` with Electron support
- Configure Jest with `ts-jest`
- Add `.github/workflows/test.yml`

---

#### Task 1.3: Configure SQLite

**Description**: Set up SQLite database creation and basic operations.

**Acceptance Criteria**:
- [ ] Database file created in selected directory
- [ ] All tables created on first run
- [ ] Basic CRUD operations work
- [ ] Database persists between app restarts

**Test Cases**:
```typescript
// tests/unit/database.spec.ts
test('creates database file in target directory', () => {
  const db = initDatabase('/tmp/test-dir');
  expect(fs.existsSync('/tmp/test-dir/herbivory.db')).toBe(true);
});

test('creates all required tables', () => {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  expect(tables.map(t => t.name)).toContain('images');
  expect(tables.map(t => t.name)).toContain('polygons');
  expect(tables.map(t => t.name)).toContain('cells');
});
```

**Implementation Notes**:
- Use `better-sqlite3` (synchronous, simpler)
- Database path stored in `app_state` table
- Wrap in a `Database` class for clean API

---

#### Task 1.4: Basic Image Loading

**Description**: Open a directory picker and display images in a grid view.

**Acceptance Criteria**:
- [ ] "Open Folder" button triggers native directory picker
- [ ] Grid view shows thumbnails of all images
- [ ] Supported formats: JPEG, PNG, HEIC
- [ ] Clicking thumbnail opens full image view
- [ ] Image paths stored in database

**Test Cases**:
```typescript
// tests/e2e/image-loading.spec.ts
test('loads images from selected directory', async () => {
  await page.click('[data-testid="open-folder"]');
  // Mock file dialog to return test directory
  await expect(page.locator('.image-thumbnail')).toHaveCount(3);
});
```

**Implementation Notes**:
- Use `dialog.showOpenDialog` with `properties: ['openDirectory']`
- Lazy-load thumbnails for performance
- Filter files by extension

---

### Phase 2: Scale Calibration

#### Task 2.1: Line Drawing Tool

**Description**: Implement a draggable line tool for selecting scale reference points.

**Acceptance Criteria**:
- [ ] Click and drag creates a line on the canvas
- [ ] Line endpoints are draggable after creation
- [ ] Line persists visually until confirmed
- [ ] Coordinates stored temporarily in state

**Test Cases**:
```typescript
test('drawing a line stores start and end coordinates', async () => {
  await canvas.click({ position: { x: 100, y: 100 } });
  await canvas.click({ position: { x: 300, y: 100 } });
  const line = await page.evaluate(() => window.scaleLine);
  expect(line.start).toEqual({ x: 100, y: 100 });
  expect(line.end).toEqual({ x: 300, y: 100 });
});
```

**Implementation Notes**:
- Use Canvas 2D context for drawing
- Store line state in component, not DB until confirmed
- Visual: dashed line with circular endpoints

---

#### Task 2.2: Scale Input Dialog

**Description**: After drawing line, prompt user for the real-world length in cm.

**Acceptance Criteria**:
- [ ] Dialog appears after line is drawn
- [ ] Input field with default value of 10 cm
- [ ] "Confirm" button calculates and stores scale
- [ ] Scale displayed on screen (e.g., "1 cm = 45 px")

**Test Cases**:
```typescript
test('calculates pixels per cm from line and input', () => {
  const lineLength = 450; // pixels
  const cmValue = 10;
  const scale = calculateScale(lineLength, cmValue);
  expect(scale).toBe(45); // px per cm
});
```

**Implementation Notes**:
- Line length: Euclidean distance between endpoints
- Formula: `px_per_cm = lineLength / cmValue`

---

#### Task 2.3: Persist Scale to Database

**Description**: Save scale calibration data to the images table.

**Acceptance Criteria**:
- [ ] Scale factor saved when confirmed
- [ ] Line coordinates saved for re-display
- [ ] Scale persists across app restarts
- [ ] Scale displayed when reopening image

**Test Cases**:
```typescript
test('scale persists in database', () => {
  saveScale(imageId, { pxPerCm: 45, line: {...} });
  const loaded = getScale(imageId);
  expect(loaded.pxPerCm).toBe(45);
});
```

---

### Phase 3: Polygon Tool

#### Task 3.1: Point-and-Click Vertex Placement

**Description**: Click on canvas to place polygon vertices.

**Acceptance Criteria**:
- [ ] Each click adds a vertex
- [ ] Vertices displayed as circles
- [ ] Lines connect vertices in order
- [ ] Polygon outline shown but not filled until closed

**Test Cases**:
```typescript
test('clicking adds vertices to polygon', async () => {
  await canvas.click({ position: { x: 100, y: 100 } });
  await canvas.click({ position: { x: 200, y: 100 } });
  await canvas.click({ position: { x: 150, y: 200 } });
  const vertices = await getPolygonVertices();
  expect(vertices).toHaveLength(3);
});
```

---

#### Task 3.2: Polygon Closing

**Description**: Close polygon by clicking near the first vertex.

**Acceptance Criteria**:
- [ ] Clicking within 10px of first vertex closes polygon
- [ ] Closed polygon shows filled with semi-transparent color
- [ ] "Polygon complete" state triggered
- [ ] Prevents adding more vertices to closed polygon

**Test Cases**:
```typescript
test('clicking near first vertex closes polygon', async () => {
  // Add 3 vertices, then click near first
  await canvas.click({ position: { x: 100, y: 100 } });
  await canvas.click({ position: { x: 200, y: 100 } });
  await canvas.click({ position: { x: 150, y: 200 } });
  await canvas.click({ position: { x: 102, y: 98 } }); // Near first
  expect(await isPolygonClosed()).toBe(true);
});
```

---

#### Task 3.3: Vertex Movement

**Description**: Drag existing vertices to adjust polygon shape.

**Acceptance Criteria**:
- [ ] Hovering over vertex shows move cursor
- [ ] Dragging vertex updates polygon in real-time
- [ ] Works on both open and closed polygons

**Test Cases**:
```typescript
test('dragging vertex updates polygon', async () => {
  await createClosedPolygon();
  await dragVertex(0, { x: 50, y: 50 });
  const vertices = await getPolygonVertices();
  expect(vertices[0]).toEqual({ x: 50, y: 50 });
});
```

---

#### Task 3.4: Vertex Deletion

**Description**: Delete a vertex from the polygon.

**Acceptance Criteria**:
- [ ] Right-click or Delete key on selected vertex removes it
- [ ] Minimum 3 vertices required for closed polygon
- [ ] Adjacent vertices reconnect automatically

**Test Cases**:
```typescript
test('deleting vertex updates polygon', async () => {
  await createPolygonWithVertices(4);
  await deleteVertex(1);
  expect(await getPolygonVertices()).toHaveLength(3);
});

test('cannot delete below 3 vertices', async () => {
  await createPolygonWithVertices(3);
  await deleteVertex(0);
  expect(await getPolygonVertices()).toHaveLength(3); // Still 3
});
```

---

#### Task 3.5: Undo Functionality

**Description**: Implement undo for polygon operations.

**Acceptance Criteria**:
- [ ] Cmd+Z undoes last operation
- [ ] Undo stack includes: add vertex, move vertex, delete vertex
- [ ] Undo works across multiple operations

**Test Cases**:
```typescript
test('undo reverts last vertex addition', async () => {
  await addVertex({ x: 100, y: 100 });
  await addVertex({ x: 200, y: 200 });
  await undo();
  expect(await getPolygonVertices()).toHaveLength(1);
});
```

---

#### Task 3.6: Polygon Deletion

**Description**: Delete an entire polygon.

**Acceptance Criteria**:
- [ ] Delete button or Backspace removes selected polygon
- [ ] Confirmation dialog before deletion
- [ ] Deleting polygon also deletes associated cells from DB

**Test Cases**:
```typescript
test('deleting polygon removes it from canvas and DB', async () => {
  await createClosedPolygon();
  await deletePolygon();
  expect(await getPolygonCount()).toBe(0);
  expect(await getCellCount()).toBe(0);
});
```

---

#### Task 3.7: Multiple Polygons Per Image

**Description**: Support multiple leaves (polygons) on a single image.

**Acceptance Criteria**:
- [ ] "New Leaf" button starts a new polygon
- [ ] Each polygon gets sequential leaf ID (01, 02, etc.)
- [ ] Clicking existing polygon selects it for editing
- [ ] All polygons persist to database

**Test Cases**:
```typescript
test('multiple polygons have unique leaf IDs', async () => {
  await createClosedPolygon(); // Leaf 01
  await startNewPolygon();
  await createClosedPolygon(); // Leaf 02
  const polygons = await getPolygons();
  expect(polygons.map(p => p.leafId)).toEqual(['01', '02']);
});
```

---

### Phase 4: Grid Overlay System

#### Task 4.1: Calculate Grid Size from Scale

**Description**: Compute grid cell size in pixels based on user-defined mm and scale factor.

**Acceptance Criteria**:
- [ ] Default grid size: 1 mm²
- [ ] User can adjust grid size (input field)
- [ ] Grid size updates dynamically

**Test Cases**:
```typescript
test('calculates grid cell size in pixels', () => {
  const pxPerCm = 45; // 45 pixels = 1 cm
  const gridSizeMm = 1; // 1 mm cells
  const cellSizePx = calculateCellSize(pxPerCm, gridSizeMm);
  expect(cellSizePx).toBe(4.5); // 45 px/cm * 0.1 cm/mm
});
```

---

#### Task 4.2: Render Grid Overlay

**Description**: Draw grid on the cropped leaf polygon.

**Acceptance Criteria**:
- [ ] Grid only appears inside polygon boundary
- [ ] Cells outside polygon are not rendered
- [ ] Default style: dark gray borders, light gray fill
- [ ] Grid recalculates on window resize

**Test Cases**:
```typescript
test('grid cells are contained within polygon', async () => {
  const cells = await getGridCells();
  for (const cell of cells) {
    expect(isPointInPolygon(cell.center, polygon)).toBe(true);
  }
});
```

**Implementation Notes**:
- Use Canvas clipping path set to polygon
- Iterate grid by bounding box, check each cell center

---

#### Task 4.3: User-Adjustable Grid Size

**Description**: Allow user to change grid cell size (mm).

**Acceptance Criteria**:
- [ ] Input field for grid size in mm
- [ ] Changing value triggers grid recalculation
- [ ] Cell classifications reset when grid size changes (with warning)

**Test Cases**:
```typescript
test('changing grid size updates cell count', async () => {
  await setGridSize(1); // 1mm
  const count1 = await getCellCount();
  await setGridSize(2); // 2mm
  const count2 = await getCellCount();
  expect(count2).toBeLessThan(count1);
});
```

---

#### Task 4.4: Edge Cell Handling

**Description**: Cells partially outside polygon are treated as full cells.

**Acceptance Criteria**:
- [ ] Cell is included if center is inside polygon
- [ ] Edge cells are clickable and classifiable
- [ ] Consistent behavior across all polygons

**Test Cases**:
```typescript
test('edge cells are included when center is inside', () => {
  const cell = { x: 95, y: 100, width: 10, height: 10 }; // Center at 100, 105
  const polygon = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
  expect(shouldIncludeCell(cell, polygon)).toBe(true);
});
```

---

### Phase 5: Cell Classification

#### Task 5.1: Cell Click Detection

**Description**: Detect which grid cell was clicked.

**Acceptance Criteria**:
- [ ] Click anywhere in cell triggers classification
- [ ] Works at all zoom levels
- [ ] Visual feedback on hover

**Test Cases**:
```typescript
test('clicking cell returns correct row and column', async () => {
  const cell = await clickCellAt({ x: 150, y: 150 });
  expect(cell.row).toBe(2);
  expect(cell.col).toBe(3);
});
```

---

#### Task 5.2: Category State Management

**Description**: Track classification state for each cell.

**Acceptance Criteria**:
- [ ] Three categories: `absent`, `present`, `unsure`
- [ ] Default: all cells are `absent`
- [ ] State persists to database

**Test Cases**:
```typescript
test('cell category toggles correctly', async () => {
  setActiveCategory('present');
  await clickCell(0, 0);
  expect(await getCellCategory(0, 0)).toBe('present');
  
  setActiveCategory('unsure');
  await clickCell(0, 0);
  expect(await getCellCategory(0, 0)).toBe('unsure');
});
```

---

#### Task 5.3: Category Switching UI

**Description**: UI for selecting active classification category.

**Acceptance Criteria**:
- [ ] Buttons for each category (absent, present, unsure)
- [ ] Hotkeys: 1 = absent, 2 = present, 3 = unsure
- [ ] Active category highlighted
- [ ] Category shown near cursor while classifying

**Test Cases**:
```typescript
test('pressing 2 sets active category to present', async () => {
  await page.keyboard.press('2');
  expect(await getActiveCategory()).toBe('present');
});
```

---

#### Task 5.4: Shift-Click Shortcut

**Description**: Shift-click always sets cell to `absent` regardless of active category.

**Acceptance Criteria**:
- [ ] Shift-click sets cell to `absent`
- [ ] Works regardless of current active category
- [ ] Can be used to quickly "erase" mistakes

**Test Cases**:
```typescript
test('shift-click sets cell to absent', async () => {
  setActiveCategory('present');
  await clickCell(0, 0);
  expect(await getCellCategory(0, 0)).toBe('present');
  
  await shiftClickCell(0, 0);
  expect(await getCellCategory(0, 0)).toBe('absent');
});
```

---

#### Task 5.5: Visual Styling for Categories

**Description**: Distinct visual styles for each category.

**Acceptance Criteria**:
- [ ] `absent`: light gray fill, dark gray border
- [ ] `present`: green fill (e.g., `#4CAF50` at 50% opacity)
- [ ] `unsure`: yellow fill (e.g., `#FFC107` at 50% opacity)
- [ ] Colors configurable (nice to have)

**Test Cases**:
```typescript
test('present cells render green', async () => {
  await markCellAs(0, 0, 'present');
  const color = await getCellFillColor(0, 0);
  expect(color).toBe('rgba(76, 175, 80, 0.5)');
});
```

---

#### Task 5.6: Adjacent Cell Border Merging

**Description**: Adjacent cells of the same category merge interior borders.

**Acceptance Criteria**:
- [ ] Outer perimeter of contiguous region has thick border
- [ ] Interior borders become thin or invisible
- [ ] Creates clear "blob" visualization

**Test Cases**:
```typescript
test('adjacent cells share borders', async () => {
  await markCellAs(0, 0, 'present');
  await markCellAs(0, 1, 'present');
  const borderBetween = await getBorderThickness(0, 0, 'right');
  expect(borderBetween).toBeLessThan(2); // Thin interior border
});
```

**Implementation Notes**:
- Check each cell's neighbors when rendering
- Only draw border on edge if neighbor is different category

---

### Phase 6: Zoom and Navigation

#### Task 6.1: Spacebar Zoom Toggle

**Description**: Toggle between default view and zoomed view with spacebar.

**Acceptance Criteria**:
- [ ] Tap spacebar: toggle zoom
- [ ] Default view: leaf fills frame
- [ ] Zoomed view: 100% or 200% (configurable)

**Test Cases**:
```typescript
test('spacebar toggles zoom', async () => {
  expect(await getZoomLevel()).toBe('fit');
  await page.keyboard.press('Space');
  expect(await getZoomLevel()).toBe('100%');
  await page.keyboard.press('Space');
  expect(await getZoomLevel()).toBe('fit');
});
```

---

#### Task 6.2: Zoom Centered on Cursor

**Description**: Zoom centers on mouse cursor position.

**Acceptance Criteria**:
- [ ] Zoom focuses on where cursor is located
- [ ] Smooth transition (optional)
- [ ] Grid remains aligned after zoom

**Test Cases**:
```typescript
test('zoom centers on cursor position', async () => {
  await canvas.hover({ position: { x: 300, y: 200 } });
  await page.keyboard.press('Space');
  const center = await getViewportCenter();
  expect(center.x).toBeCloseTo(300, 10);
  expect(center.y).toBeCloseTo(200, 10);
});
```

---

#### Task 6.3: Cmd+Drag Panning

**Description**: While zoomed, hold Cmd and drag to pan the view.

**Acceptance Criteria**:
- [ ] Only works when zoomed in
- [ ] Smooth panning follows mouse movement
- [ ] Cursor changes to grab/grabbing

**Test Cases**:
```typescript
test('cmd+drag pans the view', async () => {
  await zoomIn();
  const initialOffset = await getViewOffset();
  await page.keyboard.down('Meta');
  await canvas.dragTo({ x: 100, y: 0 });
  await page.keyboard.up('Meta');
  const newOffset = await getViewOffset();
  expect(newOffset.x).toBe(initialOffset.x - 100);
});
```

---

#### Task 6.4: Grid Interaction While Zoomed

**Description**: All grid interactions work correctly while zoomed.

**Acceptance Criteria**:
- [ ] Clicking cells works at any zoom level
- [ ] Cell detection accounts for zoom transform
- [ ] Hover states work correctly

**Test Cases**:
```typescript
test('cell clicks work when zoomed', async () => {
  await zoomIn();
  await panTo({ x: 200, y: 200 });
  await clickCell(5, 5);
  expect(await getCellCategory(5, 5)).toBe('present');
});
```

---

### Phase 7: Workflow Management

#### Task 7.1: Sheet ID Input

**Description**: Text input for the handwritten sheet ID.

**Acceptance Criteria**:
- [ ] Required before proceeding to polygon step
- [ ] Persisted to database
- [ ] Editable after initial entry

**Test Cases**:
```typescript
test('sheet ID is required', async () => {
  await clickNextStep();
  expect(await page.locator('.error')).toHaveText('Sheet ID required');
});
```

---

#### Task 7.2: Leaf ID Assignment

**Description**: Automatic sequential IDs for leaves within a sheet.

**Acceptance Criteria**:
- [ ] First leaf: "01", second: "02", etc.
- [ ] Displayed on polygon and in UI
- [ ] Full ID format: `{sheetId}-{leafId}` (e.g., "A123-01")

**Test Cases**:
```typescript
test('leaf IDs increment sequentially', async () => {
  await createPolygon();
  expect(await getCurrentLeafId()).toBe('01');
  await createPolygon();
  expect(await getCurrentLeafId()).toBe('02');
});
```

---

#### Task 7.3: Researcher Identification

**Description**: Required name/initials input for attribution.

**Acceptance Criteria**:
- [ ] Input field always visible
- [ ] Required before any cell classification
- [ ] Persisted with each cell classification
- [ ] Remembered across session

**Test Cases**:
```typescript
test('researcher name required for classification', async () => {
  await clearResearcherName();
  await clickCell(0, 0);
  expect(await page.locator('.error')).toHaveText('Enter researcher name');
});
```

---

#### Task 7.4: Step Confirmation Buttons

**Description**: Explicit confirmation required at each workflow step.

**Acceptance Criteria**:
- [ ] "Confirm Scale" button after scale calibration
- [ ] "Confirm Polygons" button after leaf outlines
- [ ] "Confirm Leaf" button after classifying each leaf
- [ ] Confirmation saves state and advances workflow

**Test Cases**:
```typescript
test('confirming scale advances to polygon step', async () => {
  await setScale();
  await page.click('[data-testid="confirm-scale"]');
  expect(await getCurrentStep()).toBe('polygons');
});
```

---

#### Task 7.5: Progress Indicators

**Description**: Visual indicators of completion status in grid view.

**Acceptance Criteria**:
- [ ] Overlay icons: checkmark (complete), partial (in progress), empty (not started)
- [ ] Filter/sort by status
- [ ] Count summary (e.g., "45/170 complete")

**Test Cases**:
```typescript
test('completed images show checkmark', async () => {
  await completeImage(0);
  const status = await getImageStatus(0);
  expect(status).toBe('complete');
});
```

---

#### Task 7.6: Resume from Last Position

**Description**: App remembers last working image and reopens there.

**Acceptance Criteria**:
- [ ] Last image ID stored in `app_state`
- [ ] On reopen, navigates to that image
- [ ] If all complete, shows grid view

**Test Cases**:
```typescript
test('reopening app resumes last image', async () => {
  await openImage(5);
  await closeApp();
  await reopenApp();
  expect(await getCurrentImageIndex()).toBe(5);
});
```

---

### Phase 8: Data Export

#### Task 8.1: Area Calculation

**Description**: Calculate actual area in mm² from cell counts and scale.

**Acceptance Criteria**:
- [ ] Formula: `area_mm2 = cellCount * (gridSizeMm)²`
- [ ] Separate totals for absent, present, unsure
- [ ] Herbivory percentage calculated

**Test Cases**:
```typescript
test('calculates area correctly', () => {
  const cellCount = 100;
  const gridSizeMm = 1;
  const area = calculateArea(cellCount, gridSizeMm);
  expect(area).toBe(100); // 100 mm²
});

test('calculates herbivory percentage', () => {
  const totalCells = 100;
  const herbivoryCells = 25;
  const percentage = calculateHerbivoryPercent(herbivoryCells, totalCells);
  expect(percentage).toBe(25);
});
```

---

#### Task 8.2: CSV Generation

**Description**: Generate CSV file with all measurement data.

**Acceptance Criteria**:
- [ ] Columns: sheet_id, leaf_id, total_area_mm2, herbivory_area_mm2, unsure_area_mm2, herbivory_percent, scale_px_per_cm, grid_size_mm, researcher
- [ ] One row per leaf
- [ ] Sorted by sheet_id, then leaf_id

**Test Cases**:
```typescript
test('CSV contains expected columns', async () => {
  const csv = await generateCSV();
  const headers = csv.split('\n')[0];
  expect(headers).toContain('sheet_id');
  expect(headers).toContain('herbivory_area_mm2');
});
```

---

#### Task 8.3: Auto-Dated Filename

**Description**: Export filename includes date.

**Acceptance Criteria**:
- [ ] Format: `herbivory_export_YYYY-MM-DD.csv`
- [ ] Saved in same directory as images
- [ ] Increments if file exists (e.g., `_1`, `_2`)

**Test Cases**:
```typescript
test('filename includes current date', () => {
  const filename = generateExportFilename();
  const today = new Date().toISOString().split('T')[0];
  expect(filename).toContain(today);
});
```

---

#### Task 8.4: Export Button

**Description**: UI button to trigger CSV export.

**Acceptance Criteria**:
- [ ] Button visible in grid view
- [ ] Shows success message with file path
- [ ] Disabled if no completed leaves

**Test Cases**:
```typescript
test('export button generates CSV', async () => {
  await completeAllImages();
  await page.click('[data-testid="export-csv"]');
  expect(fs.existsSync('./herbivory_export_*.csv')).toBe(true);
});
```

---

### Phase 9: Polish & Edge Cases

#### Task 9.1: Handle Various Image Formats

**Description**: Support common camera image formats.

**Acceptance Criteria**:
- [ ] JPEG, PNG work natively
- [ ] HEIC converted on load (or use Sharp library)
- [ ] Unsupported formats show error

**Test Cases**:
```typescript
test('loads HEIC images', async () => {
  await loadImage('sample.heic');
  expect(await isImageDisplayed()).toBe(true);
});
```

---

#### Task 9.2: Error Handling

**Description**: Graceful handling of corrupted or unreadable images.

**Acceptance Criteria**:
- [ ] Corrupted image shows error overlay
- [ ] User can skip to next image
- [ ] Error logged but doesn't crash app

**Test Cases**:
```typescript
test('corrupted image shows error', async () => {
  await loadImage('corrupted.jpg');
  expect(await page.locator('.error-overlay')).toBeVisible();
});
```

---

#### Task 9.3: Confirmation Dialogs

**Description**: Warn before destructive actions.

**Acceptance Criteria**:
- [ ] Confirm before deleting polygon
- [ ] Confirm before changing scale (resets cells)
- [ ] Confirm before closing unsaved work

**Test Cases**:
```typescript
test('deleting polygon requires confirmation', async () => {
  await deletePolygon();
  expect(await page.locator('.confirm-dialog')).toBeVisible();
});
```

---

#### Task 9.4: Scale Reset Warning

**Description**: Warn that changing scale loses cell classifications.

**Acceptance Criteria**:
- [ ] If cells exist, show warning before scale change
- [ ] Option to cancel
- [ ] Proceeding clears all cells for that image

**Test Cases**:
```typescript
test('changing scale with existing cells shows warning', async () => {
  await classifyCells();
  await clickEditScale();
  expect(await page.locator('.warning-dialog')).toContainText('lose classifications');
});
```

---

## Development Workflow for Agents

Each agent session should:

1. **Read** `task.md` to find the next unchecked item
2. **Mark** that item as `[/]` (in progress)
3. **Read** this plan for that task's specification
4. **Write tests** as specified in the task
5. **Implement** until tests pass
6. **Commit** with message: `feat(component): description`
7. **Mark** item as `[x]` in `task.md`
8. **Report** completion and any blockers

### Agent Prompt Template

```
You are implementing the Herbivory Counter application.

Current task: [TASK NAME FROM TASK.MD]

Specification: [PASTE TASK SECTION FROM THIS DOCUMENT]

Instructions:
1. First, write the test cases specified above
2. Run tests to confirm they fail
3. Implement the feature
4. Run tests to confirm they pass
5. Commit your changes
6. Update task.md to mark this task complete
```

---

## Verification Plan

### Automated Tests
- Unit tests: Jest for all calculation and state logic
- E2E tests: Playwright for full user workflows
- Run: `npm test` and `npm run test:e2e`

### Manual Verification
- Test with sample images (variety of leaf shapes, lighting conditions)
- Verify CSV output is usable in R
- Test on macOS and Windows

### Acceptance Testing
- Process 10 sample images end-to-end
- Verify: scale accuracy, polygon precision, cell counts
- Generate CSV and confirm data integrity
