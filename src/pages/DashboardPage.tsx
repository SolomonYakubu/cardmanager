import { Link, useNavigate } from 'react-router-dom'
import { CardIcon, PaletteIcon, ChartIcon, SettingsIcon, PlusIcon } from '../components/icons'

export function DashboardPage() {
  const navigate = useNavigate()

  const quickModules = [
    {
      title: 'Card Management',
      desc: 'Issue & encode credentials',
      icon: <CardIcon className="text-4xl" />,
      link: '/cards',
      color: 'text-indigo-400',
      hoverColor: 'group-hover:text-indigo-300',
      bg: 'bg-gradient-to-br from-[#2a2d35] to-[#1c1d22]',
      hoverBg: 'hover:border-indigo-500/50 hover:shadow-indigo-500/10'
    },
    {
      title: 'Design Studio',
      desc: 'Author custom templates',
      icon: <PaletteIcon className="text-4xl" />,
      link: '/designs',
      color: 'text-pink-400',
      hoverColor: 'group-hover:text-pink-300',
      bg: 'bg-gradient-to-bl from-[#2a2d35] to-[#1c1d22]',
      hoverBg: 'hover:border-pink-500/50 hover:shadow-pink-500/10'
    },
    {
      title: 'System Analytics',
      desc: 'View issuance trends',
      icon: <ChartIcon className="text-4xl" />,
      link: '/stats',
      color: 'text-amber-400',
      hoverColor: 'group-hover:text-amber-300',
      bg: 'bg-gradient-to-tr from-[#2a2d35] to-[#1c1d22]',
      hoverBg: 'hover:border-amber-500/50 hover:shadow-amber-500/10'
    },
    {
      title: 'Settings',
      desc: 'Configure hardware',
      icon: <SettingsIcon className="text-4xl" />,
      link: '/settings',
      color: 'text-slate-400',
      hoverColor: 'group-hover:text-slate-300',
      bg: 'bg-gradient-to-tl from-[#2a2d35] to-[#1c1d22]',
      hoverBg: 'hover:border-slate-500/50 hover:shadow-slate-500/10'
    }
  ]

  // Dynamic cutout styles for the 4 tiles
  const getMaskStyle = (index: number) => {
    const r = '68px' // Cutout radius (leaves a clean gap around the 112px central button)
    const offset = '8px' // Half of gap-4 (16px)
    let origin = ''
    if (index === 0) origin = `calc(100% + ${offset}) calc(100% + ${offset})`
    if (index === 1) origin = `calc(0% - ${offset}) calc(100% + ${offset})`
    if (index === 2) origin = `calc(100% + ${offset}) calc(0% - ${offset})`
    if (index === 3) origin = `calc(0% - ${offset}) calc(0% - ${offset})`

    return {
      WebkitMaskImage: `radial-gradient(circle at ${origin}, transparent ${r}, black calc(${r} + 1px))`,
      maskImage: `radial-gradient(circle at ${origin}, transparent ${r}, black calc(${r} + 1px))`
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-80px)] w-full flex-col items-center justify-center font-sans">
      
      {/* ── Subdued Header ── */}
      <div className="mb-12 text-center">
        <h1 className="text-2xl font-black uppercase tracking-[0.2em] text-slate-500">Home</h1>
      </div>

      {/* ── Centered Grid HUD ── */}
      <div className="relative">
        
        {/* The 2x2 Grid */}
        <div className="grid grid-cols-2 gap-4 w-[600px] h-[600px]">
          {quickModules.map((m, i) => (
            <Link
              key={m.title}
              to={m.link}
              className={`group relative flex flex-col items-center justify-center gap-6 rounded-3xl border border-[#2c2e35]/60 p-8 shadow-md transition-all duration-300 hover:scale-[1.02] hover:shadow-xl ${m.bg} ${m.hoverBg} hover:z-10`}
              style={getMaskStyle(i)}
            >
              <div className={`${m.color} ${m.hoverColor} transition-colors duration-300 drop-shadow-lg`}>
                {m.icon}
              </div>
              <div className="text-center">
                <h3 className="text-xl font-black tracking-tight text-white transition-colors duration-300 group-hover:text-white">{m.title}</h3>
                <p className="mt-2 text-xs font-bold uppercase tracking-widest text-slate-500 transition-colors duration-300 group-hover:text-slate-400">{m.desc}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* The 3D Central Button */}
        <button
          onClick={() => navigate('/cards')}
          className="group absolute left-1/2 top-1/2 flex h-28 w-28 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-gradient-to-br from-[#353842] via-[#222429] to-[#15161a] border border-[#444855] shadow-[0_15px_35px_-10px_rgba(0,0,0,0.8),inset_0_4px_10px_rgba(255,255,255,0.1),inset_0_-4px_10px_rgba(0,0,0,0.5)] transition-all duration-300 hover:scale-[1.05] hover:shadow-[0_20px_45px_-10px_rgba(216,255,62,0.3),inset_0_4px_10px_rgba(255,255,255,0.1),inset_0_-4px_10px_rgba(0,0,0,0.5)] hover:border-[#d8ff3e]/50 active:scale-95 active:shadow-[inset_0_6px_15px_rgba(0,0,0,0.8)]"
          title="Quick Issue Credential"
        >
          {/* Inner Glowing Core */}
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#1c1d22] border border-[#2c2e35] shadow-[inset_0_2px_5px_rgba(0,0,0,0.6)] transition-colors duration-300 group-hover:bg-[#d8ff3e]/10 group-hover:border-[#d8ff3e]/40">
            <PlusIcon className="text-3xl font-black text-[#d8ff3e] drop-shadow-[0_0_8px_rgba(216,255,62,0.6)] transition-all duration-300 group-hover:rotate-90 group-hover:drop-shadow-[0_0_12px_rgba(216,255,62,0.9)]" />
          </div>
        </button>
      </div>

    </div>
  )
}
