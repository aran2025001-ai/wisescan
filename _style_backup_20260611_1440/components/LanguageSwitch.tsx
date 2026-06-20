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
        className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))] transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5zm7.75 9.75a.75.75 0 000-1.5h-4.5a.75.75 0 000 1.5h4.5z" clipRule="evenodd" />
        </svg>
        中文
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-32 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--popover))] shadow-lg py-1 z-50">
          {[
            { label: '中文', active: true },
            { label: 'English', active: false, disabled: true },
          ].map((lang) => (
            <button
              key={lang.label}
              disabled={'disabled' in lang && lang.disabled}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                lang.active
                  ? 'text-[hsl(var(--primary))] bg-[hsl(var(--accent))] font-medium'
                  : lang.disabled
                    ? 'text-[hsl(var(--muted-foreground))] cursor-not-allowed'
                    : 'text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))]'
              }`}
            >
              {lang.label}
              {lang.disabled && (
                <span className="ml-1 text-xs opacity-60">(即将上线)</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
