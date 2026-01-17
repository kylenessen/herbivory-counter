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

/**
 * Check if a point is inside a polygon using ray casting algorithm.
 * 
 * @param point - The point to check
 * @param vertices - Array of polygon vertices
 * @returns true if point is inside the polygon
 */
export function isPointInPolygon(point: Point, vertices: Point[]): boolean {
    if (vertices.length < 3) return false

    let inside = false
    const x = point.x
    const y = point.y

    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
        const xi = vertices[i].x
        const yi = vertices[i].y
        const xj = vertices[j].x
        const yj = vertices[j].y

        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
            inside = !inside
        }
    }

    return inside
}

/**
 * Get the bounding box of a polygon.
 * 
 * @param vertices - Array of polygon vertices
 * @returns Object with minX, minY, maxX, maxY
 */
export function getPolygonBoundingBox(vertices: Point[]): { minX: number; minY: number; maxX: number; maxY: number } {
    if (vertices.length === 0) {
        return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
    }

    let minX = vertices[0].x
    let minY = vertices[0].y
    let maxX = vertices[0].x
    let maxY = vertices[0].y

    for (const v of vertices) {
        if (v.x < minX) minX = v.x
        if (v.y < minY) minY = v.y
        if (v.x > maxX) maxX = v.x
        if (v.y > maxY) maxY = v.y
    }

    return { minX, minY, maxX, maxY }
}

/**
 * Generate grid cells that fall inside a polygon.
 * Only cells whose center is inside the polygon are included.
 * 
 * @param vertices - Polygon vertices
 * @param cellSizePx - Cell size in pixels
 * @returns Array of GridCell objects
 */
export function generateGridCells(vertices: Point[], cellSizePx: number): GridCell[] {
    if (vertices.length < 3 || cellSizePx <= 0) {
        return []
    }

    const bbox = getPolygonBoundingBox(vertices)
    const cells: GridCell[] = []

    // Calculate grid starting position (aligned to bounding box)
    const startX = bbox.minX
    const startY = bbox.minY

    // Calculate number of rows and cols needed
    const numCols = Math.ceil((bbox.maxX - bbox.minX) / cellSizePx)
    const numRows = Math.ceil((bbox.maxY - bbox.minY) / cellSizePx)

    for (let row = 0; row < numRows; row++) {
        for (let col = 0; col < numCols; col++) {
            const x = startX + col * cellSizePx
            const y = startY + row * cellSizePx

            // Calculate cell center
            const center: Point = {
                x: x + cellSizePx / 2,
                y: y + cellSizePx / 2
            }

            // Only include cell if center is inside polygon
            if (isPointInPolygon(center, vertices)) {
                cells.push({
                    row,
                    col,
                    x,
                    y,
                    width: cellSizePx,
                    height: cellSizePx,
                    center
                })
            }
        }
    }

    return cells
}

/**
 * Render the grid overlay on a canvas context.
 * Uses canvas clipping to ensure grid only appears inside polygon.
 * 
 * @param ctx - Canvas 2D rendering context
 * @param cells - Array of grid cells to render
 * @param vertices - Polygon vertices for clipping
 */
export function renderGrid(ctx: CanvasRenderingContext2D, cells: GridCell[], vertices: Point[]): void {
    if (cells.length === 0 || vertices.length < 3) return

    ctx.save()

    // Create clipping path from polygon
    ctx.beginPath()
    ctx.moveTo(vertices[0].x, vertices[0].y)
    for (let i = 1; i < vertices.length; i++) {
        ctx.lineTo(vertices[i].x, vertices[i].y)
    }
    ctx.closePath()
    ctx.clip()

    // Draw grid cells
    for (const cell of cells) {
        // Fill cell with light gray
        ctx.fillStyle = 'rgba(200, 200, 200, 0.3)'
        ctx.fillRect(cell.x, cell.y, cell.width, cell.height)

        // Draw cell border with dark gray
        ctx.strokeStyle = 'rgba(100, 100, 100, 0.6)'
        ctx.lineWidth = 0.5
        ctx.strokeRect(cell.x, cell.y, cell.width, cell.height)
    }

    ctx.restore()
}
