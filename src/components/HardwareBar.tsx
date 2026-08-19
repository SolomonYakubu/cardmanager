import type { ComponentType, SVGProps } from 'react'
import type { DeviceState, HardwareStatus } from '../../electron/ipc/contract'
import { BarcodeIcon, NfcIcon, PrinterIcon } from './icons'

const STATE_META: Record<DeviceState, { dot: string; label: string; text: string }> = {
  READY: { dot: 'bg-[#d8ff3e] shadow-[0_0_8px_#d8ff3e]', label: 'Ready', text: 'text-[#d8ff3e]' },
  BUSY: { dot: 'bg-[#f59e0b] shadow-[0_0_8px_#f59e0b]', label: 'Busy', text: 'text-[#f59e0b]' },
  ERROR: { dot: 'bg-red-500 shadow-[0_0_8px_red]', label: 'Error', text: 'text-red-400' },
  OFFLINE: { dot: 'bg-slate-600', label: 'Offline', text: 'text-slate-500' },
  SIMULATED: { dot: 'bg-[#38bdf8] shadow-[0_0_8px_#38bdf8]', label: 'Simulated', text: 'text-[#38bdf8]' },
}

type Device = { name: string; icon: ComponentType<SVGProps<SVGSVGElement>>; state: DeviceState }

/** Device indicators for each hardware channel, with icon + live state. */
export function HardwareBar({ status }: { status: HardwareStatus | null }) {
  const devices: Device[] = [
    { name: 'NFC', icon: NfcIcon, state: status?.nfc ?? 'OFFLINE' },
    { name: 'Printer', icon: PrinterIcon, state: status?.printer ?? 'OFFLINE' },
    { name: 'Scanner', icon: BarcodeIcon, state: status?.barcode ?? 'OFFLINE' },
  ]
  return (
    <div className="flex items-center rounded-full border border-[#2c2e35] bg-[#222429] p-1 shadow-sm">
      {devices.map(({ name, icon: Glyph, state }, i) => {
        const meta = STATE_META[state]
        return (
          <div key={name} className="flex items-center">
            {i > 0 && <div className="mx-1 h-3.5 w-px bg-[#2f323a]" />}
            <div 
              className="flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold text-slate-300 hover:bg-[#2a2c33] transition-colors cursor-default"
              title={`${name}: ${meta.label}`}
            >
              <Glyph className="text-sm text-slate-400" />
              <span>{name}</span>
              <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
