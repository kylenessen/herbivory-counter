// Grid Overlay Unit Tests (Feature 4.1: Calculate Grid Size from Scale)

import { calculateCellSize, getDefaultGridSizeMm, validateGridSize, isPointInPolygon, getPolygonBoundingBox, generateGridCells } from '../../src/renderer/components/GridOverlay'

describe('GridOverlay - Feature 4.1: Calculate Grid Size from Scale', () => {
    describe('calculateCellSize', () => {
        test('calculates grid cell size in pixels from scale and mm', () => {
            const pxPerCm = 45 // 45 pixels = 1 cm
            const gridSizeMm = 1 // 1 mm cells
            const cellSizePx = calculateCellSize(pxPerCm, gridSizeMm)
            expect(cellSizePx).toBe(4.5) // 45 px/cm * 0.1 cm/mm * 1 mm
        })

        test('calculates larger cells correctly', () => {
            const pxPerCm = 45
            const gridSizeMm = 2 // 2 mm cells
            const cellSizePx = calculateCellSize(pxPerCm, gridSizeMm)
            expect(cellSizePx).toBe(9) // 45 px/cm * 0.1 cm/mm * 2 mm
        })

        test('handles different scale values', () => {
            const pxPerCm = 100 // 100 pixels = 1 cm
            const gridSizeMm = 1
            const cellSizePx = calculateCellSize(pxPerCm, gridSizeMm)
            expect(cellSizePx).toBe(10) // 100 px/cm * 0.1 cm/mm * 1 mm
        })

        test('handles fractional mm values', () => {
            const pxPerCm = 50
            const gridSizeMm = 0.5 // 0.5 mm cells
            const cellSizePx = calculateCellSize(pxPerCm, gridSizeMm)
            expect(cellSizePx).toBe(2.5) // 50 px/cm * 0.1 cm/mm * 0.5 mm
        })

        test('returns 0 for invalid scale (0 or negative)', () => {
            expect(calculateCellSize(0, 1)).toBe(0)
            expect(calculateCellSize(-10, 1)).toBe(0)
        })

        test('returns 0 for invalid grid size (0 or negative)', () => {
            expect(calculateCellSize(45, 0)).toBe(0)
            expect(calculateCellSize(45, -1)).toBe(0)
        })
    })

    describe('getDefaultGridSizeMm', () => {
        test('returns 1 mm as default grid size', () => {
            expect(getDefaultGridSizeMm()).toBe(1)
        })
    })

    describe('validateGridSize', () => {
        test('accepts valid positive grid sizes', () => {
            expect(validateGridSize(1)).toBe(true)
            expect(validateGridSize(2)).toBe(true)
            expect(validateGridSize(0.5)).toBe(true)
            expect(validateGridSize(10)).toBe(true)
        })

        test('rejects zero and negative values', () => {
            expect(validateGridSize(0)).toBe(false)
            expect(validateGridSize(-1)).toBe(false)
            expect(validateGridSize(-0.5)).toBe(false)
        })

        test('rejects NaN', () => {
            expect(validateGridSize(NaN)).toBe(false)
        })

        test('rejects very large values (practical limit)', () => {
            // Grid cells larger than 100mm (10cm) are impractical
            expect(validateGridSize(100)).toBe(true)
            expect(validateGridSize(101)).toBe(false)
        })

        test('rejects very small values (practical limit)', () => {
            // Grid cells smaller than 0.1mm are impractical
            expect(validateGridSize(0.1)).toBe(true)
            expect(validateGridSize(0.09)).toBe(false)
        })
    })
})

