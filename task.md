# Leaf Herbivory Counter - Development Tasks

## Phase 1: Project Foundation
- [ ] Task 1.1: Initialize Electron project with TypeScript
- [ ] Task 1.2: Set up testing infrastructure (Jest + Playwright)
- [ ] Task 1.3: Configure SQLite with better-sqlite3
- [ ] Task 1.4: Create basic window with image loading capability

## Phase 2: Scale Calibration
- [ ] Task 2.1: Implement line drawing tool for scale calibration
- [ ] Task 2.2: Add scale input dialog (cm value)
- [ ] Task 2.3: Persist scale to database per image

## Phase 3: Polygon Tool
- [ ] Task 3.1: Implement point-and-click vertex placement
- [ ] Task 3.2: Add polygon closing (snap to first vertex)
- [ ] Task 3.3: Add vertex movement capability
- [ ] Task 3.4: Add vertex deletion
- [ ] Task 3.5: Add undo functionality
- [ ] Task 3.6: Add polygon deletion
- [ ] Task 3.7: Support multiple polygons per image

## Phase 4: Grid Overlay System
- [ ] Task 4.1: Calculate grid size from scale factor
- [ ] Task 4.2: Render grid overlay on cropped leaf
- [ ] Task 4.3: Implement user-adjustable grid size
- [ ] Task 4.4: Handle edge cells (partial coverage)

## Phase 5: Cell Classification
- [ ] Task 5.1: Implement cell click detection
- [ ] Task 5.2: Add category state management (absent/present/unsure)
- [ ] Task 5.3: Implement category switching UI (buttons + hotkeys)
- [ ] Task 5.4: Add shift-click shortcut for herbivory absent
- [ ] Task 5.5: Visual styling for each category (colors, borders)
- [ ] Task 5.6: Adjacent cell border merging

## Phase 6: Zoom and Navigation
- [ ] Task 6.1: Implement spacebar zoom toggle (100%/200%)
- [ ] Task 6.2: Zoom centered on cursor position
- [ ] Task 6.3: Add Cmd+drag panning while zoomed
- [ ] Task 6.4: Maintain grid interaction while zoomed

## Phase 7: Workflow Management
- [ ] Task 7.1: Sheet ID input per image
- [ ] Task 7.2: Leaf ID assignment (sequential per sheet)
- [ ] Task 7.3: Researcher name/initials input (required)
- [ ] Task 7.4: Step confirmation buttons
- [ ] Task 7.5: Progress indicators in image grid view
- [ ] Task 7.6: Resume from last position

## Phase 8: Data Export
- [ ] Task 8.1: Calculate area from cell counts + scale
- [ ] Task 8.2: Generate CSV with all required fields
- [ ] Task 8.3: Auto-dated filename
- [ ] Task 8.4: Export button in UI

## Phase 9: Polish & Edge Cases
- [ ] Task 9.1: Handle various image formats (JPEG, PNG, HEIC)
- [ ] Task 9.2: Error handling for corrupted images
- [ ] Task 9.3: Confirmation dialogs for destructive actions
- [ ] Task 9.4: Scale reset warning (loses cell work)
