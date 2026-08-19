import { describe, it, expect } from 'vitest'
import { HmacOriginalitySigner } from './originality'
import { CardId, OriginalityCode } from '../domain/ids'
import { DomainError } from '../domain/errors'

const KEY_A = 'test-key-aaaaaaaaaaaaaaaaaaaaaaaa'
const KEY_B = 'test-key-bbbbbbbbbbbbbbbbbbbbbbbb'

describe('HmacOriginalitySigner', () => {
  it('is deterministic for the same key + card_id', () => {
    const signer = new HmacOriginalitySigner(KEY_A)
    const card = CardId('card-001')
    expect(signer.sign(card)).toBe(signer.sign(card))
  })

  it('produces different codes for different card_ids', () => {
    const signer = new HmacOriginalitySigner(KEY_A)
    expect(signer.sign(CardId('card-001'))).not.toBe(signer.sign(CardId('card-002')))
  })

  it('produces different codes under different keys', () => {
    const a = new HmacOriginalitySigner(KEY_A)
    const b = new HmacOriginalitySigner(KEY_B)
    const card = CardId('card-001')
    expect(a.sign(card)).not.toBe(b.sign(card))
  })

  it('verifies a genuine code', () => {
    const signer = new HmacOriginalitySigner(KEY_A)
    const card = CardId('card-xyz')
    expect(signer.verify(card, signer.sign(card))).toBe(true)
  })

  it('rejects a tampered code', () => {
    const signer = new HmacOriginalitySigner(KEY_A)
    const card = CardId('card-xyz')
    expect(signer.verify(card, OriginalityCode('deadbeef'))).toBe(false)
  })

  it('rejects forgery: a code minted under a different key (spec §1)', () => {
    const genuine = new HmacOriginalitySigner(KEY_A)
    const forger = new HmacOriginalitySigner(KEY_B)
    const card = CardId('card-xyz')
    expect(genuine.verify(card, forger.sign(card))).toBe(false)
  })

  it('rejects a code presented against the wrong card_id', () => {
    const signer = new HmacOriginalitySigner(KEY_A)
    const codeForOne = signer.sign(CardId('card-001'))
    expect(signer.verify(CardId('card-002'), codeForOne)).toBe(false)
  })

  it('rejects a weak key at construction', () => {
    expect(() => new HmacOriginalitySigner('short')).toThrowError(DomainError)
  })
})
