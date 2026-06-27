import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from './AdminLayout'

export default function AdminWithdrawals() {
  const navigate = useNavigate()
  const [list, setList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')
  const [modal, setModal] = useState<{ action: 'complete' | 'reject'; id: string | null }>({ action: 'complete', id: null })
  const [txHash, setTxHash] = useState('')
  const [reason, setReason] = useState('')

  const fetchList = async (status: string) => {
    const token = localStorage.getItem('admin_token')
    if (!token) { navigate('/admin/login'); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/withdrawals?status=${status}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) setList(data.data)
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { fetchList(filter) }, [filter, navigate])

  const handleAction = async () => {
    const token = localStorage.getItem('admin_token')
    if (!token || !modal.id) return
    const endpoint = modal.action === 'complete' ? '/api/admin/withdrawals/complete' : '/api/admin/withdrawals/reject'
    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: modal.id, tx_hash: txHash, reason }),
      })
    } catch {}
    setModal({ action: 'complete', id: null })
    setTxHash(''); setReason('')
    fetchList(filter)
  }

  const maskAddr = (addr: string) => addr ? addr.slice(0, 6) + '...' + addr.slice(-4) : '--'

  return (
    <AdminLayout>
      <h1 className="text-white text-lg font-bold mb-4">提现审核</h1>

      {/* 状态筛选 */}
      <div className="flex gap-2 mb-4">
        {['pending', 'completed', 'rejected'].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1 rounded-lg text-xs transition-colors ${
              filter === s ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {s === 'pending' ? '待处理' : s === 'completed' ? '已完成' : '已拒绝'}
          </button>
        ))}
      </div>

      {loading ? <p className="text-gray-400 text-sm">加载中...</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-gray-300">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500">
                <th className="text-left py-2 pr-2">时间</th>
                <th className="text-left py-2 pr-2">用户</th>
                <th className="text-right py-2 pr-2">金额</th>
                <th className="text-left py-2 pr-2">收款地址</th>
                <th className="text-left py-2 pr-2">状态</th>
                <th className="text-right py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {list.map(item => (
                <tr key={item.id} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                  <td className="py-2 pr-2 whitespace-nowrap">{item.created_at?.slice(0, 16).replace('T', ' ')}</td>
                  <td className="py-2 pr-2 font-mono">{maskAddr(item.user_address)}</td>
                  <td className="py-2 pr-2 text-right font-medium">{item.amount}</td>
                  <td className="py-2 pr-2 font-mono">{maskAddr(item.address)}</td>
                  <td className="py-2 pr-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                      item.status === 'completed' ? 'bg-green-900 text-green-300' :
                      item.status === 'rejected' ? 'bg-red-900 text-red-300' : 'bg-amber-900 text-amber-300'
                    }`}>
                      {item.status === 'pending' ? '待处理' : item.status === 'completed' ? '已完成' : '已拒绝'}
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    {item.status === 'pending' && (
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => setModal({ action: 'complete', id: item.id })}
                          className="px-2 py-1 bg-green-700 hover:bg-green-600 text-white rounded text-[10px]">标记已打款</button>
                        <button onClick={() => setModal({ action: 'reject', id: item.id })}
                          className="px-2 py-1 bg-red-700 hover:bg-red-600 text-white rounded text-[10px]">拒绝</button>
                      </div>
                    )}
                    {item.status === 'completed' && item.tx_hash && (
                      <span className="text-gray-500 text-[10px]">Tx: {item.tx_hash.slice(0, 10)}...</span>
                    )}
                  </td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-gray-500">暂无数据</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* 操作弹窗 */}
      {modal.id && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999]">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 w-80 space-y-3">
            <h3 className="text-white text-sm font-semibold">
              {modal.action === 'complete' ? '标记已打款' : '拒绝提现'}
            </h3>
            {modal.action === 'complete' ? (
              <input value={txHash} onChange={e => setTxHash(e.target.value)}
                placeholder="Tx Hash（可选）"
                className="w-full px-3 py-2 bg-gray-800 text-white text-xs rounded border border-gray-700 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            ) : (
              <textarea value={reason} onChange={e => setReason(e.target.value)}
                placeholder="拒绝原因（可选）" rows={3}
                className="w-full px-3 py-2 bg-gray-800 text-white text-xs rounded border border-gray-700 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none" />
            )}
            <div className="flex gap-3 pt-1">
              <button onClick={() => setModal({ action: 'complete', id: null })}
                className="flex-1 py-1.5 bg-gray-800 text-white rounded-lg hover:bg-gray-700 text-xs">取消</button>
              <button onClick={handleAction}
                className={`flex-1 py-1.5 text-white rounded-lg text-xs ${
                  modal.action === 'complete' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                }`}>确认</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
