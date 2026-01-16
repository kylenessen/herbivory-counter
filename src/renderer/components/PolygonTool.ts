import { Point } from '../../shared/types'

export const VERTEX_RADIUS = 6

export class PolygonTool {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private vertices: Point[] = []
  private onVerticesChanged: ((vertices: Point[]) => void) | null = null
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

  public getVertices(): Point[] {
    return [...this.vertices]
  }

  public clear(): void {
    this.vertices = []
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
    const pos = this.getMousePosition(event)
    this.vertices.push(pos)
    this.onVerticesChanged?.(this.getVertices())
  }

  public render(): void {
    const ctx = this.ctx
    if (this.vertices.length === 0) return

    ctx.save()

    // Draw polyline (open polygon)
    if (this.vertices.length >= 2) {
      ctx.beginPath()
      ctx.moveTo(this.vertices[0].x, this.vertices[0].y)
      for (let i = 1; i < this.vertices.length; i++) {
        ctx.lineTo(this.vertices[i].x, this.vertices[i].y)
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

