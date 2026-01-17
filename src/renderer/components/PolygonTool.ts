import { Point } from '../../shared/types'

export const VERTEX_RADIUS = 6
export const CLOSE_DISTANCE_PX = 10
const DRAG_START_THRESHOLD_PX = 2
const DEFAULT_CURSOR = 'crosshair'

type PolygonSnapshot = {
  vertices: Point[]
  closed: boolean
}

export class PolygonTool {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private vertices: Point[] = []
  private closed = false
  private undoStack: PolygonSnapshot[] = []
  private selectedIndex: number | null = null
  private dragCandidateIndex: number | null = null
  private draggingIndex: number | null = null
  private dragStartPos: Point | null = null
  private pendingDragUndoSnapshot: PolygonSnapshot | null = null
  private pendingDragVertexIndex: number | null = null
  private pendingDragOriginalVertex: Point | null = null
  private suppressNextClick = false
  private onVerticesChanged: ((vertices: Point[]) => void) | null = null
  private onClosedChanged: ((closed: boolean) => void) | null = null
  private onDeletePolygonRequested: (() => void) | null = null
  private onClickBound: (event: MouseEvent) => void
  private onMouseDownBound: (event: MouseEvent) => void
  private onMouseMoveBound: (event: MouseEvent) => void
  private onMouseUpBound: (event: MouseEvent) => void
  private onMouseLeaveBound: (event: MouseEvent) => void
  private onContextMenuBound: (event: MouseEvent) => void
  private onKeyDownBound: (event: KeyboardEvent) => void

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not get 2D context')
    this.ctx = ctx
    this.canvas.tabIndex = 0

    this.onClickBound = this.handleClick.bind(this)
    this.onMouseDownBound = this.handleMouseDown.bind(this)
    this.onMouseMoveBound = this.handleMouseMove.bind(this)
    this.onMouseUpBound = this.handleMouseUp.bind(this)
    this.onMouseLeaveBound = this.handleMouseLeave.bind(this)
    this.onContextMenuBound = this.handleContextMenu.bind(this)
    this.onKeyDownBound = this.handleKeyDown.bind(this)

