/**
 * Append-only audit log (spec §6, §10).
 *
 * A thin seam between the services and the event repository: it stamps the two
 * fields a caller shouldn't invent by hand — a unique `id` and an ISO `at`
 * timestamp — from the injected IdGenerator and Clock. Keeping this here means
 * no service ever reaches for `Date.now()` or a random id inline, and every
 * event in the trail is produced the same way.
 */

import type { CardEvent, NewCardEvent } from '../domain/events'
import type { CardEventRepository } from '../ports/repositories'
import type { CardRecordId } from '../domain/ids'
import type { Clock, IdGenerator } from '../ports/system'

export class AuditLog {
  readonly #events: CardEventRepository
  readonly #clock: Clock
  readonly #ids: IdGenerator

  constructor(events: CardEventRepository, clock: Clock, ids: IdGenerator) {
    this.#events = events
    this.#clock = clock
    this.#ids = ids
  }

  /** Stamp id + timestamp and append. Events are never updated or deleted. */
  async record(event: NewCardEvent): Promise<CardEvent> {
    return this.#events.append({
      ...event,
      id: this.#ids.newId(),
      at: this.#clock.nowIso(),
    })
  }

  /** Full history for one card, in insertion order. */
  async history(cardRecordId: CardRecordId): Promise<CardEvent[]> {
    return this.#events.listByCard(cardRecordId)
  }
}
