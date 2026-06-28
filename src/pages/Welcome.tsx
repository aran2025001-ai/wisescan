import { useEffect, useRef, useState, useCallback } from 'react'
import { useAccount, useConnect } from 'wagmi'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, Wallet, X } from 'lucide-react'
import { LanguageSwitch } from '../components/LanguageSwitch'

export default function Welcome() {
  const { isConnected, status, address } = useAccount()
  const { connectors, connect } = useConnect()
  const navigate = useNavigate()
  const connectRequested = useRef(false)
  const [userCount, setUserCount] = useState('500')
  const [showModal, setShowModal] = useState(false)

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

  // 检测是否已安装（注入钱包）
  const isInstalled = useCallback((connector: any) => {
    if (typeof window === 'undefined') return false
    try {
      // RainbowKit injected wallet 连接器名称通常包含 "Injected" 或 "Browser"
      return connector.name && typeof connector.name === 'string'
    } catch { return false }
  }, [])

  // 对钱包排序：已安装（注入）的放前面，WalletConnect 放最后
  const sortedConnectors = [...connectors].sort((a, b) => {
    const aInstalled = isInstalled(a)
    const bInstalled = isInstalled(b)
    if (aInstalled && !bInstalled) return -1
    if (!aInstalled && bInstalled) return 1
    // WalletConnect 放最后
    if (a.name.includes('WalletConnect')) return 1
    if (b.name.includes('WalletConnect')) return -1
    return 0
  })

  const handleConnect = (connector: any) => {
    connectRequested.current = true
    setShowModal(false)
    connect({ connector })
  }

  const getWalletIcon = (name: string) => {
    const icons: Record<string, string> = {
      'MetaMask': '🦊',
      'TokenPocket': '🔷',
      'imToken': '🔶',
      'Trust': '🟣',
      'OKX': '🟠',
      'Coinbase': '🔵',
      'WalletConnect': '🔗',
      'Brave': '🦁',
      'Rabby': '🔴',
      'SafePal': '🟢',
      'Bitget': '🟡',
      'Bybit': '💠',
      'Coin98': '🔷',
      'OneKey': '🔑',
    }
    for (const [key, emoji] of Object.entries(icons)) {
      if (name.includes(key)) return emoji
    }
    return '💼'
  }

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
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center justify-center gap-2 px-0 py-3 rounded-full bg-blue-500 text-white font-semibold text-sm hover:bg-blue-600 transition-colors btn-glow"
            style={{ width: '220px' }}
          >
            <Wallet className="w-4 h-4" strokeWidth={2} />
            连接钱包
          </button>

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

      {/* ===== 自定义钱包选择弹窗 ===== */}
      {showModal && (
        <>
          {/* 遮罩层 */}
          <div
            className="fixed inset-0 bg-black/60 z-40"
            onClick={() => setShowModal(false)}
          />
          {/* 弹窗 */}
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-900 rounded-t-2xl border-t border-zinc-800 max-h-[70vh] overflow-y-auto animate-slide-up">
            {/* 顶部栏 */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
              <h2 className="text-sm font-semibold text-white">连接钱包</h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-zinc-800 rounded-full transition-colors">
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>

            {/* 钱包列表 */}
            <div className="px-3 py-2 space-y-1">
              {sortedConnectors.map((connector) => (
                <button
                  key={connector.id}
                  onClick={() => handleConnect(connector)}
                  className="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl hover:bg-zinc-800/80 active:bg-zinc-800 transition-colors text-left"
                >
                  <span className="text-xl flex-shrink-0">{getWalletIcon(connector.name)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{connector.name}</span>
                      {connector.name.includes('WalletConnect') && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">扫码</span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5 truncate">
                      {connector.name.includes('WalletConnect')
                        ? '通过 WalletConnect 扫码连接'
                        : `连接${connector.name}钱包`}
                    </p>
                  </div>
                  <svg className="w-4 h-4 text-zinc-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* 弹窗动画 */}
      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.25s ease-out;
        }
      `}</style>
    </div>
  )
}
