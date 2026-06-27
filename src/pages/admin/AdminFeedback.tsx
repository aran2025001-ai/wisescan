import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from './AdminLayout'

export default function AdminFeedback() {
  const navigate = useNavigate()
  const [list, setList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')
  const [detail, setDetail] = useState<any>(null)

  const fetchList = async (status: string) => {
    const token = localStorage.getItem('admin_token')
    if (!token) { navigate('/admin/login'); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/feedback?status=${status}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) setList(data.data)
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { fetchList(filter) }, [filter, navigate])

  const handleResolve = async (id: string) => {
    const token = localStorage.getItem('admin_token')
    if (!token) return
    await fetch('/api/admin/feedback/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id }),
    })
    setDetail(null)
    fetchList(filter)
  }

  const maskAddr = (addr: string) => addr ? addr.slice(0, 6) + '...' + addr.slice(-4) : '--'

  return (
    <AdminLayout>
      <h1 className="text-white text-lg font-bold mb-4">反馈管理</h1>

      <div className="flex gap-2 mb-4">
        {['pending', 'resolved'].map(s => (
          <button key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1 rounded-lg text-xs transition-colors ${
              filter === s ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {s === 'pending' ? '待处理' : '已处理'}
          </button>
        ))}
      </div>

      {loading ? <p className="text-gray-400 text-sm">加载中...</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-gray-300">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500">
                <th className="text-left py-2 pr-2">时间</th>
                <th className="text-left py-2 pr-2">提交者</th>
                <th className="text-left py-2 pr-2">内容摘要</th>
                <th className="text-left py-2 pr-2">状态</th>
                <th className="text-right py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {list.map(item => (
                <tr key={item.id} className="border-b border-gray-800/50 hover:bg-gray-900/50 cursor-pointer"
                  onClick={() => setDetail(item)}>
                  <td className="py-2 pr-2 whitespace-nowrap">{item.created_at?.slice(0, 16).replace('T', ' ')}</td>
                  <td className="py-2 pr-2 font-mono">{maskAddr(item.user_address)}</td>
                  <td className="py-2 pr-2 text-gray-400 max-w-[200px] truncate">{item.content?.slice(0, 50)}</td>
                  <td className="py-2 pr-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                      item.status === 'resolved' ? 'bg-green-900 text-green-300' : 'bg-amber-900 text-amber-300'
                    }`}>
                      {item.status === 'resolved' ? '已处理' : '待处理'}
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    {item.status === 'pending' && (
                      <button onClick={e => { e.stopPropagation(); handleResolve(item.id) }}
                        className="px-2 py-1 bg-green-700 hover:bg-green-600 text-white rounded text-[10px]">标记已处理</button>
                    )}
                  </td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-gray-500">暂无反馈</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* 详情弹窗 */}
      {detail && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999]" onClick={() => setDetail(null)}>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 w-96 mx-4 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start">
              <h3 className="text-white text-sm font-semibold">反馈详情</h3>
              <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-white text-sm">✕</button>
            </div>
            <div className="space-y-2 text-xs text-gray-300">
              <div><span className="text-gray-500">提交者：</span><span className="font-mono">{detail.user_address}</span></div>
              <div><span className="text-gray-500">时间：</span>{detail.created_at}</div>
              <div><span className="text-gray-500">分类：</span>{detail.category || 'general'}</div>
              <div className="mt-2">
                <span className="text-gray-500">内容：</span>
                <p className="mt-1 bg-gray-800 rounded p-3 whitespace-pre-wrap break-all text-sm leading-relaxed">{detail.content}</p>
              </div>
            </div>
            {detail.status === 'pending' && (
              <button onClick={() => handleResolve(detail.id)}
                className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs">标记已处理</button>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
