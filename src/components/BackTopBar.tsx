import { useNavigate } from 'react-router-dom'
import { LanguageSwitch } from './LanguageSwitch'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'

interface BackTopBarProps {
  title: string
}

export function BackTopBar({ title }: BackTopBarProps) {
  const navigate = useNavigate()
  const { isConnected } = useAccount()

  return (
    <header className="sticky top-0 z-40 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 items-center justify-between max-w-2xl px-4">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center justify-center h-9 w-9 rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))] transition-colors"
          aria-label="返回"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
            <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
          </svg>
        </button>

        {/* Title */}
        <h1 className="text-sm font-semibold text-[hsl(var(--foreground))]">{title}</h1>

        {/* Right side: Lang + Wallet */}
        <div className="flex items-center gap-1">
          <LanguageSwitch />
          <ConnectButton
            key={String(isConnected)}
            showBalance={false}
            chainStatus="icon"
            accountStatus="avatar"
          />
        </div>
      </div>
    </header>
  )
}
