import { useState, useEffect } from 'react'
import type { Design } from '../../core/domain/models'
import { DesignUploadPanel } from '../components/DesignUploadPanel'
import { QRCode } from '../components/QRCode'
import { Barcode } from '../components/Barcode'
import { CardIcon, CheckIcon, NfcIcon } from '../components/icons'

export function DesignManagementPage() {
  const [designs, setDesigns] = useState<Design[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [frontDesign, setFrontDesign] = useState<string | null>(null)
  const [backDesign, setBackDesign] = useState<string | null>(null)
  const [designName, setDesignName] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const loadDesigns = async () => {
    setIsLoading(true)
    try {
      const list = await window.cardApi.listDesigns()
      setDesigns(list)
    } catch (e) {
      console.error('Failed to load designs', e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadDesigns()
  }, [])

  const handleSave = async () => {
    if (!designName.trim() || (!frontDesign && !backDesign)) return
    setIsSaving(true)
    try {
      const created = await window.cardApi.createDesign(designName.trim(), frontDesign, backDesign)
      if (created?.id) {
        await window.cardApi.setDefaultDesign(created.id)
      }
      setDesignName('')
      setFrontDesign(null)
      setBackDesign(null)
      await loadDesigns()
    } catch (e) {
      console.error('Failed to save design', e)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSetDefault = async (id: string) => {
    await window.cardApi.setDefaultDesign(id)
    await loadDesigns()
  }

  const handleDelete = async (id: string) => {
    await window.cardApi.deleteDesign(id)
    await loadDesigns()
  }

  const isFormValid = designName.trim().length > 0 && (!!frontDesign || !!backDesign)

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-8 font-sans">
      {/* ── Studio Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">Design Studio</h1>
          <p className="text-xs text-slate-400">Author, simulate, and deploy custom CR-80 card templates</p>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[#202227] border border-[#2c2e35] px-3 py-1 text-xs font-bold text-slate-300">
            {designs.length} Registered {designs.length === 1 ? 'Template' : 'Templates'}
          </span>
        </div>
      </div>

      {/* ── Main Stage: Live Full Card Preview + Creator Form ─────────── */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
        {/* Left Column: Full CR-80 Live Card Preview Stage (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col gap-5 rounded-3xl bg-[#222429] p-7 border border-[#2c2e35]/70 shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-[#d8ff3e]">
                Live Card Proof (CR-80)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Simulated production preview with patient data, QR code & barcode overlays
              </p>
            </div>

            <div className="flex items-center gap-2 text-[11px] font-bold">
              <span className={`px-2.5 py-1 rounded-full border ${
                frontDesign ? 'bg-[#d8ff3e]/10 text-[#d8ff3e] border-[#d8ff3e]/30' : 'bg-[#191a1e] text-slate-500 border-[#2c2e35]'
              }`}>
                Front {frontDesign ? '✓' : 'Pending'}
              </span>
              <span className={`px-2.5 py-1 rounded-full border ${
                backDesign ? 'bg-[#d8ff3e]/10 text-[#d8ff3e] border-[#d8ff3e]/30' : 'bg-[#191a1e] text-slate-500 border-[#2c2e35]'
              }`}>
                Back {backDesign ? '✓' : 'Pending'}
              </span>
            </div>
          </div>

          {/* Cards Showcase Area (Front and Back Side-by-Side or Stacked) */}
          <div className="flex flex-wrap items-center justify-center gap-6 py-4">
            {/* ── FRONT CARD PROOF ── */}
            <div className="flex flex-col items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                Front Face
              </span>
              
              <div 
                className="relative h-[240px] w-[380px] rounded-2xl overflow-hidden shadow-2xl border border-[#343740] bg-[#1a1b20] transition-all hover:scale-[1.02]"
                style={{
                  backgroundImage: frontDesign ? `url(${frontDesign})` : 'none',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              >
                {!frontDesign ? (
                  <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center">
                    <CardIcon className="text-3xl text-slate-600 mb-2" />
                    <p className="text-xs font-bold text-slate-400">Front Artwork Empty</p>
                    <p className="text-[10px] text-slate-500 mt-1">Upload a front background to preview layout</p>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col h-full relative z-10 p-5 justify-end">
                      {/* Patient Details without background */}
                      <div className="flex flex-col self-start p-3.5 mb-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[9px] font-black uppercase tracking-widest ${frontDesign ? 'text-white/70 drop-shadow-sm' : 'text-slate-400'}`}>
                            Patient Credential
                          </span>
                          <NfcIcon className={`text-xs ${frontDesign ? 'text-white/70 drop-shadow-sm' : 'text-slate-600'}`} />
                        </div>
                        <h3 className={`text-xl font-black ${frontDesign ? 'text-white drop-shadow-md' : 'text-slate-900'} tracking-tight leading-none mb-1`}>
                          Sarah Connor
                        </h3>
                        <div className={`flex items-center gap-2 ${frontDesign ? 'drop-shadow-sm' : ''}`}>
                          <span className={`font-mono text-xs font-bold ${frontDesign ? 'text-white/90' : 'text-slate-700'}`}>
                            HOSP-09412
                          </span>
                          <span className={`text-[10px] ${frontDesign ? 'text-white/50' : 'text-slate-400'}`}>•</span>
                          <span className={`font-mono text-[10px] font-semibold ${frontDesign ? 'text-white/80' : 'text-slate-700'}`}>
                            REF: 928374-A
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* ── BACK CARD PROOF ── */}
            <div className="flex flex-col items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                Back Face
              </span>

              <div 
                className="relative h-[240px] w-[380px] rounded-2xl overflow-hidden shadow-2xl border border-[#343740] bg-[#1a1b20] transition-all hover:scale-[1.02]"
                style={{
                  backgroundImage: backDesign ? `url(${backDesign})` : 'none',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              >
                {!backDesign ? (
                  <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center">
                    <CardIcon className="text-3xl text-slate-600 mb-2" />
                    <p className="text-xs font-bold text-slate-400">Back Artwork Empty</p>
                    <p className="text-[10px] text-slate-500 mt-1">Upload a back background to preview barcodes</p>
                  </div>
                ) : (
                  <div className="w-full h-full relative z-10 p-4">
                    {/* Left Side: QR Code Overlay */}
                    <div className="absolute left-7 top-[55%] -translate-y-1/2 flex flex-col items-center">
                      <QRCode value="https://emr.hospital.local/patient/HOSP-09412" className="h-[72px] w-[72px] rounded-sm overflow-hidden mix-blend-multiply" />
                    </div>

                    {/* Bottom Right: Barcode Overlay */}
                    <div className="absolute bottom-4 right-5 flex justify-center bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-200 shadow-md">
                      <Barcode value="8492019482910394" className="h-7 w-40" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-2 rounded-2xl bg-[#1a1b20] p-3 text-center border border-[#2c2e35]">
            <p className="text-[11px] text-slate-400">
              ⚡ This preview accurately models how your artwork will be laminated and printed by physical card printers.
            </p>
          </div>
        </div>

        {/* Right Column: Template Creation Studio Form (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-6 rounded-3xl bg-[#222429] p-7 border border-[#2c2e35]/70 shadow-md">
          <div>
            <h2 className="text-base font-bold text-white">Create New Template</h2>
            <p className="text-xs text-slate-400 mt-0.5">Upload high-res artwork assets to register a template</p>
          </div>

          {/* Template Name Input */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Template Name <span className="text-red-400">*</span>
            </label>
            <input 
              type="text" 
              value={designName}
              onChange={(e) => setDesignName(e.target.value)}
              placeholder="e.g. Standard Medical 2025"
              className="w-full rounded-2xl border border-[#2c2e35] bg-[#1a1b20] px-4 py-3 text-xs text-white placeholder-slate-500 outline-none transition focus:border-[#d8ff3e] focus:bg-[#202228]"
            />
          </div>

          {/* Upload Controls for Front & Back */}
          <DesignUploadPanel 
            frontDesign={frontDesign}
            backDesign={backDesign}
            onFrontUpload={setFrontDesign}
            onBackUpload={setBackDesign}
          />

          {/* Save Button */}
          <button 
            type="button"
            onClick={handleSave}
            disabled={isSaving || !isFormValid}
            className="w-full rounded-2xl bg-[#d8ff3e] px-5 py-3.5 text-xs font-black uppercase tracking-wider text-black shadow-lg shadow-[#d8ff3e]/20 transition hover:bg-[#c9f02e] active:scale-98 disabled:opacity-30 disabled:pointer-events-none"
          >
            {isSaving ? 'Registering Template...' : 'Save & Register Template'}
          </button>
        </div>
      </div>

      {/* ── Bottom Section: Saved Templates Repository ─────────────────── */}
      <section className="flex flex-col gap-4 pt-4 border-t border-[#22242a]">
        <div className="flex items-center justify-between px-1">
          <div>
            <h2 className="text-base font-bold text-white">
              Template Repository
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">All registered designs available for card issuance</p>
          </div>
          <span className="rounded-full bg-[#202227] border border-[#2c2e35] px-3 py-1 text-xs font-bold text-[#d8ff3e]">
            {designs.length} Total
          </span>
        </div>

        {isLoading ? (
          <p className="text-xs text-slate-500 py-6">Loading templates...</p>
        ) : designs.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[#2c2e35] bg-[#222429]/40 p-12 text-center">
            <p className="text-slate-400 text-xs">
              No custom templates created yet. Use the studio panel above to build your first template.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {designs.map(d => (
              <div 
                key={d.id} 
                className={`rounded-3xl border bg-[#222429] p-5 shadow-sm flex flex-col gap-4 transition hover:scale-[1.01] ${
                  d.isDefault ? 'border-[#d8ff3e] ring-1 ring-[#d8ff3e]/40 shadow-lg shadow-[#d8ff3e]/10' : 'border-[#2c2e35]/70'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-white text-sm truncate" title={d.name}>{d.name}</h3>
                    <p className="text-[10px] font-mono text-slate-400 mt-0.5">{new Date(d.createdAt).toLocaleDateString()}</p>
                  </div>
                  {d.isDefault && (
                    <span className="bg-[#d8ff3e] text-black text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                      <CheckIcon className="text-xs" /> Active
                    </span>
                  )}
                </div>
                
                {/* Thumbnail Preview Split */}
                <div className="flex gap-2 h-28 overflow-hidden rounded-2xl bg-[#191a1e] border border-[#2c2e35] p-1">
                  <div className="flex-1 rounded-xl overflow-hidden relative bg-[#202227] border border-[#2c2e35]">
                    {d.frontBackground ? (
                      <img src={d.frontBackground} className="absolute inset-0 w-full h-full object-cover" alt="Front" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-[10px] text-slate-500 font-bold uppercase tracking-wider">No Front</div>
                    )}
                  </div>
                  <div className="flex-1 rounded-xl overflow-hidden relative bg-[#202227] border border-[#2c2e35]">
                    {d.backBackground ? (
                      <img src={d.backBackground} className="absolute inset-0 w-full h-full object-cover" alt="Back" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-[10px] text-slate-500 font-bold uppercase tracking-wider">No Back</div>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center mt-auto pt-2 border-t border-[#2c2e35]/80">
                  <button 
                    onClick={() => handleSetDefault(d.id)}
                    disabled={d.isDefault}
                    className="rounded-full px-3 py-1 text-xs font-bold text-[#d8ff3e] disabled:text-slate-500 hover:bg-[#d8ff3e]/10 transition-colors"
                  >
                    {d.isDefault ? '✓ Currently In Use' : 'Set as Active'}
                  </button>
                  <button 
                    onClick={() => handleDelete(d.id)}
                    disabled={d.isDefault}
                    className="rounded-full px-3 py-1 text-xs font-bold text-red-400 disabled:text-slate-600 hover:bg-red-500/10 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
