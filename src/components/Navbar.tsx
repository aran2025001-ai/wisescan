import { useTheme } from 'next-themes'
import { ConnectButton } from '@rainbow-me/rainbowkit'

export function Navbar() {
  const { theme, setTheme } = useTheme()

  return (
    <nav className="sticky top-0 z-50 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-bold text-sm">
            明
          </div>
          <span className="font-semibold text-lg tracking-tight text-[hsl(var(--foreground))]">
            明鉴 <span className="text-[hsl(var(--muted-foreground))] font-normal text-sm">WiseScan</span>
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {/* Theme Toggle */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm text-[hsl(var(--foreground))] shadow-sm transition-colors hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M10 2a.75.75 0 01.75.75v.258a1.5 1.5 0 001.448 1.49l.103.007h.257a.75.75 0 010 1.5h-.257a1.5 1.5 0 00-1.448 1.49l-.007.103v.257a.75.75 0 01-1.5 0v-.257a1.5 1.5 0 00-1.49-1.448l-.103.007h-.257a.75.75 0 010-1.5h.257a1.5 1.5 0 001.49-1.448l.007-.103V2.75A.75.75 0 0110 2z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M7.455 2.004a.75.75 0 01.26.77 7 7 0 009.958 9.958.75.75 0 011.067.258A8.5 8.5 0 117.455 2.004z" clipRule="evenodd" />
              </svg>
            )}
          </button>

          {/* Wallet Connect */}
          <ConnectButton
            showBalance={false}
            chainStatus="icon"
            accountStatus="avatar"
          />
        </div>
      </div>
    </nav>
  )
}