describe('GridOverlay - Feature 4.2: Render Grid Inside Polygon Only', () => {
    describe('isPointInPolygon', () => {
        const square = [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 100 },
            { x: 0, y: 100 }
        ]

        test('returns true for point inside polygon', () => {
            expect(isPointInPolygon({ x: 50, y: 50 }, square)).toBe(true)
        })

        test('returns false for point outside polygon', () => {
            expect(isPointInPolygon({ x: 150, y: 50 }, square)).toBe(false)
            expect(isPointInPolygon({ x: -10, y: 50 }, square)).toBe(false)
        })

        test('handles point on left edge (ray casting behavior)', () => {
            // Ray casting algorithm behavior on exact edges is implementation-specific
            // Our implementation considers points on the left edge as inside
            expect(isPointInPolygon({ x: 0, y: 50 }, square)).toBe(true)
        })

        test('returns false for empty polygon', () => {
            expect(isPointInPolygon({ x: 50, y: 50 }, [])).toBe(false)
        })

        test('returns false for polygon with less than 3 vertices', () => {
            expect(isPointInPolygon({ x: 50, y: 50 }, [{ x: 0, y: 0 }, { x: 100, y: 100 }])).toBe(false)
        })

        test('works with triangle', () => {
            const triangle = [
                { x: 50, y: 0 },
                { x: 100, y: 100 },
                { x: 0, y: 100 }
            ]
            expect(isPointInPolygon({ x: 50, y: 60 }, triangle)).toBe(true)
            expect(isPointInPolygon({ x: 10, y: 10 }, triangle)).toBe(false)
        })
    })

    describe('getPolygonBoundingBox', () => {
        test('returns correct bounding box for square', () => {
            const square = [
                { x: 10, y: 20 },
                { x: 110, y: 20 },
                { x: 110, y: 120 },
                { x: 10, y: 120 }
            ]
            const bbox = getPolygonBoundingBox(square)
            expect(bbox.minX).toBe(10)
            expect(bbox.minY).toBe(20)
            expect(bbox.maxX).toBe(110)
            expect(bbox.maxY).toBe(120)
        })

        test('returns zeros for empty polygon', () => {
            const bbox = getPolygonBoundingBox([])
            expect(bbox.minX).toBe(0)
            expect(bbox.minY).toBe(0)
            expect(bbox.maxX).toBe(0)
            expect(bbox.maxY).toBe(0)
        })

        test('works with single point', () => {
            const bbox = getPolygonBoundingBox([{ x: 50, y: 60 }])
            expect(bbox.minX).toBe(50)
            expect(bbox.maxX).toBe(50)
            expect(bbox.minY).toBe(60)
            expect(bbox.maxY).toBe(60)
        })
    })

    describe('generateGridCells', () => {
        const square = [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 100 },
            { x: 0, y: 100 }
        ]

        test('generates cells only inside polygon', () => {
            const cells = generateGridCells(square, 10)

            // All cells should have centers inside the polygon
            for (const cell of cells) {
                expect(isPointInPolygon(cell.center, square)).toBe(true)
            }
        })

        test('cell count changes with cell size', () => {
            const cells10 = generateGridCells(square, 10)
            const cells20 = generateGridCells(square, 20)

            // More cells with smaller size
            expect(cells10.length).toBeGreaterThan(cells20.length)
        })

        test('cells have correct dimensions', () => {
            const cellSize = 10
            const cells = generateGridCells(square, cellSize)

            for (const cell of cells) {
                expect(cell.width).toBe(cellSize)
                expect(cell.height).toBe(cellSize)
            }
        })

        test('cell center is calculated correctly', () => {
            const cells = generateGridCells(square, 10)

            for (const cell of cells) {
                expect(cell.center.x).toBe(cell.x + 5)
                expect(cell.center.y).toBe(cell.y + 5)
            }
        })

        test('returns empty array for invalid inputs', () => {
            expect(generateGridCells([], 10)).toEqual([])
            expect(generateGridCells(square, 0)).toEqual([])
            expect(generateGridCells(square, -5)).toEqual([])
        })

        test('returns empty for polygon with less than 3 vertices', () => {
            expect(generateGridCells([{ x: 0, y: 0 }, { x: 100, y: 100 }], 10)).toEqual([])
        })

        test('cells have row and column numbers', () => {
            const cells = generateGridCells(square, 20)

            for (const cell of cells) {
                expect(typeof cell.row).toBe('number')
                expect(typeof cell.col).toBe('number')
                expect(cell.row).toBeGreaterThanOrEqual(0)
                expect(cell.col).toBeGreaterThanOrEqual(0)
            }
        })
    })
})

