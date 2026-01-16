import DatabaseConstructor, { Database as BetterSqlite3Database } from 'better-sqlite3'
import { join } from 'path'

/**
 * Image record from the database
 */
export interface ImageRecord {
    id: number
    filepath: string
    sheet_id: string | null
    scale_px_per_cm: number | null
    scale_line_start_x: number | null
    scale_line_start_y: number | null
    scale_line_end_x: number | null
    scale_line_end_y: number | null
    scale_cm_value: number | null
    completed: boolean
    created_at: string
}

/**
 * Polygon record from the database
 */
export interface PolygonRecord {
    id: number
    image_id: number
    leaf_id: string
    vertices: string // JSON array of {x, y}
    created_at: string
}

/**
 * Cell record from the database
 */
export interface CellRecord {
    id: number
    polygon_id: number
    grid_row: number
    grid_col: number
    category: 'absent' | 'present' | 'unsure'
    researcher: string
    updated_at: string
}

/**
 * Scale data for updating an image
 */
export interface ScaleData {
    pxPerCm: number
    lineStartX: number
    lineStartY: number
    lineEndX: number
    lineEndY: number
    cmValue: number
}

/**
 * Vertex coordinates
 */
export interface Vertex {
    x: number
    y: number
}

/**
 * Database wrapper class providing clean API for herbivory counter data
 */
export class Database {
    private db: BetterSqlite3Database

    constructor(dbPath: string) {
        this.db = new DatabaseConstructor(dbPath)
        this.db.pragma('journal_mode = WAL')
        this.initSchema()
    }

    /**
     * Initialize database schema with all required tables
     */
    private initSchema(): void {
        this.db.exec(`
      -- Images table
      CREATE TABLE IF NOT EXISTS images (
        id INTEGER PRIMARY KEY,
        filepath TEXT UNIQUE NOT NULL,
        sheet_id TEXT,
        scale_px_per_cm REAL,
        scale_line_start_x REAL,
        scale_line_start_y REAL,
        scale_line_end_x REAL,
        scale_line_end_y REAL,
        scale_cm_value REAL,
        completed BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Polygons (leaves) table
      CREATE TABLE IF NOT EXISTS polygons (
        id INTEGER PRIMARY KEY,
        image_id INTEGER NOT NULL,
        leaf_id TEXT NOT NULL,
        vertices TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (image_id) REFERENCES images(id)
      );

      -- Cell classifications table
      CREATE TABLE IF NOT EXISTS cells (
        id INTEGER PRIMARY KEY,
        polygon_id INTEGER NOT NULL,
        grid_row INTEGER NOT NULL,
        grid_col INTEGER NOT NULL,
        category TEXT NOT NULL,
        researcher TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (polygon_id) REFERENCES polygons(id) ON DELETE CASCADE,
        UNIQUE(polygon_id, grid_row, grid_col)
      );

      -- App state table
      CREATE TABLE IF NOT EXISTS app_state (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `)
    }

    /**
     * Close the database connection
     */
    close(): void {
        this.db.close()
    }

