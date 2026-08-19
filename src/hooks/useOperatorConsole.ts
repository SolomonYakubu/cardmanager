/**
 * useOperatorConsole — all state and side effects for the operator console.
 *
 * The component tree stays declarative: it renders `state` and calls `actions`.
 * Every action funnels through {@link guard}, which serializes work behind a
 * single `busy` flag and turns any thrown IPC/domain error into an error
 * banner — so the UI never has scattered try/catch or half-loading states.
 *
 * Reloads are driven off the acted-upon card (`card.patientId`), never a
 * captured selection, so a stale closure can't refresh the wrong patient.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Card, Patient } from '../../core/domain/models'
import type { CardEvent } from '../../core/domain/events'
import type { CardApi, HardwareStatus } from '../../electron/ipc/contract'
import {
  cleanError,
  describeIssuance,
  patientSummary,
  shortId,
  STATUS_META,
  type Banner,
  type CardAction,
} from '../lib/present'

export interface ConsoleState {
  /** False when not running inside Electron (no preload bridge present). */
  readonly ready: boolean
  readonly patients: Patient[]
  readonly selectedPatientId: string | null
  readonly cards: Card[]
  readonly hardware: HardwareStatus | null
  readonly banner: Banner | null
  readonly busy: boolean
  readonly busyMessage: string | null
  readonly openHistoryId: string | null
  readonly history: CardEvent[]
  readonly frontDesign: string | null
  readonly backDesign: string | null
}

export interface ConsoleActions {
  selectPatient(patientId: string): void
  seedPatient(): void
  bulkImport(patients: import('../../electron/ipc/contract').RegisterPatientInput[]): void
  issue(): void
  runCardAction(action: CardAction, card: Card): void
  toggleHistory(card: Card): void
  dismissBanner(): void
}

const errorBanner = (err: unknown): Banner => ({
  tone: 'error',
  title: 'Action failed',
  lines: [cleanError(err)],
})

export function useOperatorConsole(): { state: ConsoleState; actions: ConsoleActions } {
  const api = useMemo<CardApi | null>(
    () => (typeof window !== 'undefined' ? (window.cardApi ?? null) : null),
    [],
  )

  const [patients, setPatients] = useState<Patient[]>([])
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null)
  const [cards, setCards] = useState<Card[]>([])
  const [hardware, setHardware] = useState<HardwareStatus | null>(null)
  const [banner, setBanner] = useState<Banner | null>(null)
  const [busy, setBusy] = useState(false)
  const [busyMessage, setBusyMessage] = useState<string | null>(null)
  const [openHistoryId, setOpenHistoryId] = useState<string | null>(null)
  const [history, setHistory] = useState<CardEvent[]>([])
  
  const [frontDesign, setFrontDesign] = useState<string | null>(null)
  const [backDesign, setBackDesign] = useState<string | null>(null)

  /** Run async work behind the busy flag, converting throws into a banner. */
  const guard = useCallback(
    (work: (api: CardApi) => Promise<void>, message?: string) => {
      if (!api) return
      const bridge = api
      void (async () => {
        if (message) setBusyMessage(message)
        setBusy(true)
        try {
          await work(bridge)
        } catch (err) {
          setBanner(errorBanner(err))
        } finally {
          setBusy(false)
          setBusyMessage(null)
        }
      })()
    },
    [api],
  )

  const refreshDesign = useCallback(() => {
    if (!api) return
    api.getDefaultDesign().then(design => {
      if (design) {
        setFrontDesign(design.frontBackground)
        setBackDesign(design.backBackground)
      } else {
        setFrontDesign(null)
        setBackDesign(null)
      }
    }).catch(() => {})
  }, [api])

  // Initial load: roster + device status + settings.
  useEffect(() => {
    if (!api) return
    void api.listPatients().then(setPatients).catch(() => {})
    void api.hardwareStatus().then(setHardware).catch(() => {})
    refreshDesign()

    window.addEventListener('focus', refreshDesign)
    return () => window.removeEventListener('focus', refreshDesign)
  }, [api, refreshDesign])

  const selectPatient = useCallback(
    (patientId: string) => {
      setSelectedPatientId(patientId)
      setOpenHistoryId(null)
      refreshDesign()
      guard(async (api) => setCards(await api.listCardsByPatient(patientId)))
    },
    [guard, refreshDesign],
  )

  const seedPatient = useCallback(() => {
    guard(async (api) => {
      const patient = await api.seedDemoPatient()
      setPatients(await api.listPatients())
      setSelectedPatientId(patient.id)
      setOpenHistoryId(null)
      setCards(await api.listCardsByPatient(patient.id))
      setBanner({ tone: 'ok', title: 'Demo patient added', lines: [patientSummary(patient)] })
    })
  }, [guard])
  
  const bulkImport = useCallback((newPatients: import('../../electron/ipc/contract').RegisterPatientInput[]) => {
    guard(async (api) => {
      const added = await api.bulkRegisterPatients(newPatients)
      setPatients(await api.listPatients())
      setBanner({ tone: 'ok', title: 'Import complete', lines: [`Imported ${added.length} patients successfully.`] })
    })
  }, [guard])

  const issue = useCallback(
    () => {
      const patientId = selectedPatientId
      if (!patientId) return
      guard(async (api) => {
        setBanner(describeIssuance(await api.issueForPatient(patientId, { frontBackground: frontDesign, backBackground: backDesign })))
        setCards(await api.listCardsByPatient(patientId))
        setHardware(await api.hardwareStatus())
      }, 'Waiting for NFC tap...')
    },
    [guard, selectedPatientId, frontDesign, backDesign]
  )

  const runCardAction = useCallback(
    (action: CardAction, card: Card) => {
      guard(async (api) => {
        switch (action) {
          case 'resume':
            setBanner(describeIssuance(await api.resumeIssue(card.id, { frontBackground: frontDesign, backBackground: backDesign })))
            break
          case 'reportLost':
            await api.reportLost(card.id)
            setBanner({
              tone: 'ok',
              title: 'Card reported lost',
              lines: [`Card ${shortId(card.cardId)} is now LOST. Reissue to replace it.`],
            })
            break
          case 'reissue': {
            const { replacement } = await api.reissue(card.id)
            setBanner({
              tone: 'ok',
              title: 'Card reissued',
              lines: [
                `Replacement ${shortId(replacement.cardId)} created (${STATUS_META[replacement.status].label}).`,
              ],
            })
            break
          }
          case 'void':
            await api.voidCard(card.id)
            setBanner({
              tone: 'ok',
              title: 'Card voided',
              lines: [`Card ${shortId(card.cardId)} is now VOID.`],
            })
            break
        }
        setCards(await api.listCardsByPatient(card.patientId))
        setHardware(await api.hardwareStatus())
        if (openHistoryId === card.id) setHistory(await api.cardHistory(card.id))
      })
    },
    [guard, openHistoryId, frontDesign, backDesign],
  )

  const toggleHistory = useCallback(
    (card: Card) => {
      if (openHistoryId === card.id) {
        setOpenHistoryId(null)
        return
      }
      guard(async (api) => {
        setHistory(await api.cardHistory(card.id))
        setOpenHistoryId(card.id)
      })
    },
    [guard, openHistoryId],
  )

  const dismissBanner = useCallback(() => setBanner(null), [])

  return {
    state: {
      ready: !!api,
      patients,
      selectedPatientId,
      cards,
      hardware,
      banner,
      busy,
      busyMessage,
      openHistoryId,
      history,
      frontDesign,
      backDesign
    },
    actions: { selectPatient, seedPatient, bulkImport, issue, runCardAction, toggleHistory, dismissBanner },
  }
}
