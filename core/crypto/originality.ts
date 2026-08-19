/**
 * Originality code (spec §1).
 *
 * `originality_code = HMAC-SHA256(key, card_id)`. It lives on the barcode only
 * and lets a scanner confirm a physical card is genuine by recomputing it.
 *
 * What this defends against, and what it doesn't (spec §1 caveat):
 *   - Forgery  — caught: without the key you cannot produce a valid code.
 *   - Duplication — NOT caught: photographing a real barcode reproduces a valid
 *     code. The VOID/active-card check at lookup time is the backstop for that.
 *
 * Key custody (issuance key, rotation) is an application concern and open
 * decision #3 in the spec — the core only ever receives an already-resolved
 * key, so this module stays pure and testable.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'
import { CardId, OriginalityCode } from '../domain/ids'
import { DomainError } from '../domain/errors'

export interface OriginalitySigner {
  /** Deterministically derive the originality code for a card_id. */
  sign(cardId: CardId): OriginalityCode
  /** Recompute and compare in constant time. `false` = forged / tampered. */
  verify(cardId: CardId, code: OriginalityCode): boolean
}

const MIN_KEY_BYTES = 16

export class HmacOriginalitySigner implements OriginalitySigner {
  readonly #key: Buffer

  constructor(key: string | Buffer) {
    const buf = typeof key === 'string' ? Buffer.from(key, 'utf8') : key
    if (buf.length < MIN_KEY_BYTES) {
      throw new DomainError(
        'VALIDATION_ERROR',
        `originality key must be at least ${MIN_KEY_BYTES} bytes`,
      )
    }
    this.#key = buf
  }

  sign(cardId: CardId): OriginalityCode {
    const hex = createHmac('sha256', this.#key).update(cardId).digest('hex')
    return OriginalityCode(hex.substring(0, 16))
  }

  verify(cardId: CardId, code: OriginalityCode): boolean {
    const expected = Buffer.from(this.sign(cardId), 'utf8')
    const actual = Buffer.from(code, 'utf8')
    // timingSafeEqual requires equal lengths; a mismatch is simply not valid.
    if (expected.length !== actual.length) return false
    return timingSafeEqual(expected, actual)
  }
}
