import { useState } from 'react'
import type { Patient } from '../../core/domain/models'
import { PlusIcon, UserIcon } from './icons'
import { BulkImportModal } from './BulkImportModal'
import type { RegisterPatientInput } from '../../electron/ipc/contract'

interface Props {
  patients: Patient[]
  selectedId: string | null
  onSelect: (patientId: string) => void
  onSeed: () => void
  onBulkImport: (patients: RegisterPatientInput[]) => void
  disabled: boolean
}

/** Left rail: the patient roster plus a one-click demo-patient seeder. */
export function PatientPanel({ patients, selectedId, onSelect, onSeed, onBulkImport, disabled }: Props) {
  const [showImport, setShowImport] = useState(false)

  return (
    <aside className="flex w-80 shrink-0 flex-col overflow-hidden rounded-3xl border border-[#2c2e35]/60 bg-[#222429] shadow-sm">
      <div className="flex items-center justify-between border-b border-[#2c2e35]/80 px-5 py-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-white">Patients</h2>
          <span className="rounded-full bg-[#1c1d21] px-2.5 py-0.5 text-[11px] font-bold text-slate-300 border border-[#2c2e35]">
            {patients.length}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImport(true)}
            disabled={disabled}
            className="inline-flex items-center rounded-full bg-[#2a2c33] px-3 py-1 text-xs font-bold text-slate-300 transition hover:bg-[#343740] hover:text-white disabled:opacity-40"
          >
            Import
          </button>
          <button
            onClick={onSeed}
            disabled={disabled}
            className="inline-flex items-center gap-1 rounded-full bg-[#d8ff3e] px-3 py-1 text-xs font-black text-black transition hover:bg-[#c9f02e] disabled:opacity-40"
          >
            <PlusIcon className="text-xs" />
            Seed
          </button>
        </div>
      </div>

      {showImport && (
        <BulkImportModal 
          onClose={() => setShowImport(false)} 
          onImport={onBulkImport}
        />
      )}

      <ul className="flex flex-col gap-1.5 overflow-y-auto p-3 max-h-[calc(100vh-250px)]">
        {patients.length === 0 && (
          <li className="m-2 rounded-2xl border border-dashed border-[#2c2e35] px-4 py-8 text-center text-xs text-slate-400">
            No patients registered yet.
            <br />
            Click <strong className="text-[#d8ff3e]">Seed</strong> to begin.
          </li>
        )}
        {patients.map((patient) => {
          const selected = patient.id === selectedId
          return (
            <li key={patient.id}>
              <button
                onClick={() => onSelect(patient.id)}
                className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left transition ${
                  selected
                    ? 'bg-[#3b66f5] text-white shadow-md shadow-[#3b66f5]/25'
                    : 'bg-[#1e2025] text-slate-300 hover:bg-[#282a30] hover:text-white border border-[#272930]'
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
                    selected ? 'bg-white/20 text-white' : 'bg-[#282a30] text-slate-400'
                  }`}
                >
                  <UserIcon />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-xs font-bold ${selected ? 'text-white' : 'text-slate-100'}`}>
                    {patient.name}
                  </span>
                  <span className={`block truncate font-mono text-[10px] ${selected ? 'text-white/80' : 'text-slate-400'}`}>
                    {patient.hospitalNo}
                  </span>
                </span>
                {selected && (
                  <span className="h-2 w-2 rounded-full bg-[#d8ff3e] shadow-[0_0_6px_#d8ff3e]" />
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}
