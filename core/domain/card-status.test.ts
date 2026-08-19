import { describe, it, expect } from 'vitest'
import {
  CARD_STATUSES,
  type CardStatus,
  assertTransition,
  canTransition,
  isActive,
  isFailure,
  isTerminal,
  nextStatuses,
} from './card-status'
import { InvalidStatusTransitionError } from './errors'

describe('card-status state machine', () => {
  it('walks the full issuance happy path (spec §7)', () => {
    const happyPath: CardStatus[] = [
      'RESERVED',
      'NFC_ENCODED',
      'NFC_VERIFIED',
      'PRINTED',
      'PRINTED_VERIFIED',
      'ACTIVE',
    ]
    for (let i = 0; i < happyPath.length - 1; i++) {
      expect(canTransition(happyPath[i], happyPath[i + 1])).toBe(true)
    }
  })

  it('forbids skipping steps', () => {
    expect(canTransition('RESERVED', 'ACTIVE')).toBe(false)
    expect(canTransition('RESERVED', 'PRINTED')).toBe(false)
    expect(canTransition('NFC_VERIFIED', 'ACTIVE')).toBe(false)
  })

  it('allows each hardware step to fail into its named failure state (spec §10)', () => {
    expect(canTransition('RESERVED', 'NFC_ENCODING_FAILED')).toBe(true)
    expect(canTransition('NFC_ENCODED', 'NFC_ENCODING_FAILED')).toBe(true)
    expect(canTransition('NFC_VERIFIED', 'PRINT_FAILED')).toBe(true)
    expect(canTransition('PRINTED', 'PRINT_FAILED')).toBe(true)
  })

  it('lets a failure state retry back into the flow', () => {
    expect(canTransition('NFC_ENCODING_FAILED', 'NFC_ENCODED')).toBe(true)
    expect(canTransition('PRINT_FAILED', 'PRINTED')).toBe(true)
  })

  it('supports the lost/reissue lifecycle (spec §9)', () => {
    expect(canTransition('ACTIVE', 'LOST')).toBe(true)
    expect(canTransition('LOST', 'REPLACED')).toBe(true)
    expect(canTransition('ACTIVE', 'VOID')).toBe(true)
  })

  it('treats VOID and REPLACED as terminal', () => {
    expect(isTerminal('VOID')).toBe(true)
    expect(isTerminal('REPLACED')).toBe(true)
    expect(nextStatuses('VOID')).toEqual([])
    expect(nextStatuses('REPLACED')).toEqual([])
    // Nothing can leave a terminal state.
    for (const to of CARD_STATUSES) {
      expect(canTransition('VOID', to)).toBe(false)
    }
  })

  it('classifies failure and active states', () => {
    expect(isFailure('NFC_ENCODING_FAILED')).toBe(true)
    expect(isFailure('PRINT_FAILED')).toBe(true)
    expect(isFailure('ACTIVE')).toBe(false)
    expect(isActive('ACTIVE')).toBe(true)
    expect(isActive('PRINTED_VERIFIED')).toBe(false)
  })

  it('assertTransition throws a coded error on an illegal move', () => {
    expect(() => assertTransition('RESERVED', 'ACTIVE')).toThrowError(InvalidStatusTransitionError)
    try {
      assertTransition('RESERVED', 'ACTIVE')
    } catch (err) {
      expect((err as InvalidStatusTransitionError).code).toBe('INVALID_STATUS_TRANSITION')
    }
  })

  it('assertTransition is a no-op on a legal move', () => {
    expect(() => assertTransition('RESERVED', 'NFC_ENCODED')).not.toThrow()
  })

  it('every status has an entry in the transition table', () => {
    for (const status of CARD_STATUSES) {
      expect(Array.isArray(nextStatuses(status))).toBe(true)
    }
  })
})
