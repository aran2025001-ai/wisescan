import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { ChevronLeft, Copy, User } from 'lucide-react'
import ShareButton from '../components/ShareButton'

export default function InvitationRebate() {
  const navigate = useNavigate()
  const { address } = useAccount()
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const [stats, setStats] = useState({ invite_count: 0, total_commission: 0, available_balance: 0, active_coupons: 0 })
  const [inviteUrl, setInviteUrl] = useState('')
  const [history, setHistory] = useState<any[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const minimumWithdraw = 5.0

  useEffect(() => {
    if (!address) return
    fetchStats()
    fetchInviteLink()
    fetchHistory()
  }, [address])

  const fetchStats = async () => {
    try {
      const r = await fetch(`/api/invite/stats?user_address=${address}`)
      const j = await r.json()
      if (r.ok) setStats(j)
    } catch {}
  }

  const fetchInviteLink = async (): Promise<string | null> => {
    try {
      const r = await fetch(`/api/invite/generate?user_address=${address}`)
      const j = await r.json()
      if (j.invite_url) {
        setInviteUrl(j.invite_url)
        return j.invite_url
      }
    } catch {}
    return null
  }

  const fetchHistory = async () => {
    try {
      const r = await fetch(`/api/invite/history?user_address=${address}`)
      const j = await r.json()
      if (r.ok) setHistory(j.invitations || [])
    } catch {}
  }

  const handleFillAll = () => {
    setWithdrawAmount(stats.available_balance.toString())
  }

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount)
    if (!withdrawAmount || isNaN(amount) || amount <= 0 || amount > stats.available_balance) {
      setToastMessage('金额无效')
      return
    }
    if (amount < minimumWithdraw) {
      setToastMessage('需满 5 USDT 才可提现')
      return
    }
    try {
      const r = await fetch('/api/withdraw/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_address: address, amount, address }),
      })
      const j = await r.json()
      if (r.ok) {
        setToastMessage('提现申请已提交，将在3个工作日内处理')
        setWithdrawAmount('')
        fetchStats()
      } else {
        setToastMessage(j.error || '提现失败')
      }
    } catch {
      setToastMessage('网络错误')
    }
  }

  const handleCopyLink = async () => {
    if (!address) { setToastMessage('请先连接钱包'); return }

    // 如果邀请链接还没加载好，主动调 API 获取
    let url = inviteUrl
    if (!url) {
      setToastMessage('正在获取邀请链接...')
      const result = await fetchInviteLink()
      if (!result) { setToastMessage('获取邀请链接失败，请重试'); return }
      url = result
    }

    const code = url.split('code=')[1] || ''
    if (!code) { setToastMessage('邀请码异常，请重试'); return }
    const linkToCopy = `明鉴WiseScan — 守护你的每一次投资决策\n项目风险评估、商业模式拆解，让你和专家一对一详聊项目细节。\n用Web3浏览器打开链接（如TP钱包等）：\n${window.location.origin}/invite?code=${code}`
    // 兼容不支持 Clipboard API 的 WebView（如 TP 钱包）
    try {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(linkToCopy)
          .then(() => setToastMessage('链接已复制，快去邀请好友吧'))
          .catch(() => fallbackCopy(linkToCopy))
      } else {
        fallbackCopy(linkToCopy)
      }
    } catch {
      fallbackCopy(linkToCopy)
    }
  }
  const fallbackCopy = (text: string) => {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.focus()
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setToastMessage('链接已复制，快去邀请好友吧')
    } catch {
      setToastMessage('复制失败，请手动复制链接')
    }
  }

  return (
    <div className="text-white flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-[#343438] bg-black backdrop-blur">
        <div className="flex items-center justify-between px-4 py-2">
          <button onClick={() => navigate('/profile')} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-zinc-800 active:bg-zinc-700 active:scale-[0.95] transition-all duration-150" aria-label="返回">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="text-sm font-semibold">邀请返佣</h1>
          <div className="h-8 w-8" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        {/* Stats Card */}
        <div className="bg-zinc-800 rounded-lg p-4 mb-2">
          <div className="flex justify-between text-center">
            <div className="flex-1">
              <div className="text-sm font-bold text-blue-400 mb-2">{stats.invite_count}人</div>
              <div className="text-xs text-zinc-400">邀请人数</div>
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-blue-400 mb-2">{stats.total_commission.toFixed(2)} U</div>
              <div className="text-xs text-zinc-400">累计返佣</div>
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-blue-400 mb-2">{stats.available_balance.toFixed(2)} U</div>
              <div className="text-xs text-zinc-400">可提现金额</div>
            </div>
          </div>
        </div>

        <p className="text-xs text-zinc-500 pl-1 mb-5">
          每邀请一人连接钱包 → 获 2.99U 代金券（抵扣服务）
          <br />
          每邀请一人完成首次付费 → 获 0.5U 返佣（满5U可提现）
          <br />
          当前可用代金券：{stats.active_coupons} 张
        </p>

        {/* Withdrawal Section */}
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-white mb-3">提现</h2>
          <div className="grid grid-cols-[1fr_auto] gap-3 mb-3">
            <input type="number" placeholder="输入提现金额" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)}
              className="h-10 px-3 py-2 bg-zinc-800 text-white text-xs rounded-lg border border-[#343438] placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full" />
            <button onClick={handleFillAll} className="h-10 px-4 border border-[#343438] bg-transparent text-white text-xs rounded-lg hover:bg-zinc-700 active:bg-zinc-600 active:scale-[0.97] transition-all duration-150">全部</button>
            <button onClick={handleWithdraw} className="h-10 px-4 bg-blue-500 hover:bg-blue-600 active:bg-blue-400 active:scale-[0.97] text-white text-sm font-semibold rounded-lg transition-all duration-150 w-full">提现</button>
            <button onClick={() => navigate('/profile/withdrawal')} className="h-10 px-4 bg-transparent text-zinc-400 hover:text-white active:text-zinc-200 text-xs transition-colors whitespace-nowrap">提现历史</button>
          </div>
          <div className="text-[12px] text-zinc-500 text-left mt-3">需满 5 USDT 才可提现，每月封顶 20 USDT，提现将在3个工作日内处理。</div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mb-6">
          <button onClick={handleCopyLink} className="flex-1 h-10 border border-[#343438] bg-transparent text-blue-400 text-xs font-semibold rounded-lg hover:bg-blue-500/10 active:bg-blue-500/20 active:scale-[0.97] transition-all duration-150 flex items-center justify-center gap-2">
            <Copy size={16} /><span>复制邀请链接</span>
          </button>
          <ShareButton
            inviteCode={inviteUrl.split('code=')[1] || ''}
            label="邀请好友"
            className="flex-1 h-10 border border-[#343438] bg-transparent text-blue-400 text-xs font-semibold rounded-lg hover:bg-blue-500/10 active:bg-blue-500/20 active:scale-[0.97] transition-all duration-150 flex items-center justify-center gap-2"
          />
        </div>

        {/* Invitation History */}
        <div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center justify-between w-full py-2 text-xs text-zinc-400 hover:text-white active:text-zinc-200 transition-colors"
          >
            <span>邀请记录（{stats.invite_count}）</span>
            <span className={`transform transition-transform ${showHistory ? 'rotate-180' : ''}`}>▼</span>
          </button>
          {showHistory && (
            <div className="space-y-2 mt-1">
              {history.filter(h => h.invitee).length === 0 ? (
                <div className="text-center py-6 text-zinc-500 text-xs">暂无邀请记录</div>
              ) : (
                history.filter(h => h.invitee).map((h) => (
                  <div key={h.id} className="bg-zinc-800/50 rounded-lg px-3 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <User size={14} className="text-zinc-500 flex-shrink-0" />
                      <span className="text-xs text-zinc-300 font-mono truncate">{h.invitee?.slice(0, 8)}...</span>
                    </div>
                    <span className="text-[12px] text-zinc-500 flex-shrink-0">{h.connected_at?.slice(0, 10) || h.created_at?.slice(0, 10)}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toastMessage && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[99999]" onClick={() => setToastMessage(null)}>
          <div className="bg-zinc-900 rounded-lg p-4 w-80 mx-4 space-y-3 border border-[#343438]" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-white font-semibold text-sm text-center">提示</h2>
            <p className="text-zinc-300 text-xs leading-relaxed text-left">{toastMessage}</p>
            <button onClick={() => setToastMessage(null)} className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-500 active:scale-[0.97] text-white rounded-lg transition-all duration-150 text-sm">确定</button>
          </div>
        </div>
      )}
    </div>
  )
}

