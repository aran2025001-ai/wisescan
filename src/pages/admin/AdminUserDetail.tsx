import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AdminLayout from './AdminLayout'
import { ArrowLeft } from 'lucide-react'

export default function AdminUserDetail() {
  const navigate = useNavigate()
  const { address } = useParams()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (!token) { navigate('/admin/login'); return }
    if (!address) return

    fetch(`/api/admin/user-detail?address=${encodeURIComponent(address)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { if (d.success) setData(d.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [address, navigate])

  if (loading) return <AdminLayout><p className="text-gray-400 text-sm">加载中...</p></AdminLayout>
  if (!data) return <AdminLayout><p className="text-red-400 text-sm">未找到用户数据</p></AdminLayout>

  return (
    <AdminLayout>
      <button onClick={() => navigate('/admin/users')}
        className="flex items-center gap-1 text-gray-400 hover:text-white text-xs mb-4">
        <ArrowLeft className="w-3.5 h-3.5" /> 返回用户列表
      </button>

      <h1 className="text-white text-lg font-bold mb-1">用户详情</h1>
      <p className="text-gray-400 text-xs font-mono mb-4 break-all">{address}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 评估记录 */}
        <Section title={`评估记录 (${data.riskReports?.length || 0})`}>
          {data.riskReports?.length > 0 ? data.riskReports.slice(0, 5).map((r: any) => (
            <div key={r.id} className="border-b border-gray-800/50 py-1.5 text-xs">
              <span className="text-gray-400">{r.created_at?.slice(0, 10)}</span>
              <span className={`ml-2 ${r.risk_level === '低风险' ? 'text-green-400' : r.risk_level === '中等风险' ? 'text-yellow-400' : 'text-red-400'}`}>
                {r.risk_level || '--'}
              </span>
              <span className="ml-2 text-gray-500">评分: {r.total_score ?? '--'}</span>
            </div>
          )) : <p className="text-gray-500 text-xs">暂无评估记录</p>}
        </Section>

        {/* 商业模式报告 */}
        <Section title={`商业模式报告 (${data.bizReports?.length || 0})`}>
          {data.bizReports?.slice(0, 5).map((r: any) => (
            <div key={r.id} className="border-b border-gray-800/50 py-1.5 text-xs">
              <span className="text-gray-400">{r.created_at?.slice(0, 10)}</span>
              <span className="ml-2 text-gray-300">{r.project_name || '--'}</span>
            </div>
          )) || <p className="text-gray-500 text-xs">暂无报告</p>}
        </Section>

        {/* 邀请关系 */}
        <Section title={`邀请关系 (${data.invitations?.length || 0})`}>
          {data.invitations?.map((r: any) => (
            <div key={r.id} className="border-b border-gray-800/50 py-1.5 text-xs">
              <span className="text-gray-400">{r.created_at?.slice(0, 10)}</span>
              <span className="ml-2 text-gray-300">
                {r.inviter?.toLowerCase() === address?.toLowerCase() ? `邀请 ${r.invitee?.slice(0,6)}...` : `被 ${r.inviter?.slice(0,6)}... 邀请`}
              </span>
              <span className={`ml-2 ${r.status === 'paid' ? 'text-green-400' : 'text-yellow-400'}`}>{r.status}</span>
            </div>
          )) || <p className="text-gray-500 text-xs">暂无邀请记录</p>}
        </Section>

        {/* 代金券 */}
        <Section title={`代金券 (${data.coupons?.length || 0})`}>
          {data.coupons?.map((r: any) => (
            <div key={r.id} className="border-b border-gray-800/50 py-1.5 text-xs">
              <span className="text-gray-400">{r.created_at?.slice(0, 10)}</span>
              <span className="ml-2">{r.amount} USDT</span>
              <span className={`ml-2 ${r.status === 'active' ? 'text-green-400' : r.status === 'used' ? 'text-gray-500' : 'text-red-400'}`}>
                {r.status === 'active' ? '有效' : r.status === 'used' ? '已使用' : '已过期'}
              </span>
            </div>
          )) || <p className="text-gray-500 text-xs">暂无代金券</p>}
        </Section>

        {/* 提现记录 */}
        <Section title={`提现记录 (${data.withdrawals?.length || 0})`}>
          {data.withdrawals?.map((r: any) => (
            <div key={r.id} className="border-b border-gray-800/50 py-1.5 text-xs">
              <span className="text-gray-400">{r.created_at?.slice(0, 10)}</span>
              <span className="ml-2">{r.amount} USDT</span>
              <span className={`ml-2 ${r.status === 'completed' ? 'text-green-400' : r.status === 'rejected' ? 'text-red-400' : 'text-yellow-400'}`}>
                {r.status === 'completed' ? '已完成' : r.status === 'rejected' ? '已拒绝' : '待处理'}
              </span>
            </div>
          )) || <p className="text-gray-500 text-xs">暂无提现记录</p>}
        </Section>
      </div>
    </AdminLayout>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <h2 className="text-white text-xs font-semibold mb-3">{title}</h2>
      {children}
    </div>
  )
}
