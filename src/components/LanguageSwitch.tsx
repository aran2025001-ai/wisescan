import { useState, useRef, useEffect } from 'react'

export function LanguageSwitch() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium bg-gradient-to-br from-zinc-800 to-zinc-900 border border-[#343438] hover:border-zinc-600 text-zinc-300 transition-all"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20" />
          <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
        </svg>
        中文
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-32 rounded-lg border border-[#343438] bg-zinc-900 shadow-lg py-1 z-50">
            {[
            { label: '中文', active: true },
            { label: 'English', active: false, disabled: true },
          ].map((lang) => (
            <button
              key={lang.label}
              disabled={'disabled' in lang && lang.disabled}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                lang.active
                  ? 'text-white bg-zinc-800 font-medium'
                  : lang.disabled
                    ? 'text-zinc-500 cursor-not-allowed'
                    : 'text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
