import { useState, useEffect } from 'react'
import type { Card } from '../../core/domain/models'
import { ActivityIcon, RefreshIcon } from '../components/icons'

export function StatsPage() {
  const [allCards, setAllCards] = useState<Card[]>([])
  
  useEffect(() => {
    const loadCards = async () => {
      try {
        const cards = await window.cardApi.listAllCards()
        setAllCards(cards)
      } catch (e) {
        console.error('Failed to load global cards', e)
      }
    }
    loadCards()
  }, [])

  const activeCards = allCards.filter(c => c.status === 'ACTIVE').length
  const voidCards = allCards.filter(c => c.status === 'VOID' || c.status === 'LOST').length
  const totalCards = allCards.length

  // Group cards by last 7 days
  const last7Days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return {
      dateStr: d.toISOString().split('T')[0],
      label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      activeCount: 0,
      voidCount: 0
    }
  })

  allCards.forEach(c => {
    const dStr = new Date(c.createdAt).toISOString().split('T')[0]
    const bucket = last7Days.find(b => b.dateStr === dStr)
    if (bucket) {
      if (c.status === 'ACTIVE') bucket.activeCount++
      else if (c.status === 'VOID' || c.status === 'LOST') bucket.voidCount++
    }
  })

  // Calculate the maximum value to scale the bars properly (minimum of 1 to avoid divide by zero)
  const maxCount = Math.max(...last7Days.map(b => Math.max(b.activeCount, b.voidCount)), 1)

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Statistics</h2>
          <p className="text-sm text-slate-400 mt-1">Detailed breakdown of card issuance and system activity</p>
        </div>
        <button
          type="button"
          className="flex items-center gap-2 rounded-xl bg-[#1e2025] px-4 py-2 text-xs font-bold text-slate-300 border border-[#2c2e35] transition hover:bg-[#282a30] hover:text-white"
        >
          <RefreshIcon className="text-sm" />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Grid: KPIs */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div className="flex flex-col justify-between rounded-3xl bg-[#222429] p-7 border border-[#2c2e35]/60 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Issued</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#3b66f5]/10 text-[#3b66f5]">
              <ActivityIcon className="text-sm" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-4xl font-black text-white">{totalCards}</p>
            <p className="mt-1 text-xs text-slate-500">Total cards processed by the system</p>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-3xl bg-[#222429] p-7 border border-[#2c2e35]/60 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Cards</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#d8ff3e]/10 text-[#d8ff3e]">
              <ActivityIcon className="text-sm" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-4xl font-black text-white">{activeCards}</p>
            <p className="mt-1 text-xs text-slate-500">Currently active in circulation</p>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-3xl bg-[#222429] p-7 border border-[#2c2e35]/60 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Void / Lost</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/10 text-red-500">
              <ActivityIcon className="text-sm" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-4xl font-black text-white">{voidCards}</p>
            <p className="mt-1 text-xs text-slate-500">Cards marked as void or lost</p>
          </div>
        </div>
      </div>
      
      {/* Charts Area */}
      <div className="rounded-3xl bg-[#222429] p-8 border border-[#2c2e35]/60 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-base font-bold text-white">Issuance Trends</h3>
          <div className="flex items-center gap-1.5 rounded-full bg-[#1c1d21] px-4 py-1.5 text-xs font-semibold text-slate-300 border border-[#2c2e35]">
            <span>Last 7 Days</span>
          </div>
        </div>
        
        {/* Real Dynamic Bar Chart */}
        <div className="relative flex h-48 w-full items-end justify-between border-b border-[#2c2e35]/60 pb-2 pt-6 gap-2">
          {/* Grid lines */}
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
            <div className="w-full border-t border-dashed border-[#2c2e35]/40 h-0"></div>
            <div className="w-full border-t border-dashed border-[#2c2e35]/40 h-0"></div>
            <div className="w-full border-t border-dashed border-[#2c2e35]/40 h-0"></div>
            <div className="w-full border-t border-dashed border-[#2c2e35]/40 h-0"></div>
          </div>

          {last7Days.map((day, i) => {
            const activeHeight = `${(day.activeCount / maxCount) * 100}%`
            const voidHeight = `${(day.voidCount / maxCount) * 100}%`

            return (
              <div key={i} className="relative z-10 flex flex-1 flex-col items-center justify-end h-full">
                <div className="flex w-full max-w-[40px] items-end justify-center gap-1.5 h-full">
                  <div 
                    className="w-1/2 rounded-t-sm bg-[#3b66f5] transition-all hover:brightness-125 hover:shadow-[0_0_8px_rgba(59,102,245,0.5)] cursor-pointer" 
                    style={{ height: voidHeight, minHeight: day.voidCount > 0 ? '4px' : '0px' }}
                    title={`Void/Lost: ${day.voidCount}`}
                  />
                  <div 
                    className="w-1/2 rounded-t-sm bg-[#d8ff3e] transition-all hover:brightness-125 hover:shadow-[0_0_8px_rgba(216,255,62,0.5)] cursor-pointer" 
                    style={{ height: activeHeight, minHeight: day.activeCount > 0 ? '4px' : '0px' }}
                    title={`Active: ${day.activeCount}`}
                  />
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-4 flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider">
          {last7Days.map((day, i) => (
            <span key={i} className="flex-1 text-center">{day.label}</span>
          ))}
        </div>
        
        {/* Legend */}
        <div className="mt-6 flex justify-center gap-6 border-t border-[#2c2e35]/40 pt-4">
          <div className="flex items-center gap-2">
            <span className="block h-2.5 w-2.5 rounded-full bg-[#d8ff3e]"></span>
            <span className="text-xs font-semibold text-slate-400">Active</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="block h-2.5 w-2.5 rounded-full bg-[#3b66f5]"></span>
            <span className="text-xs font-semibold text-slate-400">Void / Lost</span>
          </div>
        </div>
      </div>
    </div>
  )
}
