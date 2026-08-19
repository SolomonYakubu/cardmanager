import type { CardEventRepository } from '../../ports/repositories'
import type { CardEvent } from '../../domain/events'
import type { CardRecordId } from '../../domain/ids'

/**
 * In-memory, append-only CardEventRepository (spec §6). Events are only ever
 * appended and read back in insertion order — never mutated or removed.
 */
export class InMemoryCardEventRepository implements CardEventRepository {
  readonly #events: CardEvent[] = []

  async append(event: CardEvent): Promise<CardEvent> {
    this.#events.push(event)
    return event
  }

  async listByCard(cardRecordId: CardRecordId): Promise<CardEvent[]> {
    return this.#events.filter((event) => event.cardRecordId === cardRecordId)
  }

  /** Full log across all cards, insertion order (audit convenience). */
  async listAll(): Promise<CardEvent[]> {
    return [...this.#events]
  }
}
