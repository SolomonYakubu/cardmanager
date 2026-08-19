import type { CardEvent } from '../../core/domain/events'
import { EVENT_LABEL, eventTone, formatTime, type EventTone } from '../lib/present'

const DOT: Record<EventTone, string> = {
  good: 'bg-[#d8ff3e] ring-[#1a1b20] shadow-[0_0_6px_#d8ff3e]',
  bad: 'bg-red-500 ring-[#1a1b20] shadow-[0_0_6px_red]',
  neutral: 'bg-slate-500 ring-[#1a1b20]',
}

/** The append-only audit trail for one card, rendered as a vertical timeline. */
export function CardHistory({ events }: { events: CardEvent[] }) {
  if (events.length === 0) {
    return <p className="py-2 text-xs text-slate-500">No events recorded yet.</p>
  }
  return (
    <ol className="relative ml-1 flex flex-col gap-3.5 border-l border-[#2c2e35] pl-4">
      {events.map((event) => (
        <li key={event.id} className="relative">
          <span
            className={`absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full ring-4 ${DOT[eventTone(event.type)]}`}
          />
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs font-bold text-slate-200">{EVENT_LABEL[event.type]}</span>
            <span className="shrink-0 font-mono text-[10px] text-slate-400">
              {formatTime(event.at)}
            </span>
          </div>
          {event.detail && <p className="mt-0.5 text-xs text-slate-400 font-mono">{event.detail}</p>}
        </li>
      ))}
    </ol>
  )
}
