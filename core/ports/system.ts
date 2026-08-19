/**
 * System ports — ambient capabilities the core needs but must not hard-code.
 *
 * Injecting time and id-generation keeps the domain deterministic and testable:
 * tests supply a fixed clock and a counting id-generator, so no `Date.now()` or
 * `Math.random()` ever appears inside the core.
 */

import type { CardId } from '../domain/ids'

export interface Clock {
  now(): Date
  /** ISO-8601 string form, used for all persisted timestamps. */
  nowIso(): string
}

export interface IdGenerator {
  /** Opaque unique id for record primary keys and event ids. */
  newId(): string
  /** A fresh `card_id` for a new physical card instance (spec §1). */
  newCardId(): CardId
}
