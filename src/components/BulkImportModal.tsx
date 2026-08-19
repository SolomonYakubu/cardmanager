import { useState, useRef } from 'react'
import Papa from 'papaparse'
import type { RegisterPatientInput } from '../../electron/ipc/contract'

interface Props {
  onClose: () => void
  onImport: (patients: RegisterPatientInput[]) => void
}

export function BulkImportModal({ onClose, onImport }: Props) {
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedPatients: RegisterPatientInput[] = []
        for (const row of results.data as Record<string, string>[]) {
          // Map CSV headers to RegisterPatientInput
          // Expected roughly: name, hospital_no, wallet_no, emr_ref, dob
          const name = row['name'] || row['Name'] || row['NAME']
          const hospitalNo = row['hospital_no'] || row['hospitalNo'] || row['Hospital No']
          const walletNo = row['wallet_no'] || row['walletNo'] || row['Wallet No']
          const emrReference = row['emr_ref'] || row['emrReference'] || row['EMR'] || `EMR-${Date.now()}`
          const dateOfBirth = row['dob'] || row['dateOfBirth'] || row['Date of Birth'] || '1990-01-01'

          if (name && hospitalNo) {
            parsedPatients.push({
              name,
              hospitalNo,
              walletNo,
              emrReference,
              dateOfBirth
            })
          }
        }

        if (parsedPatients.length > 0) {
          onImport(parsedPatients)
          onClose()
        } else {
          setError('No valid patients found. Ensure your CSV has "name" and "hospital_no" columns.')
        }
      },
      error: (err) => {
        setError('Error parsing file: ' + err.message)
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-3xl bg-[#222429] shadow-2xl overflow-hidden border border-[#2c2e35]">
        <div className="p-6 border-b border-[#2c2e35]/80">
          <h2 className="text-base font-bold text-white">Bulk Import Patients</h2>
          <p className="text-xs text-slate-400 mt-1">Upload a CSV containing patient roster records.</p>
        </div>
        
        <div className="p-6 flex flex-col gap-4">
          {error && (
            <div className="bg-red-500/15 text-red-400 p-3 rounded-2xl text-xs border border-red-500/30">
              {error}
            </div>
          )}
          
          <div 
            className="border-2 border-dashed border-[#d8ff3e]/40 rounded-2xl p-8 text-center bg-[#191a1e]/60 hover:bg-[#d8ff3e]/5 transition cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <svg className="w-10 h-10 mx-auto text-[#d8ff3e] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-xs font-bold text-white">Click to browse or drop CSV file here</p>
            <p className="text-[10px] text-slate-400 mt-1">Supports standard .csv formatted files</p>
            <input 
              type="file" 
              accept=".csv" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
          </div>

          <div className="text-xs text-slate-400 bg-[#191a1e] p-4 rounded-2xl border border-[#2c2e35]">
            <p className="font-bold text-slate-200 mb-1">Expected CSV Headers:</p>
            <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
              <li><span className="font-mono text-[#d8ff3e]">name</span> (required)</li>
              <li><span className="font-mono text-[#d8ff3e]">hospital_no</span> (required)</li>
              <li><span className="font-mono text-slate-300">wallet_no</span> (optional)</li>
              <li><span className="font-mono text-slate-300">emr_ref</span> (optional)</li>
              <li><span className="font-mono text-slate-300">dob</span> (optional, YYYY-MM-DD)</li>
            </ul>
          </div>
        </div>

        <div className="p-4 border-t border-[#2c2e35]/80 bg-[#1c1d22] flex justify-end">
          <button 
            onClick={onClose}
            className="rounded-full px-5 py-1.5 text-xs font-bold text-slate-300 hover:text-white hover:bg-[#25272e] transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
