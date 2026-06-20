import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { ChevronLeft } from 'lucide-react'

type TabType = 'available' | 'expired'

interface Coupon {
  id: string
  amount: number
  type: string
  status: string
  expires_at: string
  created_at: string
}

export default function MyCoupons() {
  const navigate = useNavigate()
  const { address } = useAccount()
  const [activeTab, setActiveTab] = useState<TabType>('available')
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!address) { setLoading(false); return }
    ;(async () => {
      try {
        const r = await fetch(`/api/coupons/list?user_address=${address}`)
        const j = await r.json()
        if (r.ok) setCoupons(j.coupons || [])
      } catch {} finally { setLoading(false) }
    })()
  }, [address])

  const now = new Date()
  const availableCoupons = coupons.filter(c => c.status === 'active' && new Date(c.expires_at) > now)
  const expiredCoupons = coupons.filter(c => c.status === 'expired' || new Date(c.expires_at) <= now)
  const displayList = activeTab === 'available' ? availableCoupons : expiredCoupons
  const isExpired = activeTab === 'expired'

  return (
    <div className="text-white flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-[#343438] bg-black backdrop-blur">
        <div className="flex items-center justify-between px-4 py-2">
          <button
            onClick={() => navigate('/profile')}
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-zinc-800 transition-colors"
            aria-label="返回"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="text-sm font-semibold">我的代金券</h1>
          <div className="h-8 w-8" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-4">
        <button
          onClick={() => setActiveTab('available')}
          className={`flex-1 py-1.5 px-4 rounded-lg border text-xs font-medium transition-all ${
            activeTab === 'available'
              ? 'bg-zinc-800 border-blue-500 text-blue-400'
              : 'bg-transparent border-[#343438] text-zinc-400'
          }`}
        >
          当前可用（{availableCoupons.length}）
        </button>
        <button
          onClick={() => setActiveTab('expired')}
          className={`flex-1 py-1.5 px-4 rounded-lg border text-xs font-medium transition-all ${
            activeTab === 'expired'
              ? 'bg-zinc-800 border-blue-500 text-blue-400'
              : 'bg-transparent border-[#343438] text-zinc-400'
          }`}
        >
          已过期（{expiredCoupons.length}）
        </button>
      </div>

      {/* Coupon List */}
      <div className="px-4 py-2 space-y-2">
        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-6 w-6 border-t-2 border-blue-500" /></div>
        ) : displayList.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-zinc-400 text-xs text-center">
              {activeTab === 'available' ? '暂无可用代金券，去邀请朋友获取吧' : '暂无已过期的代金券'}
            </p>
          </div>
        ) : (
          displayList.map((coupon) => (
            <div
              key={coupon.id}
              className={`rounded-lg p-3 border transition-all flex items-center gap-3 ${
                isExpired
                  ? 'bg-zinc-900 border-[#343438] opacity-50'
                  : 'bg-zinc-800 border-amber-500'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-bold mb-1 ${isExpired ? 'text-zinc-500' : 'text-amber-400'}`}>
                  {coupon.amount.toFixed(2)} USDT
                </div>
                <div className={`text-xs ${isExpired ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  到期时间：{coupon.expires_at?.slice(0, 10) || '--'}
                </div>
                <div className={`text-xs ${isExpired ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  来源：邀请奖励
                </div>
              </div>
              <div className="flex-shrink-0 flex flex-col items-end">
                <div className={`text-xl font-black ${isExpired ? 'text-zinc-700' : 'text-zinc-600'}`}>
                  COUPON
                </div>
                <div className={`text-[10px] mt-0.5 whitespace-nowrap ${isExpired ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  支付时自动优先使用此券
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
