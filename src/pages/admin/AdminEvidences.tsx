import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from './AdminLayout'

export default function AdminEvidences() {
  const navigate = useNavigate()
  const [list, setList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')
  const [detail, setDetail] = useState<any>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const fetchList = async (status: string) => {
    const token = localStorage.getItem('admin_token')
    if (!token) { navigate('/admin/login'); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/evidences?status=${status}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) setList(data.data)
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { fetchList(filter) }, [filter, navigate])

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    const token = localStorage.getItem('admin_token')
    if (!token) return
    const endpoint = action === 'approve' ? '/api/admin/evidences/approve' : '/api/admin/evidences/reject'
    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id }),
      })
    } catch {}
    setDetail(null)
    fetchList(filter)
  }

  const maskAddr = (addr: string) => addr ? addr.slice(0, 6) + '...' + addr.slice(-4) : '--'
  const typeLabel: Record<string, string> = { screenshot: '截图', text: '文本', link: '链接' }

  return (
    <AdminLayout>
      <h1 className="text-white text-lg font-bold mb-4">证据审核</h1>

      <div className="flex gap-2 mb-4">
        {['pending', 'verified', 'rejected'].map(s => (
          <button key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1 rounded-lg text-xs transition-colors ${
              filter === s ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {s === 'pending' ? '待审核' : s === 'verified' ? '已采纳' : '已拒绝'}
          </button>
        ))}
      </div>

      {loading ? <p className="text-gray-400 text-sm">加载中...</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-gray-300">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500">
                <th className="text-left py-2 pr-2">时间</th>
                <th className="text-left py-2 pr-2">项目名称</th>
                <th className="text-left py-2 pr-2">提交者</th>
                <th className="text-left py-2 pr-2">类型</th>
                <th className="text-left py-2 pr-2">状态</th>
                <th className="text-right py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {list.map(item => (
                <tr key={item.id} className="border-b border-gray-800/50 hover:bg-gray-900/50 cursor-pointer"
                  onClick={() => setDetail(item)}>
                  <td className="py-2 pr-2 whitespace-nowrap text-[13px]">
                    {item.created_at ? new Date(item.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '--'}
                  </td>
                  <td className="py-2 pr-2">{item.project_name || '--'}</td>
                  <td className="py-2 pr-2 font-mono">{maskAddr(item.contributor_address)}</td>
                  <td className="py-2 pr-2">{typeLabel[item.content_type] || item.content_type}</td>
                  <td className="py-2 pr-2">
                    <span className={`px-1.5 py-0.5 rounded text-[12px] ${
                      item.status === 'verified' ? 'bg-green-900 text-green-300' :
                      item.status === 'rejected' ? 'bg-red-900 text-red-300' : 'bg-amber-900 text-amber-300'
                    }`}>
                      {item.status === 'pending' ? '待审核' : item.status === 'verified' ? '已采纳' : '已拒绝'}
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    {item.status === 'pending' && (
                      <div className="flex gap-1 justify-end">
                        <button onClick={e => { e.stopPropagation(); handleAction(item.id, 'approve') }}
                          className="px-2 py-1 bg-green-700 hover:bg-green-600 text-white rounded text-[12px]">采纳</button>
                        <button onClick={e => { e.stopPropagation(); handleAction(item.id, 'reject') }}
                          className="px-2 py-1 bg-red-700 hover:bg-red-600 text-white rounded text-[12px]">拒绝</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-gray-500">暂无数据</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* 详情弹窗 */}
      {detail && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999]" onClick={() => setDetail(null)}>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 w-96 max-h-[80vh] overflow-y-auto mx-4 space-y-3"
            onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start">
              <h3 className="text-white text-sm font-semibold">证据详情</h3>
              <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-white text-sm">✕</button>
            </div>
            <div className="space-y-2 text-xs text-gray-300">
              <div><span className="text-gray-500">项目：</span>{detail.project_name || '--'}</div>
              <div><span className="text-gray-500">提交者：</span><span className="font-mono">{detail.contributor_address}</span></div>
              <div><span className="text-gray-500">类型：</span>{typeLabel[detail.content_type] || detail.content_type}</div>
              <div><span className="text-gray-500">类别：</span>{detail.evidence_category || '--'}</div>
              <div><span className="text-gray-500">提交时间：</span>{detail.created_at ? new Date(detail.created_at).toLocaleString('zh-CN') : '--'}</div>
              <div><span className="text-gray-500">验证次数：</span>{detail.verification_count || 0}</div>
              {detail.image_url && (
                <div className="mt-1">
                  <img
                    src={detail.image_url}
                    alt="evidence"
                    className="max-h-48 rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={(e) => { e.stopPropagation(); setImagePreview(detail.image_url) }}
                  />
                  <p className="text-gray-500 text-[12px] mt-0.5">点击图片查看大图</p>
                </div>
              )}
              <div className="mt-2">
                <span className="text-gray-500">内容：</span>
                <p className="mt-1 bg-gray-800 rounded p-2 whitespace-pre-wrap break-all">{detail.content}</p>
              </div>
            </div>
            {detail.status === 'pending' && (
              <div className="flex gap-3 pt-2">
                <button onClick={() => handleAction(detail.id, 'approve')}
                  className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs">采纳</button>
                <button onClick={() => handleAction(detail.id, 'reject')}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs">拒绝</button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* 全屏图片预览 */}
      {imagePreview && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[99999] cursor-zoom-out"
          onClick={() => setImagePreview(null)}
        >
          <img
            src={imagePreview}
            alt="full size"
            className="max-w-[95vw] max-h-[95vh] object-contain"
          />
        </div>
      )}
    </AdminLayout>
  )
}
