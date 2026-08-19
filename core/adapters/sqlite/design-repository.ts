import type { SQLiteDatabase } from './database'
import type { DesignRepository } from '../../ports/repositories'
import type { Design } from '../../domain/models'

export class SqliteDesignRepository implements DesignRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  async create(design: Design): Promise<Design> {
    const stmt = this.db.db.prepare(`
      INSERT INTO designs (id, name, frontBackground, backBackground, isDefault, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      design.id,
      design.name,
      design.frontBackground,
      design.backBackground,
      design.isDefault ? 1 : 0,
      design.createdAt
    )
    return design
  }

  async findById(id: string): Promise<Design | null> {
    const stmt = this.db.db.prepare('SELECT * FROM designs WHERE id = ?')
    const row = stmt.get(id) as any
    if (!row) return null
    return this.mapRow(row)
  }

  async list(): Promise<Design[]> {
    const stmt = this.db.db.prepare('SELECT * FROM designs ORDER BY createdAt DESC')
    const rows = stmt.all() as any[]
    return rows.map((row) => this.mapRow(row))
  }

  async delete(id: string): Promise<void> {
    const stmt = this.db.db.prepare('DELETE FROM designs WHERE id = ?')
    stmt.run(id)
  }

  async setDefault(id: string): Promise<void> {
    const clearStmt = this.db.db.prepare('UPDATE designs SET isDefault = 0')
    const setStmt = this.db.db.prepare('UPDATE designs SET isDefault = 1 WHERE id = ?')
    
    this.db.db.transaction(() => {
      clearStmt.run()
      setStmt.run(id)
    })()
  }

  async getDefault(): Promise<Design | null> {
    const stmt = this.db.db.prepare('SELECT * FROM designs WHERE isDefault = 1 LIMIT 1')
    const row = stmt.get() as any
    if (!row) return null
    return this.mapRow(row)
  }

  private mapRow(row: any): Design {
    return {
      id: row.id,
      name: row.name,
      frontBackground: row.frontBackground,
      backBackground: row.backBackground,
      isDefault: row.isDefault === 1,
      createdAt: row.createdAt,
    }
  }
}
