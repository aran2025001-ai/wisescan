import { useNavigate } from 'react-router-dom'
import { ChevronLeft, CheckCircle, Clock } from 'lucide-react'

export default function WithdrawalHistory() {
  const navigate = useNavigate()

  const withdrawalRecords = [
    { id: 1, amount: 10.00, date: '2026-06-05', status: '已完成', statusColor: '#10B981', statusType: 'completed' },
    { id: 2, amount: 5.50, date: '2026-05-28', status: '已完成', statusColor: '#10B981', statusType: 'completed' },
    { id: 3, amount: 3.00, date: '2026-05-15', status: '处理中', statusColor: '#F59E0B', statusType: 'pending' },
  ]

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="flex items-center justify-center py-4 px-4 border-b border-gray-700">
        <button
          onClick={() => navigate('/profile/invitation')}
          className="absolute left-4 flex items-center justify-center w-8 h-8 text-gray-400 hover:text-white transition-colors"
          aria-label="返回"
        >
          <ChevronLeft size={16} />
        </button>
        <h1 style={{ fontSize: '16px', fontWeight: 600 }} className="text-white">提现历史</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        {withdrawalRecords.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {withdrawalRecords.map((record) => (
              <div
                key={record.id}
                style={{
                  backgroundColor: '#27272A',
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF', marginBottom: '4px' }}>
                    {record.amount.toFixed(2)} USDT
                  </div>
                  <div style={{ fontSize: '12px', color: '#9CA3AF' }}>
                    {record.date}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: record.statusColor,
                    textAlign: 'right'
                  }}>
                    {record.status}
                  </div>
                  {record.statusType === 'completed' && (
                    <CheckCircle size={16} color={record.statusColor} />
                  )}
                  {record.statusType === 'pending' && (
                    <Clock size={16} color={record.statusColor} />
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', gap: '12px' }}>
            <div style={{ fontSize: '14px', color: '#6B7280' }}>暂无提现记录</div>
          </div>
        )}
      </div>
    </div>
  )
}
