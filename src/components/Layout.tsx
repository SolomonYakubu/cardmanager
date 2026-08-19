import { Link, useLocation } from 'react-router-dom'
import { HomeIcon, PaletteIcon, SettingsIcon, SearchIcon, CardIcon, ChartIcon } from './icons'
import logoImg from '../assets/logo.png'

const NAV_ITEMS = [
  { name: 'Dashboard', path: '/', icon: HomeIcon },
  { name: 'Card Management', path: '/cards', icon: CardIcon },
  { name: 'Design Studio', path: '/designs', icon: PaletteIcon },
  { name: 'Statistics', path: '/stats', icon: ChartIcon },
]

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()

  return (
    <div className="flex h-screen w-full bg-[#16171a] font-sans text-slate-100 antialiased overflow-hidden">
      {/* ── Left Navigation Sidebar ─────────────────────────────────────── */}
      <aside className="flex w-20 flex-col items-center justify-between py-6 px-3 bg-[#191a1e] border-r border-[#22242a] shrink-0 z-30 select-none">
        {/* Logo */}
        <div className="flex flex-col items-center gap-6">
          <Link
            to="/"
            className="flex h-14 w-14 items-center justify-center hover:scale-105 transition"
          >
            <img src={logoImg} alt="UATH Logo" className="h-full w-full object-contain drop-shadow-md" />
          </Link>

          {/* Navigation Pill Cluster */}
          <nav className="flex flex-col items-center gap-3 bg-[#202227] p-2 rounded-3xl border border-[#272930]">
            {NAV_ITEMS.map((item) => {
              const isActive = location.pathname === item.path
              const Icon = item.icon
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  title={item.name}
                  className={`group relative flex h-11 w-11 items-center justify-center rounded-2xl transition-all duration-200 ${
                    isActive
                      ? 'bg-[#d8ff3e] text-black shadow-lg shadow-[#d8ff3e]/25 font-bold scale-105'
                      : 'text-slate-400 hover:bg-[#282a30] hover:text-white'
                  }`}
                >
                  <Icon className="text-xl" />
                  {/* Tooltip */}
                  <span className="pointer-events-none absolute left-14 z-50 whitespace-nowrap rounded-lg bg-[#282a30] px-3 py-1.5 text-xs font-semibold text-white opacity-0 shadow-xl transition group-hover:opacity-100 border border-[#34373f]">
                    {item.name}
                  </span>
                </Link>
              )
            })}
            
            <Link
              to="/settings"
              title="Settings"
              className={`flex h-11 w-11 items-center justify-center rounded-2xl transition ${
                location.pathname === '/settings'
                  ? 'bg-[#d8ff3e] text-black shadow-lg shadow-[#d8ff3e]/25 font-bold scale-105'
                  : 'text-slate-400 hover:bg-[#282a30] hover:text-white'
              }`}
            >
              <SettingsIcon className="text-xl" />
            </Link>
          </nav>
        </div>
      </aside>

      {/* ── Main Content Area ─────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top App Bar (Header) */}
        <header className="flex h-20 items-center justify-between px-8 bg-[#16171a] border-b border-[#202227]/60 shrink-0">
          
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <h1 className="text-sm font-black tracking-tight text-white uppercase">
                University of Abuja Teaching Hospital
              </h1>
              <p className="text-[10px] text-slate-400 font-medium">
                Card management system, powered by <span className="text-sky-400">Blueguava</span> & <span className="text-orange-500">Xenolink</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Search Pill */}
            <div className="relative flex items-center">
              <SearchIcon className="absolute left-4 text-slate-400 text-base" />
              <input
                type="text"
                placeholder="Search patient, card ID, NFC..."
                className="w-72 rounded-full bg-[#23252b] py-2.5 pl-11 pr-5 text-xs text-slate-200 placeholder-slate-400 outline-none border border-[#2c2e35] transition focus:border-[#d8ff3e] focus:bg-[#282a31]"
              />
            </div>

            {/* Quick Action Pill Button (Blue like the "Premium" pill in reference) */}
            <Link
              to="/cards"
              className="flex items-center gap-2 rounded-full bg-[#3b66f5] px-6 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-[#3b66f5]/25 transition hover:bg-[#3258db] active:scale-95"
            >
              <CardIcon className="text-sm" />
              <span>Issue Card</span>
            </Link>
          </div>
        </header>

        {/* Page View Container */}
        <main className="flex-1 overflow-y-auto bg-[#16171a] p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
