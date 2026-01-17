// GridOverlay - Grid overlay system for cell classification (Phase 4)
// Feature 4.1: Calculate Grid Size from Scale

import { Point } from '../../shared/types'

// Constants for grid validation
const MIN_GRID_SIZE_MM = 0.1  // Minimum practical grid size
const MAX_GRID_SIZE_MM = 100  // Maximum practical grid size (10 cm)
const DEFAULT_GRID_SIZE_MM = 1  // 1 mm default

/**
 * Calculate grid cell size in pixels from scale factor and desired mm size.
 * Formula: cellSizePx = (pxPerCm / 10) * gridSizeMm
 *   - pxPerCm / 10 gives pixels per mm
 *   - multiply by gridSizeMm to get final pixel size
 * 
 * @param pxPerCm - Scale factor: pixels per centimeter
 * @param gridSizeMm - Desired grid cell size in millimeters
 * @returns Cell size in pixels, or 0 if inputs are invalid
 */
export function calculateCellSize(pxPerCm: number, gridSizeMm: number): number {
    // Validate inputs
    if (pxPerCm <= 0 || gridSizeMm <= 0) {
        return 0
    }

    // pxPerCm / 10 = pixels per mm
    // pixels per mm * gridSizeMm = cell size in pixels
    const pxPerMm = pxPerCm / 10
    return pxPerMm * gridSizeMm
}

/**
 * Get the default grid size in millimeters.
 * @returns Default grid size (1 mm)
 */
export function getDefaultGridSizeMm(): number {
    return DEFAULT_GRID_SIZE_MM
}

/**
 * Validate that a grid size value is acceptable.
 * 
 * @param gridSizeMm - Grid size to validate
 * @returns true if valid, false otherwise
 */
export function validateGridSize(gridSizeMm: number): boolean {
    if (typeof gridSizeMm !== 'number' || isNaN(gridSizeMm)) {
        return false
    }

    if (gridSizeMm <= 0) {
        return false
    }

    if (gridSizeMm < MIN_GRID_SIZE_MM) {
        return false
    }

    if (gridSizeMm > MAX_GRID_SIZE_MM) {
        return false
    }

    return true
}

/**
 * Interface representing a grid cell
 */
export interface GridCell {
    row: number
    col: number
    x: number  // Top-left x coordinate in pixels
    y: number  // Top-left y coordinate in pixels
    width: number
    height: number
    center: Point
}

/**
 * Interface for grid overlay state
 */
export interface GridState {
    gridSizeMm: number
    cellSizePx: number
    cells: GridCell[]
    isVisible: boolean
}

/**
 * Create initial grid state
 */
export function createGridState(gridSizeMm: number = DEFAULT_GRID_SIZE_MM): GridState {
    return {
        gridSizeMm,
        cellSizePx: 0,
        cells: [],
        isVisible: false
    }
}
