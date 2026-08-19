/**
 * EMR deep link — the value encoded into the card's QR channel and returned to
 * the operator UI at check-in so a chart can be opened directly.
 *
 * Kept in one place so issuance (what gets printed) and check-in (what gets
 * opened) always build the link the same way.
 */

import type { Patient } from '../domain/models'

export const DEFAULT_EMR_LINK_BASE = 'emr://chart/'

export function buildEmrLink(base: string, patient: Patient): string {
  return `${base}${encodeURIComponent(patient.emrReference)}`
}
