import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider, useConnect, useDisconnect } from 'wagmi'
import { useEffect } from 'react'
import { config } from '../config/wagmi'

const queryClient = new QueryClient()

const wiseScanDarkTheme = darkTheme({
  accentColor: '#3b82f6',
  accentColorForeground: '#ffffff',
  borderRadius: 'medium',
  fontStack: 'system',
  overlayBlur: 'large',
})

/** 监听连接失败 → 自动清理状态（防止 modal 卡死） */
function ConnectErrorHandler() {
  const { error } = useConnect()
  const { disconnect } = useDisconnect()

  useEffect(() => {
    if (error) {
      console.warn('🔌 钱包连接失败，自动清理状态:', error.message)
      disconnect()
    }
  }, [error, disconnect])

  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={wiseScanDarkTheme}>
          <ConnectErrorHandler />
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
