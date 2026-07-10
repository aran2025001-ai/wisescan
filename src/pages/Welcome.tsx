import { useEffect, useRef, useState } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, Wallet } from 'lucide-react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { LanguageSwitch } from '../components/LanguageSwitch'

export default function Welcome() {
  const { isConnected, status, address } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const navigate = useNavigate()
  const [userCount, setUserCount] = useState('500')
  const signDone = useRef(false) // 是否已完成签名

  useEffect(() => {
    fetch('/api/site-config?key=display_user_count')
      .then(r => r.json())
      .then(data => {
        if (data.success && data.data?.display_user_count) setUserCount(data.data.display_user_count)
      })
      .catch(() => {})
  }, [])

  // 钱包连接后 → 立即触发钱包原生签名确认（图2）
  // 不显示任何自制弹窗
  useEffect(() => {
    if (status === 'connected' && isConnected && address && !signDone.current) {
      // 标记本会话已连接 → 后退导航不会误跳欢迎页
      try { sessionStorage.setItem('wisescan_wallet_connected', '1') } catch {}
      signDone.current = true
      ;(async () => {
        try {
          const nonce = Math.random().toString(36).substring(2, 10)
          const now = new Date().toISOString()
          const message =
            `欢迎使用 明鉴 WiseScan\n\n` +
            `请签署此消息以验证您的钱包所有权。\n` +
            `此签名免费，无需支付 Gas 费用。\n\n` +
            `地址: ${address}\n` +
            `Nonce: ${nonce}\n` +
            `时间: ${now}`
          await signMessageAsync({ message })
          // 签名成功 → 直接跳首页
          navigate('/home', { replace: true })
        } catch {
          // 用户取消签名 → 重置状态，可以重新尝试连接
          signDone.current = false
        }
      })()
    }
  }, [status, isConnected, address, navigate, signMessageAsync])

  return (
    <div className="min-h-screen flex flex-col p-4">
      <div className="w-full flex justify-end pt-2"><LanguageSwitch /></div>

      <div className="flex flex-col items-center flex-1 pt-16">
        <div className="mb-10 px-3 py-2 rounded-lg bg-zinc-900/40 border border-[#343438]/60 inline-block">
          <div className="flex items-center justify-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-400" strokeWidth={2.5} />
            <span className="text-zinc-300 text-xs font-medium flex items-center">
              <span>项目安全评估</span>
              <span className="w-[2px] h-3 bg-zinc-500 mx-2.5 rounded-full" />
              <span>商业模式分析</span>
            </span>
          </div>
        </div>

        <div className="mb-8 flex justify-center">
          <picture>
            <source srcSet="/logo.webp" type="image/webp" />
            <img src="/logo.png" alt="WiseScan" className="h-[173px] w-auto object-contain sm:h-[211px] md:h-[230px]" width={1254} height={1254} fetchPriority="high" />
          </picture>
        </div>

        <h1 className="text-base font-bold text-zinc-300 text-center tracking-wider">明鉴，让每一笔投资更清醒</h1>

        <div className="flex-1" />

        <div className="flex flex-col items-center">
          <ConnectButton.Custom>
            {({ openConnectModal, mounted }) => {
              if (!mounted) return <div style={{ width: 220, height: 44 }} className="rounded-full bg-blue-500/30" />
              return (
                <button
                  onClick={openConnectModal}
                  style={{ width: 220 }}
                  className="flex items-center justify-center gap-2 py-3 rounded-full bg-blue-500 text-white font-semibold text-sm hover:bg-blue-400 active:bg-blue-300 active:scale-[0.97] transition-all duration-150 shadow-[0_0_14px_rgba(59,130,246,0.3)] hover:shadow-[0_0_21px_rgba(59,130,246,0.6)]"
                >
                  <Wallet className="w-4 h-4" strokeWidth={2} />
                  连接钱包
                </button>
              )
            }}
          </ConnectButton.Custom>
          <p className="text-xs text-zinc-500 mt-3">投前查一查，少亏冤枉钱</p>
        </div>

        <div className="flex-1" />

        <p className="text-center text-xs text-zinc-500 mb-4">
          已有<span className="font-semibold text-zinc-400">{userCount}+</span>位用户使用明鉴进行项目评估
        </p>
      </div>
    </div>
  )
}
