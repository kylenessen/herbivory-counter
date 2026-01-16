// ScaleTool - Line drawing tool for scale calibration (Feature 2.1)

import { Point } from '../../shared/types'

// ScaleLine interface for the line state
export interface ScaleLine {
  start: Point
  end: Point
  isComplete: boolean
  isDragging: boolean
  dragTarget: 'start' | 'end' | null
}

// Calculate distance between two points (line length)
export function calculateLineLength(start: Point, end: Point): number {
  const dx = end.x - start.x
  const dy = end.y - start.y
  return Math.sqrt(dx * dx + dy * dy)
}

// Check if a point is near another point (for endpoint detection)
export function isPointNear(point: Point, target: Point, threshold: number): boolean {
  const distance = calculateLineLength(point, target)
  return distance <= threshold
}

// Create initial scale line state
export function createScaleLine(start: Point, end: Point): ScaleLine {
  return {
    start,
    end,
    isComplete: true,
    isDragging: false,
    dragTarget: null
  }
}

// Update line endpoint position
export function updateLineEndpoint(
  line: ScaleLine,
  endpoint: 'start' | 'end',
  newPosition: Point
): ScaleLine {
  return {
    ...line,
    [endpoint]: newPosition
  }
}

// Endpoint radius for hit detection and rendering
export const ENDPOINT_RADIUS = 8
export const ENDPOINT_HIT_THRESHOLD = 15

// ScaleTool class for managing canvas interactions
export class ScaleTool {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private scaleLine: ScaleLine | null = null
  private isDrawing: boolean = false
  private drawStart: Point | null = null
  private onLineComplete: ((line: ScaleLine) => void) | null = null

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not get 2D context')
    this.ctx = ctx

