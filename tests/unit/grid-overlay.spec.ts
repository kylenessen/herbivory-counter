// Grid Overlay Unit Tests (Feature 4.1: Calculate Grid Size from Scale)

import { calculateCellSize, getDefaultGridSizeMm, validateGridSize } from '../../src/renderer/components/GridOverlay'

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
