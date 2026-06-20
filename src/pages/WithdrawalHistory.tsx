import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { ChevronLeft, CheckCircle, Clock, XCircle } from 'lucide-react'

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  completed: { label: '已完成', color: 'text-green-400', icon: CheckCircle },
  pending: { label: '待处理', color: 'text-amber-400', icon: Clock },
  rejected: { label: '已拒绝', color: 'text-red-400', icon: XCircle },
}

export default function WithdrawalHistory() {
  const navigate = useNavigate()
  const { address } = useAccount()
  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!address) { setLoading(false); return }
    ;(async () => {
      try {
        const r = await fetch(`/api/withdraw/history?user_address=${address}`)
        const j = await r.json()
        if (r.ok) setRecords(j.withdrawals || [])
      } catch {} finally { setLoading(false) }
    })()
  }, [address])

  const statusBadge = (status: string) => {
    const cfg = statusConfig[status] || { label: status, color: 'text-zinc-400', icon: Clock }
    const Icon = cfg.icon
    return (
      <div className={`flex items-center gap-1 text-xs font-semibold ${cfg.color}`}>
        <Icon size={14} />
        <span>{cfg.label}</span>
      </div>
    )
  }

  return (
    <div className="text-white flex flex-col">
      <div className="sticky top-0 z-40 border-b border-[#343438] bg-black backdrop-blur">
        <div className="flex items-center justify-between px-4 py-2">
          <button onClick={() => navigate('/profile/invitation')} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-zinc-800 transition-colors" aria-label="返回">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="text-sm font-semibold">提现历史</h1>
          <div className="h-8 w-8" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-6 w-6 border-t-2 border-blue-500" /></div>
        ) : records.length > 0 ? (
          <div className="flex flex-col gap-3">
            {records.map((r) => (
              <div key={r.id} className="bg-zinc-800 rounded-lg p-4 flex justify-between items-center">
                <div className="flex-1">
                  <div className="text-sm font-semibold text-white mb-1">{parseFloat(r.amount).toFixed(2)} USDT</div>
                  <div className="text-xs text-zinc-400">{r.created_at?.slice(0, 10) || '--'}</div>
                </div>
                {statusBadge(r.status)}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-[300px] gap-3">
            <div className="text-sm text-zinc-500">暂无提现记录</div>
          </div>
        )}
      </div>
    </div>
  )
}