    this.setupEventListeners()
  }

  // Set callback for when line is completed
  public setOnLineComplete(callback: (line: ScaleLine) => void): void {
    this.onLineComplete = callback
  }

  // Get current scale line
  public getScaleLine(): ScaleLine | null {
    return this.scaleLine
  }

  // Set scale line (for restoring from saved state)
  public setScaleLine(line: ScaleLine | null): void {
    this.scaleLine = line
  }

  // Clear the scale line
  public clearLine(): void {
    this.scaleLine = null
    this.isDrawing = false
    this.drawStart = null
  }

  // Get mouse position relative to canvas
  private getMousePosition(event: MouseEvent): Point {
    const rect = this.canvas.getBoundingClientRect()
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    }
  }

  // Setup event listeners for drawing and dragging
  private setupEventListeners(): void {
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this))
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this))
    this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this))
    this.canvas.addEventListener('mouseleave', this.handleMouseLeave.bind(this))
  }

  // Remove event listeners
  public destroy(): void {
    this.canvas.removeEventListener('mousedown', this.handleMouseDown.bind(this))
    this.canvas.removeEventListener('mousemove', this.handleMouseMove.bind(this))
    this.canvas.removeEventListener('mouseup', this.handleMouseUp.bind(this))
    this.canvas.removeEventListener('mouseleave', this.handleMouseLeave.bind(this))
  }

  private handleMouseDown(event: MouseEvent): void {
    const pos = this.getMousePosition(event)

    // Check if clicking on an existing endpoint to drag
    if (this.scaleLine) {
      if (isPointNear(pos, this.scaleLine.start, ENDPOINT_HIT_THRESHOLD)) {
        this.scaleLine = { ...this.scaleLine, isDragging: true, dragTarget: 'start' }
        this.canvas.style.cursor = 'grabbing'
        return
      }
      if (isPointNear(pos, this.scaleLine.end, ENDPOINT_HIT_THRESHOLD)) {
        this.scaleLine = { ...this.scaleLine, isDragging: true, dragTarget: 'end' }
        this.canvas.style.cursor = 'grabbing'
        return
      }
    }

    // Start drawing a new line
    this.isDrawing = true
    this.drawStart = pos
    this.scaleLine = null
  }

  private handleMouseMove(event: MouseEvent): void {
    const pos = this.getMousePosition(event)

    // Dragging an endpoint
    if (this.scaleLine?.isDragging && this.scaleLine.dragTarget) {
      this.scaleLine = updateLineEndpoint(this.scaleLine, this.scaleLine.dragTarget, pos)
      return
    }

    // Drawing a new line
    if (this.isDrawing && this.drawStart) {
      // Create temporary line for preview
      this.scaleLine = {
        start: this.drawStart,
        end: pos,
        isComplete: false,
        isDragging: false,
        dragTarget: null
      }
      return
    }

    // Update cursor based on hover state
    if (this.scaleLine) {
      const nearStart = isPointNear(pos, this.scaleLine.start, ENDPOINT_HIT_THRESHOLD)
      const nearEnd = isPointNear(pos, this.scaleLine.end, ENDPOINT_HIT_THRESHOLD)
      this.canvas.style.cursor = nearStart || nearEnd ? 'grab' : 'crosshair'
    } else {
      this.canvas.style.cursor = 'crosshair'
    }
  }

  private handleMouseUp(event: MouseEvent): void {
    const pos = this.getMousePosition(event)

    // Finish dragging
    if (this.scaleLine?.isDragging) {
      this.scaleLine = { ...this.scaleLine, isDragging: false, dragTarget: null }
      this.canvas.style.cursor = 'grab'
      if (this.onLineComplete) {
        this.onLineComplete(this.scaleLine)
      }
      return
    }

    // Finish drawing
    if (this.isDrawing && this.drawStart) {
      // Only create line if there's meaningful distance
      const length = calculateLineLength(this.drawStart, pos)
      if (length > 10) {
        this.scaleLine = createScaleLine(this.drawStart, pos)
        if (this.onLineComplete) {
          this.onLineComplete(this.scaleLine)
        }
      } else {
        this.scaleLine = null
      }
    }

    this.isDrawing = false
    this.drawStart = null
  }

  private handleMouseLeave(_event: MouseEvent): void {
    // Cancel drawing if mouse leaves canvas
    if (this.isDrawing) {
      this.isDrawing = false
      this.drawStart = null
      if (!this.scaleLine?.isComplete) {
        this.scaleLine = null
      }
    }
  }

  // Render the scale line on the canvas
  public render(): void {
    if (!this.scaleLine) return

    const { start, end, isComplete } = this.scaleLine
    const ctx = this.ctx

    // Save context state
    ctx.save()

    // Draw line
    ctx.beginPath()
    ctx.moveTo(start.x, start.y)
    ctx.lineTo(end.x, end.y)

    if (isComplete) {
      // Completed line: solid with good visibility
      ctx.strokeStyle = '#4ecca3'
      ctx.lineWidth = 2
      ctx.setLineDash([])
    } else {
      // In-progress line: dashed
      ctx.strokeStyle = '#4ecca3'
      ctx.lineWidth = 2
      ctx.setLineDash([8, 4])
    }
    ctx.stroke()

    // Draw endpoints
    this.drawEndpoint(start, this.scaleLine.dragTarget === 'start')
    this.drawEndpoint(end, this.scaleLine.dragTarget === 'end')

    // Display line length
    const length = calculateLineLength(start, end)
    const midX = (start.x + end.x) / 2
    const midY = (start.y + end.y) / 2 - 15

    ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.fillStyle = '#4ecca3'
    ctx.textAlign = 'center'
    ctx.fillText(`${Math.round(length)} px`, midX, midY)

    // Restore context state
    ctx.restore()
  }

  private drawEndpoint(point: Point, isActive: boolean): void {
    const ctx = this.ctx

    // Outer circle
    ctx.beginPath()
    ctx.arc(point.x, point.y, ENDPOINT_RADIUS, 0, Math.PI * 2)
    ctx.fillStyle = isActive ? '#5fd9b4' : '#4ecca3'
    ctx.fill()

    // Inner circle for contrast
    ctx.beginPath()
    ctx.arc(point.x, point.y, ENDPOINT_RADIUS - 3, 0, Math.PI * 2)
    ctx.fillStyle = '#1a1a2e'
    ctx.fill()
  }
}
