import type { ComponentType, SVGProps } from 'react'
import type { Card } from '../../core/domain/models'
import type { CardEvent } from '../../core/domain/events'
import { actionsFor, issuedLine, shortId, type CardAction } from '../lib/present'
import { StatusBadge } from './StatusBadge'
import { CardHistory } from './CardHistory'
import { CardIcon, HistoryIcon, RefreshIcon, XIcon } from './icons'

type Variant = 'primary' | 'neutral' | 'danger'

const ACTION_META: Record<
  CardAction,
  { label: string; variant: Variant; icon: ComponentType<SVGProps<SVGSVGElement>> }
> = {
  resume: { label: 'Resume issue', variant: 'primary', icon: RefreshIcon },
  reportLost: { label: 'Report lost', variant: 'neutral', icon: XIcon },
  reissue: { label: 'Reissue', variant: 'neutral', icon: RefreshIcon },
  void: { label: 'Void', variant: 'danger', icon: XIcon },
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-[#3b66f5] text-white hover:bg-[#3258db] shadow-md shadow-[#3b66f5]/20 font-bold',
  neutral: 'bg-[#2a2c33] text-slate-200 hover:bg-[#353842] border border-[#353842] font-semibold',
  danger: 'bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30 font-semibold',
}

interface Props {
  card: Card
  disabled: boolean
  onAction: (action: CardAction, card: Card) => void
  historyOpen: boolean
  history: CardEvent[]
  onToggleHistory: (card: Card) => void
}

/** One card in the selected patient's list: identity, status, and its actions. */
export function CardRow({ card, disabled, onAction, historyOpen, history, onToggleHistory }: Props) {
  const actions = actionsFor(card.status)
  return (
    <li className="rounded-3xl border border-[#2c2e35]/60 bg-[#222429] shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-3 p-5">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1c1d22] text-[#d8ff3e] border border-[#2c2e35]">
            <CardIcon className="text-2xl" />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-sm font-bold text-white tracking-wide">{shortId(card.cardId)}</p>
            <p className="mt-0.5 text-xs text-slate-400 font-medium">{issuedLine(card)}</p>
          </div>
        </div>
        <StatusBadge status={card.status} />
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-[#2c2e35]/80 bg-[#1c1d22] px-5 py-3.5">
        {actions.map((action) => {
          const meta = ACTION_META[action]
          const Glyph = meta.icon
          return (
            <button
              key={action}
              disabled={disabled}
              onClick={() => onAction(action, card)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs transition-colors active:scale-95 disabled:pointer-events-none disabled:opacity-40 ${VARIANT_CLASSES[meta.variant]}`}
            >
              <Glyph className="text-sm" />
              {meta.label}
            </button>
          )
        })}
        <button
          onClick={() => onToggleHistory(card)}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[#25272e] px-4 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:bg-[#30333c] hover:text-white border border-[#2c2e35]"
        >
          <HistoryIcon className="text-sm" />
          {historyOpen ? 'Hide History' : 'Audit Trail'}
        </button>
      </div>

      {historyOpen && (
        <div className="border-t border-[#2c2e35] bg-[#1a1b20] px-6 py-5">
          <CardHistory events={history} />
        </div>
      )}
    </li>
  )
}
