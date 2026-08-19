/**
 * IPC handler registration (main-process side of the contract).
 *
 * One `ipcMain.handle` per channel, each delegating to a service. The issue and
 * check-in handlers also drive the {@link DemoStation} to simulate the
 * operator's physical actions around the service call — presenting a chip and
 * scanning the printed card — so the flow completes end to end without devices.
 *
 * Thrown DomainErrors propagate across IPC and are normalized on the renderer
 * side; ordinary business rejections (a bad check-in) come back as result
 * objects, not throws.
 */

import { ipcMain } from 'electron'
import crypto from 'node:crypto'
import { CHANNELS, type HardwareStatus, type RegisterPatientInput } from './contract'
import type { Runtime } from '../runtime'
import { CardRecordId, PatientId } from '../../core/domain/ids'

/** Fixed operator/station identity for the single-station MVP (spec §11 later). */
const OPERATOR = { operatorId: 'op-console', stationId: 'station-1' } as const

export function registerCardHandlers({ app, sim, hardware, settings, designs }: Runtime): void {
  ipcMain.handle(CHANNELS.listPatients, () => app.patients.list())

  ipcMain.handle(CHANNELS.registerPatient, (_e, input: RegisterPatientInput) =>
    app.patients.register(input),
  )

  ipcMain.handle(CHANNELS.seedDemoPatient, async () => {
    const n = (await app.patients.list()).length + 1
    return app.patients.register({
      hospitalNo: `H-DEMO-${String(n).padStart(4, '0')}`,
      name: `Demo Patient ${n}`,
      dateOfBirth: '1990-01-01',
      emrReference: `EMR-DEMO-${n}`,
    })
  })

  ipcMain.handle(CHANNELS.listCardsByPatient, (_e, patientId: string) =>
    app.cards.listByPatient(PatientId(patientId)),
  )

  ipcMain.handle(CHANNELS.cardHistory, (_e, cardRecordId: string) =>
    app.audit.history(CardRecordId(cardRecordId)),
  )

  ipcMain.handle(
    CHANNELS.issueForPatient,
    async (
      _e,
      patientId: string,
      options?: { frontBackground?: string | null; backBackground?: string | null },
    ) => {
      const defaultDesign = await designs.getDefault()
      const frontBackground = options?.frontBackground ?? defaultDesign?.frontBackground ?? undefined
      const backBackground = options?.backBackground ?? defaultDesign?.backBackground ?? undefined

      const card = await app.issuance.reserve({ patientId, ...OPERATOR })
      // Operator stand-in: a blank chip at the reader + scanning the printed card.
      sim.presentBlankChip(`chip-${card.cardId}`)
      sim.primeBarcode(card.originalityCode)
      return app.issuance.issue(card.id, {
        ...OPERATOR,
        frontBackground,
        backBackground,
      })
    },
  )

  ipcMain.handle(
    CHANNELS.resumeIssue,
    async (
      _e,
      cardRecordId: string,
      options?: { frontBackground?: string | null; backBackground?: string | null },
    ) => {
      const defaultDesign = await designs.getDefault()
      const frontBackground = options?.frontBackground ?? defaultDesign?.frontBackground ?? undefined
      const backBackground = options?.backBackground ?? defaultDesign?.backBackground ?? undefined

      const id = CardRecordId(cardRecordId)
      const card = await app.cards.findById(id)
      if (card) {
        sim.presentBlankChip(`chip-${card.cardId}`)
        sim.primeBarcode(card.originalityCode)
      }
      return app.issuance.issue(id, {
        ...OPERATOR,
        frontBackground,
        backBackground,
      })
    },
  )

  ipcMain.handle(CHANNELS.checkIn, async (_e, cardRecordId: string) => {
    const card = await app.cards.findById(CardRecordId(cardRecordId))
    // Simulate the patient presenting THIS card at the desk.
    if (card) {
      await sim.presentCard(card)
      sim.primeBarcode(card.originalityCode)
    }
    return app.checkIn.checkIn(OPERATOR)
  })

  ipcMain.handle(CHANNELS.reportLost, (_e, cardRecordId: string) =>
    app.lifecycle.reportLost(CardRecordId(cardRecordId), OPERATOR),
  )

  ipcMain.handle(CHANNELS.reissue, (_e, cardRecordId: string) =>
    app.lifecycle.reissue(CardRecordId(cardRecordId), OPERATOR),
  )

  ipcMain.handle(CHANNELS.voidCard, (_e, cardRecordId: string) =>
    app.lifecycle.void(CardRecordId(cardRecordId), OPERATOR),
  )

  ipcMain.handle(CHANNELS.hardwareStatus, async (): Promise<HardwareStatus> => ({
    nfc:
      hardware.nfc.mode === 'simulated'
        ? 'SIMULATED'
        : (await hardware.nfc.adapter.getStatus()).state,
    printer:
      hardware.printer.mode === 'simulated'
        ? 'SIMULATED'
        : (await hardware.printer.adapter.getStatus()).state,
    barcode:
      hardware.barcode.mode === 'simulated'
        ? 'SIMULATED'
        : (await hardware.barcode.adapter.getStatus()).state,
  }))

  ipcMain.handle(CHANNELS.getSetting, (_e, key: string) => settings.get(key))

  ipcMain.handle(CHANNELS.updateSetting, (_e, key: string, value: string) => settings.set(key, value))

  ipcMain.handle(CHANNELS.bulkRegisterPatients, async (_e, patients: RegisterPatientInput[]) => {
    // In a real app we'd want a bulk insert transaction, but we can just map over register for now
    // as it's SQLite and fast enough for ~1000 records. 
    const results = []
    for (const p of patients) {
      try {
        const patient = await app.patients.register(p)
        results.push(patient)
      } catch (err) {
        console.warn('Skipping patient due to error:', p, err)
      }
    }
    return results
  })

  // Designs
  ipcMain.handle(CHANNELS.listDesigns, () => designs.list())
  ipcMain.handle(CHANNELS.createDesign, async (_e, name: string, front: string | null, back: string | null) => {
    const existing = await designs.list()
    const isFirst = existing.length === 0
    const created = await designs.create({
      id: crypto.randomUUID(),
      name,
      frontBackground: front,
      backBackground: back,
      isDefault: isFirst,
      createdAt: new Date().toISOString(),
    })
    if (isFirst) {
      await designs.setDefault(created.id)
    }
    return created
  })
  ipcMain.handle(CHANNELS.deleteDesign, (_e, id: string) => designs.delete(id))
  ipcMain.handle(CHANNELS.setDefaultDesign, (_e, id: string) => designs.setDefault(id))
  ipcMain.handle(CHANNELS.getDefaultDesign, () => designs.getDefault())

  // Global Card History
  ipcMain.handle(CHANNELS.listAllCards, () => app.cards.listAll())
}
