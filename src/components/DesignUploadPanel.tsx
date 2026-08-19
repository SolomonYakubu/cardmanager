import type { ChangeEvent } from 'react'
import { CheckIcon, XIcon } from './icons'

interface Props {
  onFrontUpload: (dataUri: string | null) => void
  onBackUpload: (dataUri: string | null) => void
  frontDesign: string | null
  backDesign: string | null
}

export function DesignUploadPanel({ onFrontUpload, onBackUpload, frontDesign, backDesign }: Props) {
  const handleFile = (e: ChangeEvent<HTMLInputElement>, setter: (uri: string | null) => void) => {
    const file = e.target.files?.[0]
    if (!file) {
      setter(null)
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      setter(event.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Artwork Spec Guidelines */}
      <div className="rounded-2xl border border-[#2c2e35] bg-[#191a1e] p-4 text-xs text-slate-300">
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold text-white uppercase tracking-wider text-[11px]">CR-80 Artwork Specs</span>
          <span className="rounded-md bg-[#25272e] px-2 py-0.5 text-[10px] font-mono text-[#d8ff3e]">1012 × 638 px (300 DPI)</span>
        </div>
        <ul className="list-disc pl-4 space-y-1 text-slate-400 text-[11px]">
          <li><strong className="text-slate-300">Front:</strong> Left & bottom area reserved for patient identity text.</li>
          <li><strong className="text-slate-300">Back:</strong> Left side reserved for QR code; bottom right for Barcode.</li>
        </ul>
      </div>

      {/* Front Upload Box */}
      <div className={`flex flex-col gap-2 rounded-2xl border p-4 transition ${
        frontDesign ? 'border-[#d8ff3e]/40 bg-[#1e2025]' : 'border-[#2c2e35] bg-[#1a1b20]'
      }`}>
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
            <span>Front Artwork</span>
            <span className="text-red-400">*</span>
          </label>
          {frontDesign ? (
            <span className="flex items-center gap-1 text-[10px] font-bold text-[#d8ff3e] bg-[#d8ff3e]/10 px-2 py-0.5 rounded-full">
              <CheckIcon className="text-xs" /> Ready
            </span>
          ) : (
            <span className="text-[10px] font-bold text-slate-500 bg-[#25272e] px-2 py-0.5 rounded-full">
              Required
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 mt-1">
          <label className="relative flex cursor-pointer items-center justify-center rounded-xl bg-[#25272e] px-4 py-2 text-xs font-bold text-slate-200 border border-[#343740] hover:bg-[#2e313a] hover:text-white transition">
            <span>{frontDesign ? 'Change Front Artwork' : 'Choose Front File'}</span>
            <input 
              type="file" 
              accept="image/*"
              onChange={(e) => handleFile(e, onFrontUpload)}
              className="sr-only"
            />
          </label>

          {frontDesign && (
            <button 
              type="button"
              onClick={() => onFrontUpload(null)} 
              className="flex items-center gap-1 rounded-xl bg-red-500/10 px-3 py-2 text-xs font-bold text-red-400 hover:bg-red-500/20 transition"
            >
              <XIcon className="text-xs" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Back Upload Box */}
      <div className={`flex flex-col gap-2 rounded-2xl border p-4 transition ${
        backDesign ? 'border-[#d8ff3e]/40 bg-[#1e2025]' : 'border-[#2c2e35] bg-[#1a1b20]'
      }`}>
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
            <span>Back Artwork</span>
            <span className="text-red-400">*</span>
          </label>
          {backDesign ? (
            <span className="flex items-center gap-1 text-[10px] font-bold text-[#d8ff3e] bg-[#d8ff3e]/10 px-2 py-0.5 rounded-full">
              <CheckIcon className="text-xs" /> Ready
            </span>
          ) : (
            <span className="text-[10px] font-bold text-slate-500 bg-[#25272e] px-2 py-0.5 rounded-full">
              Required
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 mt-1">
          <label className="relative flex cursor-pointer items-center justify-center rounded-xl bg-[#25272e] px-4 py-2 text-xs font-bold text-slate-200 border border-[#343740] hover:bg-[#2e313a] hover:text-white transition">
            <span>{backDesign ? 'Change Back Artwork' : 'Choose Back File'}</span>
            <input 
              type="file" 
              accept="image/*"
              onChange={(e) => handleFile(e, onBackUpload)}
              className="sr-only"
            />
          </label>

          {backDesign && (
            <button 
              type="button"
              onClick={() => onBackUpload(null)} 
              className="flex items-center gap-1 rounded-xl bg-red-500/10 px-3 py-2 text-xs font-bold text-red-400 hover:bg-red-500/20 transition"
            >
              <XIcon className="text-xs" /> Clear
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
