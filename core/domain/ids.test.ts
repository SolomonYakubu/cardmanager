import { describe, it, expect } from 'vitest'
import { CardId, HospitalNo, NfcUid, OriginalityCode, PatientId } from './ids'
import { DomainError } from './errors'

describe('identifier constructors', () => {
  it('accept and trim non-empty values', () => {
    expect(HospitalNo('  H-000123 ')).toBe('H-000123')
    expect(CardId('card-abc')).toBe('card-abc')
    expect(NfcUid('04:A2:2B')).toBe('04:A2:2B')
  })

  it('reject empty / whitespace-only values with a coded error', () => {
    for (const ctor of [HospitalNo, CardId, OriginalityCode, NfcUid, PatientId]) {
      expect(() => ctor('')).toThrowError(DomainError)
      expect(() => ctor('   ')).toThrowError(DomainError)
    }
    try {
      HospitalNo('')
    } catch (err) {
      expect((err as DomainError).code).toBe('VALIDATION_ERROR')
    }
  })

  it('brands are only structural at runtime (values remain plain strings)', () => {
    const h = HospitalNo('H-1')
    expect(typeof h).toBe('string')
    expect(`${h}`).toBe('H-1')
  })
})
