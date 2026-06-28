import { useEffect, useRef, useState } from 'react'
import { useAccount } from 'wagmi'
import { useNavigate } from 'react-router-dom'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { ShieldCheck, Wallet } from 'lucide-react'
import { LanguageSwitch } from '../components/LanguageSwitch'

export default function Welcome() {
  const { isConnected, status, address } = useAccount()
  const navigate = useNavigate()
  const connectRequested = useRef(false)
  const [userCount, setUserCount] = useState('500')

  // 获取后台配置的用户展示数字
  useEffect(() => {
    fetch('/api/site-config?key=display_user_count')
      .then(r => r.json())
      .then(data => {
        if (data.success && data.data?.display_user_count) {
          setUserCount(data.data.display_user_count)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (status === 'connected' && isConnected && address && connectRequested.current) {
      navigate('/home', { replace: true })
    }
  }, [status, isConnected, address, navigate])

  return (
    <div className="min-h-screen flex flex-col p-4">
      {/* 右上角：语言选择 */}
      <div className="w-full flex justify-end pt-2">
        <LanguageSwitch />
      </div>

      {/* 内容区 */}
      <div className="flex flex-col items-center flex-1 pt-16">
        {/* 盾牌图标 + 服务标语 */}
        <div className="mb-10 px-3 py-2 rounded-lg bg-zinc-900/40 border border-[#343438]/60 inline-block">
          <div className="flex items-center justify-center gap-2">
            <div className="text-blue-400">
              <ShieldCheck className="w-4 h-4" strokeWidth={2.5} />
            </div>
            <span className="text-zinc-300 text-xs font-medium flex items-center justify-center">
              <span>项目安全评估</span>
              <span className="w-[2px] h-3 bg-zinc-500 mx-2.5 rounded-full"></span>
              <span>商业模式分析</span>
            </span>
          </div>
        </div>

        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <picture>
            <source srcSet="/logo.webp" type="image/webp" />
            <img
              src="/logo.png"
              alt="WiseScan Logo"
              className="h-48 w-auto object-contain"
              width={1254}
              height={1254}
              fetchPriority="high"
            />
          </picture>
        </div>

        {/* 品牌口号 */}
        <h1 className="text-base font-bold text-white text-center tracking-wider">
          明鉴，让每一笔投资更清醒
        </h1>

        {/* 将按钮+副标语推到 slogan 和底部文字之间的中间位置 */}
        <div className="flex-1" />

        {/* 连接钱包按钮 + 副标语 */}
        <div className="flex flex-col items-center">
          <ConnectButton.Custom>
            {({ openConnectModal }) => (
              <button
                onClick={() => {
                  connectRequested.current = true
                  openConnectModal()
                }}
                className="flex items-center justify-center gap-2 px-0 py-3 rounded-full bg-blue-500 text-white font-semibold text-sm hover:bg-blue-600 transition-colors btn-glow"
                style={{ width: '220px' }}
              >
                <Wallet className="w-4 h-4" strokeWidth={2} />
                连接钱包
              </button>
            )}
          </ConnectButton.Custom>

          <p className="text-xs text-zinc-500 mt-3 text-center">
            投前查一查，少亏冤枉钱
          </p>
        </div>

        {/* 将底部文字推到底部 */}
        <div className="flex-1" />

        {/* 底部社交证明 */}
        <p className="text-center text-xs text-zinc-500 mb-4">
          已有<span className="font-semibold text-zinc-400">{userCount}+</span>位用户使用明鉴进行项目评估
        </p>
      </div>
    </div>
  )
}
