// Unit tests for Scale Tool - Line Drawing Feature 2.1

import {
  calculateLineLength,
  isPointNear,
  createScaleLine,
  updateLineEndpoint,
  calculateScale,
  ScaleLine
} from '../../src/renderer/components/ScaleTool'

describe('Scale Tool - Line Length Calculation', () => {
  test('calculates horizontal line length correctly', () => {
    const start = { x: 100, y: 100 }
    const end = { x: 300, y: 100 }
    const length = calculateLineLength(start, end)
    expect(length).toBe(200)
  })

  test('calculates vertical line length correctly', () => {
    const start = { x: 100, y: 100 }
    const end = { x: 100, y: 250 }
    const length = calculateLineLength(start, end)
    expect(length).toBe(150)
  })

  test('calculates diagonal line length correctly', () => {
    const start = { x: 0, y: 0 }
    const end = { x: 300, y: 400 }
    const length = calculateLineLength(start, end)
    expect(length).toBe(500) // 3-4-5 triangle scaled by 100
  })

  test('handles zero-length line', () => {
    const start = { x: 150, y: 150 }
    const end = { x: 150, y: 150 }
    const length = calculateLineLength(start, end)
    expect(length).toBe(0)
  })

  test('handles negative coordinates', () => {
    const start = { x: -100, y: -50 }
    const end = { x: 100, y: -50 }
    const length = calculateLineLength(start, end)
    expect(length).toBe(200)
  })
})

describe('Scale Tool - Point Proximity Detection', () => {
  test('detects point within threshold', () => {
    const point = { x: 105, y: 103 }
    const target = { x: 100, y: 100 }
    expect(isPointNear(point, target, 10)).toBe(true)
  })

  test('rejects point outside threshold', () => {
    const point = { x: 120, y: 100 }
    const target = { x: 100, y: 100 }
    expect(isPointNear(point, target, 10)).toBe(false)
  })

  test('detects exact match', () => {
    const point = { x: 100, y: 100 }
    const target = { x: 100, y: 100 }
    expect(isPointNear(point, target, 10)).toBe(true)
  })

  test('detects point at exact threshold boundary', () => {
    const point = { x: 110, y: 100 }
    const target = { x: 100, y: 100 }
    expect(isPointNear(point, target, 10)).toBe(true)
  })
})

describe('Scale Tool - Line State Management', () => {
  test('creates scale line with start and end points', () => {
    const start = { x: 100, y: 100 }
    const end = { x: 300, y: 100 }
    const line = createScaleLine(start, end)

    expect(line.start).toEqual(start)
    expect(line.end).toEqual(end)
    expect(line.isComplete).toBe(true)
  })

  test('updates start endpoint position', () => {
    const line = createScaleLine({ x: 100, y: 100 }, { x: 300, y: 100 })
    const newStart = { x: 50, y: 75 }
    const updated = updateLineEndpoint(line, 'start', newStart)

    expect(updated.start).toEqual(newStart)
    expect(updated.end).toEqual({ x: 300, y: 100 }) // unchanged
  })

  test('updates end endpoint position', () => {
    const line = createScaleLine({ x: 100, y: 100 }, { x: 300, y: 100 })
    const newEnd = { x: 350, y: 150 }
    const updated = updateLineEndpoint(line, 'end', newEnd)

    expect(updated.start).toEqual({ x: 100, y: 100 }) // unchanged
    expect(updated.end).toEqual(newEnd)
  })

  test('line length updates after endpoint drag', () => {
    const line = createScaleLine({ x: 100, y: 100 }, { x: 200, y: 100 })
    const initialLength = calculateLineLength(line.start, line.end)
    expect(initialLength).toBe(100)

    const updated = updateLineEndpoint(line, 'end', { x: 400, y: 100 })
    const newLength = calculateLineLength(updated.start, updated.end)
    expect(newLength).toBe(300)
  })
})

describe('Scale Tool - Drawing a line stores start and end coordinates', () => {
  test('drawing a line stores start and end coordinates', () => {
    // Simulate click-drag-release to create line
    const startClick = { x: 100, y: 100 }
    const endRelease = { x: 300, y: 100 }

    const line = createScaleLine(startClick, endRelease)

    expect(line.start).toEqual({ x: 100, y: 100 })
    expect(line.end).toEqual({ x: 300, y: 100 })
  })
})

describe('Scale Tool - Feature 2.2: Scale Calculation', () => {
  test('calculates pixels per cm from line and input', () => {
    const lineLength = 450 // pixels
    const cmValue = 10
    const scale = calculateScale(lineLength, cmValue)
    expect(scale).toBe(45) // px per cm
  })

  test('calculates scale with different values', () => {
    const lineLength = 300 // pixels
    const cmValue = 5
    const scale = calculateScale(lineLength, cmValue)
    expect(scale).toBe(60) // px per cm
  })

  test('handles decimal cm values', () => {
    const lineLength = 450 // pixels
    const cmValue = 10.5
    const scale = calculateScale(lineLength, cmValue)
    expect(scale).toBeCloseTo(42.857, 2)
  })

  test('handles small line lengths', () => {
    const lineLength = 20 // pixels
    const cmValue = 1
    const scale = calculateScale(lineLength, cmValue)
    expect(scale).toBe(20)
  })

  test('returns 0 for zero cm value', () => {
    const lineLength = 450 // pixels
    const cmValue = 0
    const scale = calculateScale(lineLength, cmValue)
    expect(scale).toBe(0)
  })

  test('returns 0 for negative cm value', () => {
    const lineLength = 450 // pixels
    const cmValue = -5
    const scale = calculateScale(lineLength, cmValue)
    expect(scale).toBe(0)
  })
})
