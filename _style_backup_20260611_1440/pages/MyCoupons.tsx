import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

type TabType = 'available' | 'expired'

interface Coupon {
  id: string
  amount: number
  currency: string
  expiryDate: string
  source: string
}

const availableCoupons: Coupon[] = [
  {
    id: '1',
    amount: 2.99,
    currency: 'USDT',
    expiryDate: '2026-07-08',
    source: '邀请奖励',
  },
  {
    id: '2',
    amount: 0.5,
    currency: 'USDT',
    expiryDate: '2026-06-30',
    source: '分享奖励',
  },
]

const expiredCoupons: Coupon[] = [
  {
    id: '3',
    amount: 0.3,
    currency: 'USDT',
    expiryDate: '2026-05-01',
    source: '贡献奖励',
  },
]

export default function MyCoupons() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabType>('available')

  const coupons = activeTab === 'available' ? availableCoupons : expiredCoupons
  const isExpired = activeTab === 'expired'

  return (
    <div className="min-h-screen w-full max-w-md mx-auto" style={{ backgroundColor: '#000000' }}>
      <div className="flex items-center justify-center py-4 px-4 border-b border-gray-700">
        <button
          onClick={() => navigate('/profile')}
          className="absolute left-4 flex items-center justify-center w-8 h-8 text-gray-400 hover:text-white transition-colors"
          aria-label="返回"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-semibold text-white">我的代金券</h1>
      </div>

      <div className="flex gap-2 p-4">
        <button
          onClick={() => setActiveTab('available')}
          className="flex-1 py-2 px-4 rounded-lg border border-gray-600 text-sm font-medium transition-all"
          style={{
            backgroundColor: activeTab === 'available' ? '#2D2D3F' : 'transparent',
            color: activeTab === 'available' ? '#3B82F6' : '#9CA3AF',
          }}
        >
          当前可用
        </button>
        <button
          onClick={() => setActiveTab('expired')}
          className="flex-1 py-2 px-4 rounded-lg border border-gray-600 text-sm font-medium transition-all"
          style={{
            backgroundColor: activeTab === 'expired' ? '#2D2D3F' : 'transparent',
            color: activeTab === 'expired' ? '#3B82F6' : '#9CA3AF',
          }}
        >
          已过期
        </button>
      </div>

      <div className="px-4 py-2 space-y-3">
        {coupons.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-gray-400 text-sm text-center">暂无代金券，去邀请朋友获取吧</p>
          </div>
        ) : (
          coupons.map((coupon) => (
            <div
              key={coupon.id}
              className="rounded-lg p-4 border transition-all"
              style={{
                backgroundColor: '#1E1E2F',
                borderColor: isExpired ? '#4B5563' : '#F59E0B',
                opacity: isExpired ? 0.5 : 1,
              }}
            >
              <div className="flex justify-between items-start mb-3">
                <div
                  className="text-2xl font-bold"
                  style={{ color: isExpired ? '#6B7280' : '#F59E0B' }}
                >
                  {coupon.amount} {coupon.currency}
                </div>
              </div>
              <div className="space-y-1 mb-3">
                <div className="text-sm" style={{ color: isExpired ? '#6B7280' : '#9CA3AF' }}>
                  到期时间：{coupon.expiryDate}
                </div>
                <div className="text-sm" style={{ color: isExpired ? '#6B7280' : '#9CA3AF' }}>
                  来源：{coupon.source}
                </div>
              </div>
              <div
                className="text-xs text-center"
                style={{ color: isExpired ? '#6B7280' : '#9CA3AF' }}
              >
                支付时自动优先使用此券
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
