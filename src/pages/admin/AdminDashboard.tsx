import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from './AdminLayout'

interface CardItem {
  label: string
  value: number | string
  link?: string
  color: string
}

// 简单的 SVG 柱状图组件
function BarChart({ data, dataKey, color }: { data: any[]; dataKey: string; color: string }) {
  const max = Math.max(...data.map(d => d[dataKey] || 0), 1)
  return (
    <div className="flex items-end gap-1.5 h-32">
      {data.map((d, i) => {
        const h = ((d[dataKey] || 0) / max) * 100
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-[10px] text-gray-500">{d[dataKey]}</span>
            <div
              className="w-full rounded-t"
              style={{ height: `${Math.max(h, 2)}%`, backgroundColor: color, minHeight: 2 }}
            />
            <span className="text-[9px] text-gray-500 rotate-45 origin-left whitespace-nowrap">
              {d.date?.slice(5)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<{
    cards: CardItem[]
    trends: any[]
    loading: boolean
  }>({ cards: [], trends: [], loading: true })
  const [error, setError] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (!token) { navigate('/admin/login'); return }

    fetch('/api/admin/dashboard', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => {
        if (r.status === 401) {
          localStorage.removeItem('admin_token')
          navigate('/admin/login')
          return
        }
        return r.json()
      })
      .then(data => {
        if (!data || !data.success) { setError(data?.error || '加载失败'); return }
        const cards: CardItem[] = [
          { label: '今日报告数', value: data.cards.todayReports, link: '/admin/withdrawals', color: 'blue' },
          { label: '今日活跃用户', value: data.cards.todayUsers, color: 'green' },
          { label: '用户总量', value: data.cards.totalUsers, color: 'purple' },
          { label: '待处理提现', value: data.cards.pendingWithdrawals, link: '/admin/withdrawals', color: 'amber' },
          { label: '待审核证据', value: data.cards.pendingEvidences, link: '/admin/evidences', color: 'red' },
        ]
        setStats({ cards, trends: data.trends || [], loading: false })
      })
      .catch(() => setError('连接服务器失败'))
  }, [navigate])

  const colorMap: Record<string, string> = { blue: '#3b82f6', green: '#22c55e', amber: '#f59e0b', red: '#ef4444', purple: '#a855f7' }

  return (
    <AdminLayout>
      <h1 className="text-white text-lg font-bold mb-4">仪表盘</h1>

      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

      {stats.loading ? (
        <p className="text-gray-400 text-sm">加载中...</p>
      ) : (
        <>
          {/* 4 个数字卡片 */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            {stats.cards.map((card, i) => (
              <div
                key={i}
                onClick={() => card.link && navigate(card.link)}
                className={`bg-gray-900 border border-gray-800 rounded-xl p-4 ${card.link ? 'cursor-pointer hover:border-gray-600' : ''} transition-colors`}
              >
                <p className="text-gray-400 text-xs mb-1">{card.label}</p>
                <p className="text-2xl font-bold" style={{ color: colorMap[card.color] || '#fff' }}>
                  {card.value}
                </p>
              </div>
            ))}
          </div>

          {/* 趋势图 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h2 className="text-white text-sm font-semibold mb-3">近 7 天项目安全评估趋势</h2>
              {stats.trends.length > 0 ? (
                <BarChart data={stats.trends} dataKey="riskReports" color="#3b82f6" />
              ) : (
                <p className="text-gray-500 text-xs">暂无数据</p>
              )}
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h2 className="text-white text-sm font-semibold mb-3">近 7 天商业模式拆解趋势</h2>
              {stats.trends.length > 0 ? (
                <BarChart data={stats.trends} dataKey="bizReports" color="#22c55e" />
              ) : (
                <p className="text-gray-500 text-xs">暂无数据</p>
              )}
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  )
}
