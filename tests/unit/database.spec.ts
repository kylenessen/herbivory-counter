import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { Database, initDatabase } from '../../src/main/database'

describe('Database initialization', () => {
    let testDir: string
    let db: Database

    beforeEach(() => {
        // Create a unique temp directory for each test
        testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'herbivory-test-'))
    })

    afterEach(() => {
        // Close database and clean up
        if (db) {
            db.close()
        }
        // Clean up test directory
        fs.rmSync(testDir, { recursive: true, force: true })
    })

    test('creates database file in target directory', () => {
        db = initDatabase(testDir)
        const dbPath = path.join(testDir, 'herbivory.db')
        expect(fs.existsSync(dbPath)).toBe(true)
    })

    test('creates all required tables', () => {
        db = initDatabase(testDir)
        const tables = db.getTables()
        expect(tables).toContain('images')
        expect(tables).toContain('polygons')
        expect(tables).toContain('cells')
        expect(tables).toContain('app_state')
    })

    test('images table has correct schema', () => {
        db = initDatabase(testDir)
        const columns = db.getTableColumns('images')
        expect(columns).toContain('id')
        expect(columns).toContain('filepath')
        expect(columns).toContain('sheet_id')
        expect(columns).toContain('scale_px_per_cm')
        expect(columns).toContain('scale_line_start_x')
        expect(columns).toContain('scale_line_start_y')
        expect(columns).toContain('scale_line_end_x')
        expect(columns).toContain('scale_line_end_y')
        expect(columns).toContain('scale_cm_value')
        expect(columns).toContain('completed')
        expect(columns).toContain('created_at')
    })

    test('polygons table has correct schema', () => {
        db = initDatabase(testDir)
        const columns = db.getTableColumns('polygons')
        expect(columns).toContain('id')
        expect(columns).toContain('image_id')
        expect(columns).toContain('leaf_id')
        expect(columns).toContain('vertices')
        expect(columns).toContain('created_at')
    })

    test('cells table has correct schema', () => {
        db = initDatabase(testDir)
        const columns = db.getTableColumns('cells')
        expect(columns).toContain('id')
        expect(columns).toContain('polygon_id')
        expect(columns).toContain('grid_row')
        expect(columns).toContain('grid_col')
        expect(columns).toContain('category')
        expect(columns).toContain('researcher')
        expect(columns).toContain('updated_at')
    })

    test('app_state table has correct schema', () => {
        db = initDatabase(testDir)
        const columns = db.getTableColumns('app_state')
        expect(columns).toContain('key')
        expect(columns).toContain('value')
    })

    test('database persists between connections', () => {
        // Create and close first connection
        db = initDatabase(testDir)
        db.setAppState('test_key', 'test_value')
        db.close()

        // Open new connection and verify data persists
        db = initDatabase(testDir)
        const value = db.getAppState('test_key')
        expect(value).toBe('test_value')
    })
})

describe('Database CRUD operations', () => {
    let testDir: string
    let db: Database

    beforeEach(() => {
        testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'herbivory-test-'))
        db = initDatabase(testDir)
    })

    afterEach(() => {
        if (db) {
            db.close()
        }
        fs.rmSync(testDir, { recursive: true, force: true })
    })

    test('can insert and retrieve an image', () => {
        const imageId = db.insertImage('/path/to/image.jpg')
        expect(imageId).toBeGreaterThan(0)

        const image = db.getImage(imageId)
        expect(image).toBeDefined()
        expect(image!.filepath).toBe('/path/to/image.jpg')
    })

    test('can update image scale', () => {
        const imageId = db.insertImage('/path/to/image.jpg')
        db.updateImageScale(imageId, {
            pxPerCm: 45,
            lineStartX: 100,
            lineStartY: 100,
            lineEndX: 550,
            lineEndY: 100,
            cmValue: 10
        })

        const image = db.getImage(imageId)
        expect(image!.scale_px_per_cm).toBe(45)
        expect(image!.scale_line_start_x).toBe(100)
    })

    test('can insert and retrieve a polygon', () => {
        const imageId = db.insertImage('/path/to/image.jpg')
        const vertices = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 100 }]
        const polygonId = db.insertPolygon(imageId, '01', vertices)

        expect(polygonId).toBeGreaterThan(0)

        const polygon = db.getPolygon(polygonId)
        expect(polygon).toBeDefined()
        expect(polygon!.leaf_id).toBe('01')
        expect(JSON.parse(polygon!.vertices)).toEqual(vertices)
    })

    test('can insert and retrieve cells', () => {
        const imageId = db.insertImage('/path/to/image.jpg')
        const polygonId = db.insertPolygon(imageId, '01', [])

        db.upsertCell(polygonId, 0, 0, 'present', 'researcher1')
        db.upsertCell(polygonId, 0, 1, 'absent', 'researcher1')

        const cells = db.getCellsForPolygon(polygonId)
        expect(cells).toHaveLength(2)
        expect(cells.find(c => c.grid_row === 0 && c.grid_col === 0)!.category).toBe('present')
    })

    test('upsert updates existing cell', () => {
        const imageId = db.insertImage('/path/to/image.jpg')
        const polygonId = db.insertPolygon(imageId, '01', [])

        db.upsertCell(polygonId, 0, 0, 'absent', 'researcher1')
        db.upsertCell(polygonId, 0, 0, 'present', 'researcher2')

        const cells = db.getCellsForPolygon(polygonId)
        expect(cells).toHaveLength(1)
        expect(cells[0].category).toBe('present')
        expect(cells[0].researcher).toBe('researcher2')
    })

    test('deleting polygon cascades to cells', () => {
        const imageId = db.insertImage('/path/to/image.jpg')
        const polygonId = db.insertPolygon(imageId, '01', [])
        db.upsertCell(polygonId, 0, 0, 'present', 'researcher1')

        db.deletePolygon(polygonId)

        const cells = db.getCellsForPolygon(polygonId)
        expect(cells).toHaveLength(0)
    })
})
