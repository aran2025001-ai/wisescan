import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from './AdminLayout'

export default function AdminUsers() {
  const navigate = useNavigate()
  const [list, setList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [totalUsers, setTotalUsers] = useState<number | null>(null)

  const fetchList = async (q: string) => {
    const token = localStorage.getItem('admin_token')
    if (!token) { navigate('/admin/login'); return }
    setLoading(true)
    try {
      const url = q ? `/api/admin/users?search=${encodeURIComponent(q)}` : '/api/admin/users'
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (data.success) setList(data.data)
    } catch {} finally { setLoading(false) }
  }

  // 额外获取用户总量
  const fetchTotalUsers = async () => {
    const token = localStorage.getItem('admin_token')
    if (!token) return
    try {
      const res = await fetch('/api/admin/dashboard', { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (data.success) setTotalUsers(data.cards.totalUsers)
    } catch {}
  }

  useEffect(() => { fetchList(search); fetchTotalUsers() }, [navigate])

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); fetchList(search) }

  const maskAddr = (addr: string) => addr ? addr.slice(0, 6) + '...' + addr.slice(-4) : '--'

  return (
    <AdminLayout>
      <h1 className="text-white text-lg font-bold mb-4">用户管理</h1>

      {totalUsers !== null && (
        <div className="mb-3 flex items-center gap-2">
          <span className="text-xs text-gray-400">共</span>
          <span className="text-lg font-bold text-purple-400">{totalUsers}</span>
          <span className="text-xs text-gray-400">位用户</span>
        </div>
      )}

      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="按钱包地址搜索..."
          className="flex-1 px-3 py-1.5 bg-gray-800 text-white text-xs rounded border border-gray-700 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
        <button type="submit" className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-xs">搜索</button>
      </form>

      {loading ? <p className="text-gray-400 text-sm">加载中...</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-gray-300">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500">
                <th className="text-left py-2 pr-2">钱包地址</th>
                <th className="text-left py-2 pr-2">首次出现</th>
                <th className="text-right py-2 pr-2">评估次数</th>
                <th className="text-right py-2 pr-2">邀请人数</th>
                <th className="text-right py-2 pr-2">代金券</th>
                <th className="text-right py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {list.map((user, i) => (
                <tr key={user.address || i} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                  <td className="py-2 pr-2 font-mono">{maskAddr(user.address)}</td>
                  <td className="py-2 pr-2 text-gray-400">{user.firstSeen?.slice(0, 10) || '--'}</td>
                  <td className="py-2 pr-2 text-right">{user.assessCount || 0}</td>
                  <td className="py-2 pr-2 text-right">{user.inviteCount || 0}</td>
                  <td className="py-2 pr-2 text-right">{user.couponCount || 0}</td>
                  <td className="py-2 text-right">
                    <button onClick={() => navigate(`/admin/users/${encodeURIComponent(user.address)}`)}
                      className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-[12px]">详情</button>
                  </td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-gray-500">暂无用户数据</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  )
}
