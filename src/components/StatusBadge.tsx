import type { CardStatus } from '../../core/domain/card-status'
import { STATUS_META, type Tone } from '../lib/present'

const TONE_CLASSES: Record<Tone, { pill: string; dot: string }> = {
  active: { pill: 'border-[#d8ff3e]/30 bg-[#d8ff3e]/10 text-[#d8ff3e]', dot: 'bg-[#d8ff3e] shadow-[0_0_6px_#d8ff3e]' },
  progress: { pill: 'border-[#38bdf8]/30 bg-[#38bdf8]/10 text-[#38bdf8]', dot: 'bg-[#38bdf8] shadow-[0_0_6px_#38bdf8]' },
  failure: { pill: 'border-red-500/30 bg-red-500/10 text-red-400', dot: 'bg-red-500 shadow-[0_0_6px_red]' },
  lost: { pill: 'border-amber-500/30 bg-amber-500/10 text-amber-400', dot: 'bg-amber-500 shadow-[0_0_6px_#f59e0b]' },
  expired: { pill: 'border-slate-600 bg-[#1c1d22] text-slate-400', dot: 'bg-slate-500' },
  void: { pill: 'border-slate-700 bg-[#191a1e] text-slate-500', dot: 'bg-slate-600' },
  replaced: { pill: 'border-violet-500/30 bg-violet-500/10 text-violet-400', dot: 'bg-violet-400 shadow-[0_0_6px_#a78bfa]' },
}

/** A colored pill with a leading dot for a card's lifecycle status. */
export function StatusBadge({ status }: { status: CardStatus }) {
  const meta = STATUS_META[status]
  const tone = TONE_CLASSES[meta.tone]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-wider ${tone.pill}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
      {meta.label}
    </span>
  )
}