    /**
     * Get list of all table names in the database
     */
    getTables(): string[] {
        const rows = this.db.prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        ).all() as { name: string }[]
        return rows.map(row => row.name)
    }

    /**
     * Get column names for a table
     */
    getTableColumns(tableName: string): string[] {
        const rows = this.db.prepare(`PRAGMA table_info(${tableName})`).all() as { name: string }[]
        return rows.map(row => row.name)
    }

    // ==================== App State Operations ====================

    /**
     * Set an app state value
     */
    setAppState(key: string, value: string): void {
        this.db.prepare(
            'INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)'
        ).run(key, value)
    }

    /**
     * Get an app state value
     */
    getAppState(key: string): string | null {
        const row = this.db.prepare(
            'SELECT value FROM app_state WHERE key = ?'
        ).get(key) as { value: string } | undefined
        return row?.value ?? null
    }

    // ==================== Image Operations ====================

    /**
     * Insert a new image record
     */
    insertImage(filepath: string): number {
        const result = this.db.prepare(
            'INSERT INTO images (filepath) VALUES (?)'
        ).run(filepath)
        return result.lastInsertRowid as number
    }

    /**
     * Get an image by ID
     */
    getImage(id: number): ImageRecord | undefined {
        return this.db.prepare(
            'SELECT * FROM images WHERE id = ?'
        ).get(id) as ImageRecord | undefined
    }

    /**
     * Get an image by filepath
     */
    getImageByPath(filepath: string): ImageRecord | undefined {
        return this.db.prepare(
            'SELECT * FROM images WHERE filepath = ?'
        ).get(filepath) as ImageRecord | undefined
    }

    /**
     * Get all images
     */
    getAllImages(): ImageRecord[] {
        return this.db.prepare('SELECT * FROM images').all() as ImageRecord[]
    }

    /**
     * Update image scale data
     */
    updateImageScale(id: number, scale: ScaleData): void {
        this.db.prepare(`
      UPDATE images SET
        scale_px_per_cm = ?,
        scale_line_start_x = ?,
        scale_line_start_y = ?,
        scale_line_end_x = ?,
        scale_line_end_y = ?,
        scale_cm_value = ?
      WHERE id = ?
    `).run(
            scale.pxPerCm,
            scale.lineStartX,
            scale.lineStartY,
            scale.lineEndX,
            scale.lineEndY,
            scale.cmValue,
            id
        )
    }

    /**
     * Update image sheet ID
     */
    updateImageSheetId(id: number, sheetId: string): void {
        this.db.prepare(
            'UPDATE images SET sheet_id = ? WHERE id = ?'
        ).run(sheetId, id)
    }

    /**
     * Mark image as completed
     */
    markImageCompleted(id: number, completed: boolean): void {
        this.db.prepare(
            'UPDATE images SET completed = ? WHERE id = ?'
        ).run(completed ? 1 : 0, id)
    }

    // ==================== Polygon Operations ====================

    /**
     * Insert a new polygon
     */
    insertPolygon(imageId: number, leafId: string, vertices: Vertex[]): number {
        const result = this.db.prepare(
            'INSERT INTO polygons (image_id, leaf_id, vertices) VALUES (?, ?, ?)'
        ).run(imageId, leafId, JSON.stringify(vertices))
        return result.lastInsertRowid as number
    }

    /**
     * Get a polygon by ID
     */
    getPolygon(id: number): PolygonRecord | undefined {
        return this.db.prepare(
            'SELECT * FROM polygons WHERE id = ?'
        ).get(id) as PolygonRecord | undefined
    }

    /**
     * Get all polygons for an image
     */
    getPolygonsForImage(imageId: number): PolygonRecord[] {
        return this.db.prepare(
            'SELECT * FROM polygons WHERE image_id = ?'
        ).all(imageId) as PolygonRecord[]
    }

    /**
     * Update polygon vertices
     */
    updatePolygonVertices(id: number, vertices: Vertex[]): void {
        this.db.prepare(
            'UPDATE polygons SET vertices = ? WHERE id = ?'
        ).run(JSON.stringify(vertices), id)
    }

    /**
     * Delete a polygon and its associated cells (via CASCADE)
     */
    deletePolygon(id: number): void {
        this.db.prepare('DELETE FROM polygons WHERE id = ?').run(id)
    }

    // ==================== Cell Operations ====================

    /**
     * Insert or update a cell classification
     */
    upsertCell(
        polygonId: number,
        row: number,
        col: number,
        category: 'absent' | 'present' | 'unsure',
        researcher: string
    ): void {
        this.db.prepare(`
      INSERT INTO cells (polygon_id, grid_row, grid_col, category, researcher, updated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(polygon_id, grid_row, grid_col)
      DO UPDATE SET category = excluded.category, researcher = excluded.researcher, updated_at = CURRENT_TIMESTAMP
    `).run(polygonId, row, col, category, researcher)
    }

    /**
     * Get all cells for a polygon
     */
    getCellsForPolygon(polygonId: number): CellRecord[] {
        return this.db.prepare(
            'SELECT * FROM cells WHERE polygon_id = ?'
        ).all(polygonId) as CellRecord[]
    }

    /**
     * Get a specific cell
     */
    getCell(polygonId: number, row: number, col: number): CellRecord | undefined {
        return this.db.prepare(
            'SELECT * FROM cells WHERE polygon_id = ? AND grid_row = ? AND grid_col = ?'
        ).get(polygonId, row, col) as CellRecord | undefined
    }

    /**
     * Delete all cells for a polygon
     */
    deleteCellsForPolygon(polygonId: number): void {
        this.db.prepare('DELETE FROM cells WHERE polygon_id = ?').run(polygonId)
    }
}

/**
 * Initialize database in the specified directory
 */
export function initDatabase(directory: string): Database {
    const dbPath = join(directory, 'herbivory.db')
    return new Database(dbPath)
}
