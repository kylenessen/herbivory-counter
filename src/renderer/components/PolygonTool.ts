import { Point } from '../../shared/types'

export const VERTEX_RADIUS = 6
export const CLOSE_DISTANCE_PX = 10

export class PolygonTool {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private vertices: Point[] = []
  private closed = false
  private onVerticesChanged: ((vertices: Point[]) => void) | null = null
  private onClosedChanged: ((closed: boolean) => void) | null = null
  private onClickBound: (event: MouseEvent) => void

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not get 2D context')
    this.ctx = ctx

    this.onClickBound = this.handleClick.bind(this)
    this.canvas.addEventListener('click', this.onClickBound)
  }

  public destroy(): void {
    this.canvas.removeEventListener('click', this.onClickBound)
  }

  public setOnVerticesChanged(callback: (vertices: Point[]) => void): void {
    this.onVerticesChanged = callback
  }

  public setOnClosedChanged(callback: (closed: boolean) => void): void {
    this.onClosedChanged = callback
  }

  public getVertices(): Point[] {
    return [...this.vertices]
  }

  public isClosed(): boolean {
    return this.closed
  }

  public clear(): void {
    this.vertices = []
    this.closed = false
    this.onClosedChanged?.(this.closed)
    this.onVerticesChanged?.(this.getVertices())
  }

  private getMousePosition(event: MouseEvent): Point {
    const rect = this.canvas.getBoundingClientRect()
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    }
  }

  private handleClick(event: MouseEvent): void {
    if (this.closed) return

    const pos = this.getMousePosition(event)

    if (this.vertices.length >= 3) {
      const first = this.vertices[0]
      const dx = pos.x - first.x
      const dy = pos.y - first.y
      const distSq = dx * dx + dy * dy
      if (distSq <= CLOSE_DISTANCE_PX * CLOSE_DISTANCE_PX) {
        this.closed = true
        this.onClosedChanged?.(this.closed)
        this.onVerticesChanged?.(this.getVertices())
        return
      }
    }

    this.vertices.push(pos)
    this.onVerticesChanged?.(this.getVertices())
  }

  public render(): void {
    const ctx = this.ctx
    if (this.vertices.length === 0) return

    ctx.save()

    // Draw polyline / polygon outline
    if (this.vertices.length >= 2) {
      ctx.beginPath()
      ctx.moveTo(this.vertices[0].x, this.vertices[0].y)
      for (let i = 1; i < this.vertices.length; i++) {
        ctx.lineTo(this.vertices[i].x, this.vertices[i].y)
      }
      if (this.closed && this.vertices.length >= 3) {
        ctx.closePath()
        ctx.fillStyle = 'rgba(255, 107, 107, 0.25)'
        ctx.fill()
      }
      ctx.strokeStyle = '#ff6b6b'
      ctx.lineWidth = 2
      ctx.setLineDash([])
      ctx.stroke()
    }

    // Draw vertices
    for (const vertex of this.vertices) {
      ctx.beginPath()
      ctx.arc(vertex.x, vertex.y, VERTEX_RADIUS, 0, Math.PI * 2)
      ctx.fillStyle = '#ff6b6b'
      ctx.fill()
      ctx.strokeStyle = '#1a1a2e'
      ctx.lineWidth = 2
      ctx.stroke()
    }

    ctx.restore()
  }
}
