/**
 * IPC contract — the single, typed surface between the renderer and main.
 *
 * Both sides import this: the preload builds `window.cardApi` from it, and main
 * registers a handler per channel. Because {@link CHANNELS} is keyed by
 * `keyof CardApi`, the two can never drift — a new method won't compile until it
 * has both a channel and a handler.
 *
 * The renderer only ever asks for OUTCOMES here (issue this patient a card,
 * check this card in). It never names a device or a raw hardware operation —
 * that is the security boundary from spec §3/§5.
 */

import type { Patient, Card } from '../../core/domain/models'
import type { CardEvent } from '../../core/domain/events'
import type { IssuanceResult } from '../../core/services/issuance-service'
import type { CheckInResult } from '../../core/services/check-in-service'
import type { ReissueResult } from '../../core/services/lifecycle-service'
import type { RegisterPatientInput } from '../../core/services/patient-service'

export type { RegisterPatientInput }

export type DeviceState = 'READY' | 'BUSY' | 'ERROR' | 'OFFLINE' | 'SIMULATED'

export interface HardwareStatus {
  readonly nfc: DeviceState
  readonly printer: DeviceState
  readonly barcode: DeviceState
}

/** The capability surface exposed to the renderer as `window.cardApi`. */
export interface CardApi {
  listPatients(): Promise<Patient[]>
  registerPatient(input: RegisterPatientInput): Promise<Patient>
  seedDemoPatient(): Promise<Patient>

  listCardsByPatient(patientId: string): Promise<Card[]>
  cardHistory(cardRecordId: string): Promise<CardEvent[]>

  issueForPatient(patientId: string, options?: { frontBackground?: string | null; backBackground?: string | null }): Promise<IssuanceResult>
  resumeIssue(cardRecordId: string, options?: { frontBackground?: string | null; backBackground?: string | null }): Promise<IssuanceResult>

  checkIn(cardRecordId: string): Promise<CheckInResult>

  reportLost(cardRecordId: string): Promise<Card>
  reissue(cardRecordId: string): Promise<ReissueResult>
  voidCard(cardRecordId: string): Promise<Card>

  hardwareStatus(): Promise<HardwareStatus>

  // Settings & Bulk Operations
  getSetting(key: string): Promise<string | null>
  updateSetting(key: string, value: string): Promise<void>
  bulkRegisterPatients(patients: RegisterPatientInput[]): Promise<Patient[]>

  // Designs
  listDesigns(): Promise<import('../../core/domain/models').Design[]>
  createDesign(name: string, front: string | null, back: string | null): Promise<import('../../core/domain/models').Design>
  deleteDesign(id: string): Promise<void>
  setDefaultDesign(id: string): Promise<void>
  getDefaultDesign(): Promise<import('../../core/domain/models').Design | null>

  // Global Card History
  listAllCards(): Promise<Card[]>
}

/** Channel name per method. `Record<keyof CardApi, string>` keeps it exhaustive. */
export const CHANNELS: Record<keyof CardApi, string> = {
  listPatients: 'patients:list',
  registerPatient: 'patients:register',
  seedDemoPatient: 'patients:seedDemo',
  listCardsByPatient: 'cards:listByPatient',
  cardHistory: 'cards:history',
  issueForPatient: 'issuance:issueForPatient',
  resumeIssue: 'issuance:resume',
  checkIn: 'checkin:perform',
  reportLost: 'lifecycle:reportLost',
  reissue: 'lifecycle:reissue',
  voidCard: 'lifecycle:void',
  hardwareStatus: 'hardware:status',
  getSetting: 'settings:get',
  updateSetting: 'settings:update',
  bulkRegisterPatients: 'patients:bulkRegister',
  listDesigns: 'designs:list',
  createDesign: 'designs:create',
  deleteDesign: 'designs:delete',
  setDefaultDesign: 'designs:setDefault',
  getDefaultDesign: 'designs:getDefault',
  listAllCards: 'cards:listAll',
}
