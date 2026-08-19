/**
 * Deterministic test doubles for the system ports.
 *
 * These make service tests fully repeatable: a fixed, tickable clock and a
 * counting id-generator mean event ids and timestamps are predictable, so
 * assertions never depend on real time or randomness.
 */

import type { Clock, IdGenerator } from '../ports/system'
import { CardId } from '../domain/ids'

export class FixedClock implements Clock {
  #ms: number

  constructor(start: string | number | Date = '2025-01-01T00:00:00.000Z') {
    this.#ms = new Date(start).getTime()
  }

  now(): Date {
    return new Date(this.#ms)
  }

  nowIso(): string {
    return new Date(this.#ms).toISOString()
  }

  /** Advance the clock so successive events get ordered, distinct timestamps. */
  tick(ms = 1000): this {
    this.#ms += ms
    return this
  }
}

export class SequentialIdGenerator implements IdGenerator {
  #n = 0
  #cardN = 0

  constructor(private readonly prefix = 'id') {}

  newId(): string {
    return `${this.prefix}-${++this.#n}`
  }

  newCardId(): CardId {
    return CardId(`card-${++this.#cardN}`)
  }
}
