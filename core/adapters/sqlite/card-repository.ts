import type { Card } from '../../domain/models'
import type { CardId, CardRecordId, HospitalNo, PatientId } from '../../domain/ids'
import type { CardRepository } from '../../ports/repositories'
import type { SQLiteDatabase } from './database'
import { isActive } from '../../domain/card-status'

export class SqliteCardRepository implements CardRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  async create(card: Card): Promise<Card> {
    const stmt = this.db.db.prepare(`
      INSERT INTO cards (id, cardId, patientId, hospitalNo, nfcUid, originalityCode, status, issuedAt, issuedByOperatorId, expiresAt, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      card.id,
      card.cardId,
      card.patientId,
      card.hospitalNo,
      card.nfcUid ?? null,
      card.originalityCode,
      card.status,
      card.issuedAt ?? null,
      card.issuedByOperatorId ?? null,
      card.expiresAt ?? null,
      card.createdAt,
      card.updatedAt
    )
    return card
  }

  async save(card: Card): Promise<Card> {
    const stmt = this.db.db.prepare(`
      UPDATE cards SET
        status = ?,
        nfcUid = ?,
        issuedAt = ?,
        issuedByOperatorId = ?,
        expiresAt = ?,
        updatedAt = ?
      WHERE id = ?
    `)
    stmt.run(
      card.status,
      card.nfcUid ?? null,
      card.issuedAt ?? null,
      card.issuedByOperatorId ?? null,
      card.expiresAt ?? null,
      card.updatedAt,
      card.id
    )
    return card
  }

  async findById(id: CardRecordId): Promise<Card | null> {
    const stmt = this.db.db.prepare('SELECT * FROM cards WHERE id = ?')
    const row = stmt.get(id) as Card | undefined
    return row ?? null
  }

  async findByCardId(cardId: CardId): Promise<Card | null> {
    const stmt = this.db.db.prepare('SELECT * FROM cards WHERE cardId = ?')
    const row = stmt.get(cardId) as Card | undefined
    return row ?? null
  }

  async findActiveByHospitalNo(hospitalNo: HospitalNo): Promise<Card | null> {
    const stmt = this.db.db.prepare('SELECT * FROM cards WHERE hospitalNo = ? ORDER BY createdAt DESC')
    const rows = stmt.all(hospitalNo) as Card[]
    return rows.find(c => isActive(c.status)) ?? null
  }

  async listByPatient(patientId: PatientId): Promise<Card[]> {
    const stmt = this.db.db.prepare(
      'SELECT * FROM cards WHERE patientId = ? ORDER BY createdAt DESC'
    )
    const rows = stmt.all(patientId) as any[]
    return rows.map((row) => this.mapRow(row))
  }

  async listAll(): Promise<Card[]> {
    const stmt = this.db.db.prepare('SELECT * FROM cards ORDER BY createdAt DESC')
    const rows = stmt.all() as any[]
    return rows.map((row) => this.mapRow(row))
  }

  private mapRow(row: any): Card {
    return {
      id: row.id,
      cardId: row.cardId,
      patientId: row.patientId,
      hospitalNo: row.hospitalNo,
      nfcUid: row.nfcUid ?? undefined,
      originalityCode: row.originalityCode,
      status: row.status,
      issuedAt: row.issuedAt ?? undefined,
      issuedByOperatorId: row.issuedByOperatorId ?? undefined,
      expiresAt: row.expiresAt ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  }
}
