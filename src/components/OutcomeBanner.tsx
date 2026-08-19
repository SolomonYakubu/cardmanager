import type { Banner } from '../lib/present'
import { CheckIcon, ShieldIcon, XIcon } from './icons'

const TONE: Record<Banner['tone'], { wrap: string; icon: string; title: string }> = {
  ok: {
    wrap: 'border-[#d8ff3e]/30 bg-[#d8ff3e]/10',
    icon: 'text-[#d8ff3e]',
    title: 'text-[#d8ff3e]',
  },
  warn: {
    wrap: 'border-amber-500/30 bg-amber-500/10',
    icon: 'text-amber-400',
    title: 'text-amber-300',
  },
  error: {
    wrap: 'border-red-500/30 bg-red-500/10',
    icon: 'text-red-400',
    title: 'text-red-300',
  },
}

/** The single result surface: shows the outcome of the last operator action. */
export function OutcomeBanner({ banner, onDismiss }: { banner: Banner; onDismiss: () => void }) {
  const tone = TONE[banner.tone]
  const Glyph = banner.tone === 'ok' ? CheckIcon : ShieldIcon
  return (
    <div className={`flex items-start gap-3 rounded-2xl border px-5 py-4 ${tone.wrap}`} role="status">
      <Glyph className={`mt-0.5 text-lg ${tone.icon}`} />
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-bold ${tone.title}`}>{banner.title}</p>
        {banner.lines.map((line, i) => (
          <p key={i} className="mt-0.5 break-all text-xs text-slate-300 font-medium">
            {line}
          </p>
        ))}
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="rounded-full p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
      >
        <XIcon className="text-base" />
      </button>
    </div>
  )
}
