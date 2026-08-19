import { useState, useEffect } from 'react'
import { SettingsIcon, CheckCircleIcon } from '../components/icons'

export function SettingsPage() {
  const [printerMode, setPrinterMode] = useState<'pdf' | 'physical'>('pdf')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    window.cardApi?.getSetting('printer_mode').then((val) => {
      if (val === 'physical' || val?.startsWith('physical:')) {
        setPrinterMode('physical')
      } else {
        setPrinterMode('pdf')
      }
    })
  }, [])

  const handleTogglePrinter = async () => {
    const nextMode = printerMode === 'pdf' ? 'physical' : 'pdf'
    setPrinterMode(nextMode)
    setSaving(true)
    await window.cardApi?.updateSetting('printer_mode', nextMode)
    setSaving(false)
  }

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">System Settings</h2>
          <p className="text-sm text-slate-400 mt-1">Manage application preferences and hardware configurations</p>
        </div>
      </div>

      <div>
        {/* Settings Content */}
        <div className="flex max-w-4xl flex-col gap-6 rounded-3xl bg-[#222429] p-8 border border-[#2c2e35]/60 shadow-sm">
          <h3 className="text-lg font-bold text-white">General Preferences</h3>
          
          <div className="space-y-6">
            
            {/* Setting Item: Printer Mode */}
            <div className="flex items-center justify-between border-b border-[#2c2e35]/60 pb-6">
              <div>
                <p className="text-sm font-bold text-white">Printer Output Mode</p>
                <p className="mt-1 text-xs text-slate-400">
                  {printerMode === 'pdf' 
                    ? 'Currently generating digital PDF cards (No physical card stock used)' 
                    : 'Currently sending directly to connected physical printer'}
                </p>
              </div>
              <button 
                onClick={handleTogglePrinter}
                disabled={saving}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${printerMode === 'physical' ? 'bg-[#3b66f5]' : 'bg-[#34373f]'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${printerMode === 'physical' ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            {/* Setting Item */}
            <div className="flex items-center justify-between border-b border-[#2c2e35]/60 pb-6">
              <div>
                <p className="text-sm font-bold text-white">Auto-connect to Hardware</p>
                <p className="mt-1 text-xs text-slate-400">Automatically attempt to connect to NFC and printers on startup</p>
              </div>
              <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-[#d8ff3e] transition-colors focus:outline-none">
                <span className="inline-block h-4 w-4 translate-x-6 transform rounded-full bg-black transition-transform" />
              </button>
            </div>
            
            {/* Setting Item */}
            <div className="flex items-center justify-between border-b border-[#2c2e35]/60 pb-6">
              <div>
                <p className="text-sm font-bold text-white">Strict Verification Mode</p>
                <p className="mt-1 text-xs text-slate-400">Require HMAC-SHA256 signature verification for all NFC operations</p>
              </div>
              <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-[#3b66f5] transition-colors focus:outline-none">
                <span className="inline-block h-4 w-4 translate-x-6 transform rounded-full bg-white transition-transform" />
              </button>
            </div>
            
            {/* Setting Item */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white">Dark Mode Interface</p>
                <p className="mt-1 text-xs text-slate-400">Keep the application in dark mode (recommended for studio environments)</p>
              </div>
              <div className="flex items-center gap-2 text-[#d8ff3e]">
                <CheckCircleIcon className="text-lg" />
                <span className="text-xs font-black uppercase">Enabled</span>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  )
}
