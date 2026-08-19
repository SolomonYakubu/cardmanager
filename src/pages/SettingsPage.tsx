import { SettingsIcon, CheckCircleIcon } from '../components/icons'

export function SettingsPage() {
  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">System Settings</h2>
          <p className="text-sm text-slate-400 mt-1">Manage application preferences and hardware configurations</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Col: Setting Tabs */}
        <div className="flex flex-col gap-2">
          <button className="flex items-center justify-between rounded-2xl bg-[#d8ff3e] px-5 py-4 text-left text-black shadow-md font-bold transition">
            <span className="text-sm">General</span>
            <SettingsIcon className="text-base" />
          </button>
          <button className="flex items-center justify-between rounded-2xl bg-[#222429] border border-[#2c2e35] px-5 py-4 text-left text-slate-300 font-semibold transition hover:bg-[#282a30] hover:text-white">
            <span className="text-sm">Hardware Setup</span>
          </button>
          <button className="flex items-center justify-between rounded-2xl bg-[#222429] border border-[#2c2e35] px-5 py-4 text-left text-slate-300 font-semibold transition hover:bg-[#282a30] hover:text-white">
            <span className="text-sm">Operator Accounts</span>
          </button>
        </div>

        {/* Right Col: Settings Content */}
        <div className="lg:col-span-2 flex flex-col gap-6 rounded-3xl bg-[#222429] p-8 border border-[#2c2e35]/60 shadow-sm">
          <h3 className="text-lg font-bold text-white">General Preferences</h3>
          
          <div className="space-y-6">
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
            <div className="flex items-center justify-between border-b border-[#2c2e35]/60 pb-6">
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
          
          <div className="mt-4 flex justify-end gap-3">
            <button className="rounded-full px-6 py-2.5 text-xs font-bold text-slate-300 hover:text-white transition">
              Cancel
            </button>
            <button className="rounded-full bg-[#3b66f5] px-6 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-[#3b66f5]/25 transition hover:bg-[#3258db]">
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
