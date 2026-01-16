// Shared type definitions

export interface Point {
  x: number
  y: number
}

export interface Image {
  id: number
  filepath: string
  sheetId: string | null
  scalePxPerCm: number | null
  scaleLineStart: Point | null
  scaleLineEnd: Point | null
  scaleCmValue: number | null
  completed: boolean
  createdAt: string
}

export interface Polygon {
  id: number
  imageId: number
  leafId: string
  vertices: Point[]
  createdAt: string
}

export type CellCategory = 'absent' | 'present' | 'unsure'

export interface Cell {
  id: number
  polygonId: number
  gridRow: number
  gridCol: number
  category: CellCategory
  researcher: string
  updatedAt: string
}

export interface AppState {
  key: string
  value: string
}