    this.canvas.addEventListener('click', this.onClickBound)
    this.canvas.addEventListener('mousedown', this.onMouseDownBound)
    this.canvas.addEventListener('mousemove', this.onMouseMoveBound)
    this.canvas.addEventListener('mouseup', this.onMouseUpBound)
    this.canvas.addEventListener('mouseleave', this.onMouseLeaveBound)
    this.canvas.addEventListener('contextmenu', this.onContextMenuBound)
    window.addEventListener('keydown', this.onKeyDownBound)
  }

  public destroy(): void {
    this.canvas.removeEventListener('click', this.onClickBound)
    this.canvas.removeEventListener('mousedown', this.onMouseDownBound)
    this.canvas.removeEventListener('mousemove', this.onMouseMoveBound)
    this.canvas.removeEventListener('mouseup', this.onMouseUpBound)
    this.canvas.removeEventListener('mouseleave', this.onMouseLeaveBound)
    this.canvas.removeEventListener('contextmenu', this.onContextMenuBound)
    window.removeEventListener('keydown', this.onKeyDownBound)
  }

  public setOnVerticesChanged(callback: (vertices: Point[]) => void): void {
    this.onVerticesChanged = callback
  }

  public setOnClosedChanged(callback: (closed: boolean) => void): void {
    this.onClosedChanged = callback
  }

  public setOnDeletePolygonRequested(callback: () => void): void {
    this.onDeletePolygonRequested = callback
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
    this.undoStack = []
    this.selectedIndex = null
    this.dragCandidateIndex = null
    this.draggingIndex = null
    this.dragStartPos = null
    this.pendingDragUndoSnapshot = null
    this.pendingDragVertexIndex = null
    this.pendingDragOriginalVertex = null
    this.suppressNextClick = false
    this.setCursor(DEFAULT_CURSOR)
    this.onClosedChanged?.(this.closed)
    this.onVerticesChanged?.(this.getVertices())
  }

  public loadPolygon(vertices: Point[], closed: boolean): void {
    this.vertices = vertices.map((v) => ({ x: v.x, y: v.y }))
    this.closed = closed
    this.undoStack = []
    this.selectedIndex = null
    this.dragCandidateIndex = null
    this.draggingIndex = null
    this.dragStartPos = null
    this.pendingDragUndoSnapshot = null
    this.pendingDragVertexIndex = null
    this.pendingDragOriginalVertex = null
    this.suppressNextClick = false
    this.setCursor(DEFAULT_CURSOR)
    this.onClosedChanged?.(this.closed)
    this.onVerticesChanged?.(this.getVertices())
  }

  private setCursor(cursor: string): void {
    if (this.canvas.style.cursor !== cursor) {
      this.canvas.style.cursor = cursor
    }
  }

  private getMousePosition(event: MouseEvent): Point {
    const rect = this.canvas.getBoundingClientRect()
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    }
  }

  private findVertexIndexAtPosition(pos: Point, radiusPx = VERTEX_RADIUS): number {
    const radiusSq = radiusPx * radiusPx
    for (let i = 0; i < this.vertices.length; i++) {
      const v = this.vertices[i]
      const dx = pos.x - v.x
      const dy = pos.y - v.y
      if (dx * dx + dy * dy <= radiusSq) return i
    }
    return -1
  }

  private createSnapshot(): PolygonSnapshot {
    return {
      vertices: this.vertices.map((v) => ({ x: v.x, y: v.y })),
      closed: this.closed
    }
  }

  private pushUndoSnapshot(snapshot: PolygonSnapshot): void {
    this.undoStack.push({
      vertices: snapshot.vertices.map((v) => ({ x: v.x, y: v.y })),
      closed: snapshot.closed
    })
  }

  private restoreSnapshot(snapshot: PolygonSnapshot): void {
    this.vertices = snapshot.vertices.map((v) => ({ x: v.x, y: v.y }))
    this.closed = snapshot.closed
    this.selectedIndex = null
    this.dragCandidateIndex = null
    this.draggingIndex = null
    this.dragStartPos = null
    this.pendingDragUndoSnapshot = null
    this.pendingDragVertexIndex = null
    this.pendingDragOriginalVertex = null
    this.suppressNextClick = false
    this.setCursor(DEFAULT_CURSOR)
    this.onClosedChanged?.(this.closed)
    this.onVerticesChanged?.(this.getVertices())
  }

  private undo(): void {
    const snapshot = this.undoStack.pop()
    if (!snapshot) return
    this.restoreSnapshot(snapshot)
  }

  private commitPendingDragUndoSnapshot(): void {
    if (!this.pendingDragUndoSnapshot) return
    if (this.pendingDragVertexIndex === null || !this.pendingDragOriginalVertex) {
      this.pendingDragUndoSnapshot = null
      this.pendingDragVertexIndex = null
      this.pendingDragOriginalVertex = null
      return
    }

    const idx = this.pendingDragVertexIndex
    const current = this.vertices[idx]
    const original = this.pendingDragOriginalVertex
    const moved = current && (current.x !== original.x || current.y !== original.y)

    if (moved) {
      this.pushUndoSnapshot(this.pendingDragUndoSnapshot)
    }

    this.pendingDragUndoSnapshot = null
    this.pendingDragVertexIndex = null
    this.pendingDragOriginalVertex = null
  }

  private handleMouseDown(event: MouseEvent): void {
    this.canvas.focus()
    const pos = this.getMousePosition(event)
    const idx = this.findVertexIndexAtPosition(pos)
    if (idx !== -1) {
      this.selectedIndex = idx
      this.dragCandidateIndex = idx
      this.dragStartPos = pos
      this.pendingDragUndoSnapshot = this.createSnapshot()
      this.pendingDragVertexIndex = idx
      this.pendingDragOriginalVertex = { x: this.vertices[idx].x, y: this.vertices[idx].y }
      this.setCursor('move')
      return
    }

    this.selectedIndex = null
    this.dragCandidateIndex = null
    this.dragStartPos = null
    this.pendingDragUndoSnapshot = null
    this.pendingDragVertexIndex = null
    this.pendingDragOriginalVertex = null
  }

  private handleMouseMove(event: MouseEvent): void {
    const pos = this.getMousePosition(event)

    if (this.draggingIndex !== null) {
      this.vertices[this.draggingIndex] = pos
      this.onVerticesChanged?.(this.getVertices())
      this.setCursor('move')
      return
    }

    if (this.dragCandidateIndex !== null && this.dragStartPos) {
      const dx = pos.x - this.dragStartPos.x
      const dy = pos.y - this.dragStartPos.y
      if (dx * dx + dy * dy >= DRAG_START_THRESHOLD_PX * DRAG_START_THRESHOLD_PX) {
        this.draggingIndex = this.dragCandidateIndex
        this.dragCandidateIndex = null
        this.vertices[this.draggingIndex] = pos
        this.onVerticesChanged?.(this.getVertices())
        this.setCursor('move')
        return
      }
    }

    const hoveredIndex = this.findVertexIndexAtPosition(pos)
    this.setCursor(hoveredIndex !== -1 ? 'move' : DEFAULT_CURSOR)
  }

  private handleMouseUp(event: MouseEvent): void {
    if (this.draggingIndex !== null) {
      const pos = this.getMousePosition(event)
      this.vertices[this.draggingIndex] = pos
      this.draggingIndex = null
      this.dragCandidateIndex = null
      this.dragStartPos = null
      this.commitPendingDragUndoSnapshot()
      this.suppressNextClick = true
      this.onVerticesChanged?.(this.getVertices())
      this.setCursor(DEFAULT_CURSOR)
      return
    }

    this.dragCandidateIndex = null
    this.dragStartPos = null
    this.pendingDragUndoSnapshot = null
    this.pendingDragVertexIndex = null
    this.pendingDragOriginalVertex = null
  }

  private handleMouseLeave(_event: MouseEvent): void {
    this.dragCandidateIndex = null
    this.dragStartPos = null
    if (this.draggingIndex !== null) {
      this.draggingIndex = null
      this.commitPendingDragUndoSnapshot()
      this.onVerticesChanged?.(this.getVertices())
    }
    this.pendingDragUndoSnapshot = null
    this.pendingDragVertexIndex = null
    this.pendingDragOriginalVertex = null
    this.setCursor(DEFAULT_CURSOR)
  }

  private canDeleteVertex(): boolean {
    return this.vertices.length > 3
  }

  private deleteVertex(index: number): boolean {
    if (index < 0 || index >= this.vertices.length) return false
    if (!this.canDeleteVertex()) return false

    this.pushUndoSnapshot(this.createSnapshot())
    this.vertices.splice(index, 1)
    this.selectedIndex = null
    this.dragCandidateIndex = null
    this.draggingIndex = null
    this.dragStartPos = null

    this.onVerticesChanged?.(this.getVertices())
    return true
  }

  private handleContextMenu(event: MouseEvent): void {
    event.preventDefault()
    const pos = this.getMousePosition(event)
    const idx = this.findVertexIndexAtPosition(pos)
    if (idx === -1) return

    this.selectedIndex = idx
    this.suppressNextClick = true
    this.deleteVertex(idx)
  }

  private handleKeyDown(event: KeyboardEvent): void {
    const key = event.key.toLowerCase()
    const isUndo = (event.metaKey || event.ctrlKey) && key === 'z' && !event.shiftKey
    if (isUndo) {
      if (this.canvas.style.pointerEvents === 'none') return
      event.preventDefault()
      this.undo()
      return
    }

    if (event.key !== 'Delete' && event.key !== 'Backspace') return
    if (this.canvas.style.pointerEvents === 'none') return

    event.preventDefault()
    if (this.selectedIndex !== null) {
      this.deleteVertex(this.selectedIndex)
      return
    }

    if (this.vertices.length === 0) return
    this.onDeletePolygonRequested?.()
  }

  private handleClick(event: MouseEvent): void {
    if (this.suppressNextClick) {
      this.suppressNextClick = false
      return
    }

    if (this.closed) return

    const pos = this.getMousePosition(event)

    if (this.vertices.length >= 3) {
      const first = this.vertices[0]
      const dx = pos.x - first.x
      const dy = pos.y - first.y
      const distSq = dx * dx + dy * dy
      if (distSq <= CLOSE_DISTANCE_PX * CLOSE_DISTANCE_PX) {
        this.pushUndoSnapshot(this.createSnapshot())
        this.closed = true
        this.onClosedChanged?.(this.closed)
        this.onVerticesChanged?.(this.getVertices())
        return
      }
    }

    if (this.findVertexIndexAtPosition(pos) !== -1) return

    this.pushUndoSnapshot(this.createSnapshot())
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
