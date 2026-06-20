import { useEffect } from 'react'
import { useAccount } from 'wagmi'
import { useNavigate } from 'react-router-dom'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Globe, ShieldCheck, Wallet } from 'lucide-react'
import { LanguageSwitch } from '../components/LanguageSwitch'

export default function Welcome() {
  const { isConnected, status, address } = useAccount()
  const navigate = useNavigate()

  // 钱包已连接时自动跳转到主页
  useEffect(() => {
    if (status === 'connected' && isConnected && address) {
      navigate('/home', { replace: true })
    }
  }, [status, isConnected, address, navigate])

  return (
    <div className="flex flex-col p-4">
      {/* 右上角：语言选择 */}
      <div className="w-full flex justify-end pt-2">
        <LanguageSwitch />
      </div>

      {/* 中央内容区 */}
      <div className="flex flex-col items-center justify-center flex-1">
        {/* 盾牌图标 + 服务标语 */}
        <div className="mb-10 px-3 py-2 rounded-lg bg-zinc-900/40 border border-zinc-800/60 inline-block">
          <div className="flex items-center justify-center gap-2">
            <div className="text-blue-400">
              <ShieldCheck className="w-4 h-4" strokeWidth={2.5} />
            </div>
            <span className="text-zinc-300 text-xs font-medium">
              项目安全评估  ▏  商业模式分析
            </span>
          </div>
        </div>

        {/* Logo */}
        <div className="mb-10 flex justify-center">
          <img
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/%E6%AD%A3%E5%BC%8F%E7%89%88logo2-8e1Ath0FZwLY2COXomDZv7V5N2uQRZ.png"
            alt="WiseScan Logo"
            className="h-48 w-auto object-contain"
          />
        </div>

        {/* 品牌口号 */}
        <h1 className="text-base font-light text-white text-center mb-14 tracking-wider">
          投前查一查，少亏冤枉钱
        </h1>

        {/* 连接钱包按钮 — 使用 RainbowKit */}
        <ConnectButton.Custom>
          {({ openConnectModal }) => (
            <button
              onClick={openConnectModal}
              className="flex items-center justify-center gap-2 px-12 py-3 rounded-full bg-blue-500 text-white font-semibold text-sm hover:bg-blue-600 transition-colors btn-glow"
            >
              <Wallet className="w-4 h-4" strokeWidth={2} />
              连接钱包
            </button>
          )}
        </ConnectButton.Custom>
      </div>

      {/* 底部社交证明 */}
      <div className="w-full flex justify-center pb-12">
        <p className="text-center text-xs text-zinc-500">
          已有<span className="font-semibold text-zinc-400">500+</span>位用户使用明鉴进行项目评估
        </p>
      </div>
    </div>
  )
}
