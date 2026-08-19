import { HardwareBar } from '../components/HardwareBar'
import { OutcomeBanner } from '../components/OutcomeBanner'
import { PatientPanel } from '../components/PatientPanel'
import { CardRow } from '../components/CardRow'
import { CardIcon, PlusIcon, NfcIcon } from '../components/icons'
import { useOperatorConsole } from '../hooks/useOperatorConsole'
import { CardPreview } from '../components/CardPreview'

export function CardManagementPage() {
  const { state, actions } = useOperatorConsole()
  const selectedPatient = state.patients.find((p) => p.id === state.selectedPatientId) ?? null
  const activeCard = state.cards[0] ?? null

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-6 font-sans">
      {/* ── Sub Header / Status Bar ─────────────────────────────────────── */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">Card Management</h1>
          <p className="text-xs text-slate-400">Issue, preview, and encode physical credentials</p>
        </div>
        <div className="flex items-center gap-4">
          <HardwareBar status={state.hardware} />
          <div className="flex items-center gap-2 rounded-full bg-[#222429] px-4 py-2 border border-[#2c2e35]">
            <span className="relative flex h-2 w-2">
              {state.ready && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#d8ff3e] opacity-75" />
              )}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${state.ready ? 'bg-[#d8ff3e]' : 'bg-amber-500'}`} />
            </span>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-300">
              {state.ready ? 'Bridge Live' : 'Renderer Only'}
            </span>
          </div>
        </div>
      </div>

      {state.banner && <OutcomeBanner banner={state.banner} onDismiss={actions.dismissBanner} />}

      {!state.ready && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-3 text-xs text-amber-300">
          The card bridge is offline — run inside Electron with <code className="rounded bg-black/40 px-2 py-0.5 font-mono text-amber-200">npm run dev</code>.
        </div>
      )}

      {/* ── Two Column Layout (Patient Panel + Card Workspace) ─────────── */}
      <div className="flex flex-col gap-6 lg:flex-row items-start">
        <PatientPanel
          patients={state.patients}
          selectedId={state.selectedPatientId}
          onSelect={actions.selectPatient}
          onSeed={actions.seedPatient}
          onBulkImport={actions.bulkImport}
          disabled={state.busy || !state.ready}
        />

        <section className="min-w-0 flex-1 flex flex-col gap-6 w-full">
          {!selectedPatient ? (
            <EmptyState
              title="No Patient Selected"
              hint="Pick a patient from the roster on the left, or seed a demo patient to start."
            />
          ) : (
            <>
              {/* Selected Patient Banner & Primary Action Button */}
              <div className="flex flex-col justify-between gap-4 rounded-3xl bg-[#222429] p-6 border border-[#2c2e35]/60 sm:flex-row sm:items-center shadow-sm">
                <div className="min-w-0">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#d8ff3e]">Active Patient Profile</span>
                  <h2 className="truncate text-2xl font-black text-white mt-0.5">
                    {selectedPatient.name}
                  </h2>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="font-mono text-xs text-[#38bdf8] bg-[#38bdf8]/10 px-3 py-1 rounded-full border border-[#38bdf8]/20 font-bold">
                      {selectedPatient.hospitalNo}
                    </span>
                    <span className="font-mono text-xs text-slate-400 bg-[#191a1e] px-3 py-1 rounded-full border border-[#2c2e35]">
                      EMR: {selectedPatient.emrReference}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => actions.issue()}
                  disabled={state.busy}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#d8ff3e] px-7 py-3 text-xs font-black uppercase tracking-wider text-black shadow-lg shadow-[#d8ff3e]/20 transition hover:bg-[#c9f02e] active:scale-95 disabled:pointer-events-none disabled:opacity-80"
                >
                  {state.busyMessage ? (
                    <>
                      <NfcIcon className="text-base font-bold animate-pulse" />
                      <span>{state.busyMessage}</span>
                    </>
                  ) : (
                    <>
                      <PlusIcon className="text-base font-bold" />
                      <span>Issue & Print Card</span>
                    </>
                  )}
                </button>
              </div>

              {/* 3D Interactive Card Stage */}
              <div className="flex w-full justify-center items-center py-10 px-4 bg-[#222429] rounded-3xl border border-[#2c2e35]/60 shadow-sm relative overflow-hidden">
                <CardPreview 
                  patient={selectedPatient} 
                  card={activeCard} 
                  frontBackground={state.frontDesign}
                  backBackground={state.backDesign}
                />
              </div>

              {/* Card History */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3 px-1">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
                    Patient Card History
                  </h3>
                  <span className="rounded-full bg-[#202227] border border-[#2c2e35] px-2.5 py-0.5 text-xs font-bold text-[#d8ff3e]">
                    {state.cards.length}
                  </span>
                </div>

                {state.cards.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#2c2e35] bg-[#1e2025]/50 p-6 text-center text-xs text-slate-400">
                    No physical cards issued for this patient yet. Click <strong className="text-[#d8ff3e]">Issue & Print Card</strong> to begin.
                  </div>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {state.cards.map((card) => (
                      <CardRow
                        key={card.id}
                        card={card}
                        disabled={state.busy}
                        onAction={actions.runCardAction}
                        historyOpen={state.openHistoryId === card.id}
                        history={state.history}
                        onToggleHistory={actions.toggleHistory}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex h-full min-h-[380px] flex-col items-center justify-center rounded-3xl border border-dashed border-[#2c2e35] bg-[#222429]/50 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#282a30] text-[#d8ff3e] shadow-inner mb-4">
        <CardIcon className="text-3xl" />
      </div>
      <p className="text-base font-bold text-white mb-1">{title}</p>
      <p className="max-w-sm text-xs text-slate-400">{hint}</p>
    </div>
  )
}
