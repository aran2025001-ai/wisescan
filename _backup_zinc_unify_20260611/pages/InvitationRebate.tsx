import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Copy, QrCode, X } from 'lucide-react'

export default function InvitationRebate() {
  const navigate = useNavigate()
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [isQRModalOpen, setIsQRModalOpen] = useState(false)

  const withdrawableBalance = 1.50
  const minimumWithdraw = 5.0

  const handleFillAll = () => {
    setWithdrawAmount(withdrawableBalance.toString())
  }

  const handleWithdraw = () => {
    const amount = parseFloat(withdrawAmount)

    if (!withdrawAmount || isNaN(amount) || amount <= 0 || amount > withdrawableBalance) {
      alert('金额无效')
      return
    }

    if (amount < minimumWithdraw) {
      alert('需满 5 USDT 才可提现')
      return
    }

    alert('提现申请已提交（演示模式）')
    setWithdrawAmount('')
  }

  const handleCopyLink = () => {
    const inviteLink = 'https://wisescan.io/invite?code=USER123'
    navigator.clipboard.writeText(inviteLink).then(() => {
      alert('链接已复制')
    }).catch(() => {
      alert('复制失败，请重试')
    })
  }

  const handleGenerateQR = () => {
    setIsQRModalOpen(true)
  }

  const handleCloseQRModal = () => {
    setIsQRModalOpen(false)
  }

  return (
    <div className="text-white flex flex-col">
      <div className="flex items-center justify-center py-4 px-4 border-b border-gray-700">
        <button
          onClick={() => navigate('/profile')}
          className="absolute left-4 flex items-center justify-center w-8 h-8 text-gray-400 hover:text-white transition-colors"
          aria-label="返回"
        >
          <ChevronLeft size={16} />
        </button>
        <h1 style={{ fontSize: '16px', fontWeight: 600 }} className="text-white">邀请返佣</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div style={{ backgroundColor: '#27272A', borderRadius: '12px', padding: '16px' }} className="mb-6">
          <div className="flex justify-between text-center">
            <div className="flex-1">
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#3B82F6' }} className="mb-2">3人</div>
              <div style={{ fontSize: '12px', color: '#9CA3AF' }}>邀请人数</div>
            </div>
            <div className="flex-1">
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#3B82F6' }} className="mb-2">1.50</div>
              <div style={{ fontSize: '12px', color: '#9CA3AF' }}>累计返佣</div>
            </div>
            <div className="flex-1">
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#3B82F6' }} className="mb-2">1.50</div>
              <div style={{ fontSize: '12px', color: '#9CA3AF' }}>可提现金额</div>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF', marginTop: '20px', marginBottom: '12px' }} className="text-left">提现</h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', marginBottom: '12px' }}>
            <input
              type="number"
              placeholder="输入提现金额"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              style={{
                backgroundColor: '#27272A',
                borderRadius: '8px',
                padding: '10px',
                fontSize: '12px',
                color: '#FFFFFF',
                height: '40px',
                width: '100%',
                border: 'none',
                outline: 'none'
              }}
              onFocus={(e) => e.target.style.boxShadow = 'inset 0 0 0 1px #3B82F6'}
              onBlur={(e) => e.target.style.boxShadow = 'none'}
            />
            <button
              onClick={handleFillAll}
              style={{
                border: '1px solid #6B7280',
                backgroundColor: 'transparent',
                color: '#FFFFFF',
                borderRadius: '8px',
                padding: '0 16px',
                fontSize: '12px',
                height: '40px',
                cursor: 'pointer',
                transition: 'all 0.3s'
              }}
              onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => e.currentTarget.style.backgroundColor = '#374151'}
              onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              全部
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', marginBottom: '12px' }}>
            <button
              onClick={handleWithdraw}
              style={{
                backgroundColor: '#3B82F6',
                color: '#FFFFFF',
                borderRadius: '8px',
                padding: '0',
                fontSize: '12px',
                height: '40px',
                width: '100%',
                border: 'none',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.3s'
              }}
              onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => e.currentTarget.style.backgroundColor = '#2563EB'}
              onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => e.currentTarget.style.backgroundColor = '#3B82F6'}
            >
              提现
            </button>
            <button
              onClick={() => navigate('/profile/withdrawal')}
              style={{
                backgroundColor: 'transparent',
                color: '#9CA3AF',
                border: 'none',
                fontSize: '12px',
                height: '40px',
                padding: '0',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.3s'
              }}
              onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => e.currentTarget.style.color = '#FFFFFF'}
              onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => e.currentTarget.style.color = '#9CA3AF'}
            >
              提现历史
            </button>
          </div>

          <div style={{ fontSize: '10px', color: '#6B7280', textAlign: 'left', marginTop: '12px' }}>
            需满 5 USDT 才可提现，提现将在3个工作日内处理。
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={handleCopyLink}
            style={{
              flex: 1,
              border: '1px solid #3B82F6',
              backgroundColor: 'transparent',
              color: '#3B82F6',
              borderRadius: '8px',
              padding: '0',
              fontSize: '12px',
              height: '40px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.3s'
            }}
            onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)'}
            onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Copy size={16} />
            <span>复制邀请链接</span>
          </button>
          <button
            onClick={handleGenerateQR}
            style={{
              flex: 1,
              border: '1px solid #3B82F6',
              backgroundColor: 'transparent',
              color: '#3B82F6',
              borderRadius: '8px',
              padding: '0',
              fontSize: '12px',
              height: '40px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.3s'
            }}
            onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)'}
            onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <QrCode size={16} />
            <span>生成分享二维码</span>
          </button>
        </div>
      </div>

      {isQRModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
          padding: '16px'
        }}>
          <div style={{ backgroundColor: '#27272A', borderRadius: '12px', padding: '16px', width: '100%', maxWidth: '320px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF' }}>邀请二维码</h2>
              <button
                onClick={handleCloseQRModal}
                style={{
                  padding: '4px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#9CA3AF',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.3s'
                }}
                onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
                  e.currentTarget.style.backgroundColor = '#374151'
                  e.currentTarget.style.color = '#FFFFFF'
                }}
                onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.color = '#9CA3AF'
                }}
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ backgroundColor: '#000000', borderRadius: '8px', padding: '24px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#4B5563', fontSize: '14px', marginBottom: '8px' }}>二维码占位</div>
                <p style={{ color: '#6B7280', fontSize: '12px' }}>扫码注册可获得代金券</p>
              </div>
            </div>
            <button
              onClick={handleCloseQRModal}
              style={{
                width: '100%',
                backgroundColor: '#3B82F6',
                color: '#FFFFFF',
                borderRadius: '8px',
                padding: '0',
                fontSize: '12px',
                height: '40px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.3s'
              }}
              onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => e.currentTarget.style.backgroundColor = '#2563EB'}
              onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => e.currentTarget.style.backgroundColor = '#3B82F6'}
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
