import type { CardEvent } from '../../domain/events'
import type { CardRecordId } from '../../domain/ids'
import type { CardEventRepository } from '../../ports/repositories'
import type { SQLiteDatabase } from './database'

export class SqliteCardEventRepository implements CardEventRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  async append(event: CardEvent): Promise<CardEvent> {
    const stmt = this.db.db.prepare(`
      INSERT INTO card_events (id, cardRecordId, type, operatorId, stationId, detail, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      event.id,
      event.cardRecordId,
      event.type,
      event.operatorId ?? null,
      event.stationId ?? null,
      event.detail ?? null,
      event.at
    )
    return event
  }

  async listByCard(cardRecordId: CardRecordId): Promise<CardEvent[]> {
    const stmt = this.db.db.prepare('SELECT id, cardRecordId, type, operatorId, stationId, detail, createdAt as at FROM card_events WHERE cardRecordId = ? ORDER BY createdAt ASC')
    return stmt.all(cardRecordId) as CardEvent[]
  }
}
