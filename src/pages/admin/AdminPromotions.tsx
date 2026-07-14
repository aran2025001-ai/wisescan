import { useState, useEffect } from 'react'
import AdminLayout from './AdminLayout'

interface Cooperator {
  address: string
  name: string
  invite_code: string | null
  note: string
  active: boolean
  created_at: string
}

interface CooperatorStats {
  address: string
  name: string
  invite_code: string | null
  registered_count: number
  paid_count: number
  paid_amount: number
  pay_rate: string
}

export default function AdminPromotions() {
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<CooperatorStats[]>([])
  const [addAddr, setAddAddr] = useState('')
  const [addName, setAddName] = useState('')
  const [addNote, setAddNote] = useState('')
  const [msg, setMsg] = useState('')

  // 自动登录
  useEffect(() => {
    const saved = sessionStorage.getItem('wisescan_admin_pw')
    if (saved) { setPassword(saved); fetchStats(saved) }
    else setLoading(false)
  }, [])

  const fetchStats = async (pw?: string) => {
    const p = pw || password
    if (!p.trim()) return
    setLoading(true)
    try {
      const r = await fetch('/api/promotion?action=all-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: p }),
      })
      const j = await r.json()
      if (j.success) {
        setStats(j.data || [])
        setAuthed(true)
        sessionStorage.setItem('wisescan_admin_pw', p)
      } else {
        setMsg(j.error || '密码错误')
        sessionStorage.removeItem('wisescan_admin_pw')
        setAuthed(false)
      }
    } catch (e: any) {
      setMsg('网络错误: ' + e.message)
    }
    setLoading(false)
  }

  const addCooperator = async () => {
    const addr = addAddr.trim()
    if (!addr) { setMsg('请输入钱包地址'); return }
    setLoading(true); setMsg('')
    try {
      const r = await fetch('/api/promotion?action=add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, address: addr, name: addName.trim(), note: addNote.trim() }),
      })
      const j = await r.json()
      if (!j.success) { setMsg(j.error || '添加失败'); setLoading(false); return }
      setAddAddr(''); setAddName(''); setAddNote('')
      await fetchStats()
      setMsg('✅ 添加成功')
    } catch (e: any) { setMsg('网络错误: ' + e.message) }
    setLoading(false)
  }

  const removeCooperator = async (addr: string) => {
    if (!confirm(`确定移除 ${addr.slice(0, 10)}...？`)) return
    setLoading(true)
    try {
      const r = await fetch('/api/promotion?action=remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, address: addr }),
      })
      const j = await r.json()
      if (!j.success) { setMsg(j.error || '移除失败'); setLoading(false); return }
      await fetchStats()
      setMsg('✅ 已移除')
    } catch (e: any) { setMsg('网络错误: ' + e.message) }
    setLoading(false)
  }

  const refreshStats = () => fetchStats()

  if (!authed) {
    return (
      <div className="max-w-md mx-auto mt-20 p-6 bg-zinc-800 rounded-lg border border-zinc-700">
        <h2 className="text-lg font-semibold text-white mb-4">推广统计</h2>
        <input type="password" placeholder="管理员密码" value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full p-2 rounded bg-zinc-700 text-white border border-zinc-600 mb-3"
          onKeyDown={e => e.key === 'Enter' && fetchStats()} />
        {msg && <p className="text-red-400 text-sm mb-2">{msg}</p>}
        <button onClick={() => fetchStats()} disabled={loading}
          className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
          登录
        </button>
        <a href="/admin/dashboard" className="block text-center text-sm text-zinc-400 hover:text-zinc-200 mt-3">← 回到仪表盘</a>
      </div>
    )
  }

  const totalRegistered = stats.reduce((s, c) => s + c.registered_count, 0)
  const totalPaid = stats.reduce((s, c) => s + c.paid_count, 0)
  const totalAmount = stats.reduce((s, c) => s + c.paid_amount, 0)

  return (
    <AdminLayout>
      <div className="max-w-5xl">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold text-white">推广统计</h1>
          <button onClick={refreshStats} disabled={loading}
            className="px-3 py-1.5 bg-zinc-700 text-zinc-300 rounded text-sm hover:bg-zinc-600 disabled:opacity-50">
            {loading ? '统计中...' : '🔄 刷新'}
          </button>
        </div>

        {/* 汇总卡片 */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-zinc-800 rounded-lg p-3 border border-zinc-700">
            <p className="text-xs text-zinc-400">总邀请人数</p>
            <p className="text-xl font-bold text-white mt-1">{totalRegistered}</p>
          </div>
          <div className="bg-zinc-800 rounded-lg p-3 border border-zinc-700">
            <p className="text-xs text-zinc-400">总付费人数</p>
            <p className="text-xl font-bold text-green-400 mt-1">{totalPaid}</p>
          </div>
          <div className="bg-zinc-800 rounded-lg p-3 border border-zinc-700">
            <p className="text-xs text-zinc-400">总付费金额</p>
            <p className="text-xl font-bold text-yellow-400 mt-1">{totalAmount.toFixed(2)} USDT</p>
          </div>
        </div>

        {/* 添加表单 */}
        <div className="flex gap-2 mb-4">
          <input placeholder="钱包地址" value={addAddr} onChange={e => setAddAddr(e.target.value)}
            className="flex-1 p-2 rounded bg-zinc-700 text-white border border-zinc-600 text-sm" />
          <input placeholder="名称（如：抖音-小明）" value={addName} onChange={e => setAddName(e.target.value)}
            className="w-40 p-2 rounded bg-zinc-700 text-white border border-zinc-600 text-sm" />
          <input placeholder="备注" value={addNote} onChange={e => setAddNote(e.target.value)}
            className="w-32 p-2 rounded bg-zinc-700 text-white border border-zinc-600 text-sm" />
          <button onClick={addCooperator} disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm">
            添加
          </button>
        </div>

        {msg && <p className="text-sm text-zinc-300 mb-3 bg-zinc-700 p-2 rounded">{msg}</p>}

        {/* 汇总表格 */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-zinc-400 text-xs border-b border-zinc-700">
                <th className="text-left py-2 pr-3">名称</th>
                <th className="text-left py-2 pr-3">推广码</th>
                <th className="text-right py-2 pr-3">邀请</th>
                <th className="text-right py-2 pr-3">付费</th>
                <th className="text-right py-2 pr-3">金额(USDT)</th>
                <th className="text-right py-2 pr-3">付费率</th>
                <th className="text-right py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s, i) => (
                <tr key={i} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                  <td className="py-2.5 pr-3">
                    <div className="text-white">{s.name || '-'}</div>
                    <div className="text-[10px] text-zinc-500 font-mono">{s.address.slice(0, 10)}...</div>
                  </td>
                  <td className="py-2.5 pr-3 text-zinc-300 font-mono">{s.invite_code || '-'}</td>
                  <td className="py-2.5 pr-3 text-right text-white">{s.registered_count}</td>
                  <td className="py-2.5 pr-3 text-right text-green-400">{s.paid_count}</td>
                  <td className="py-2.5 pr-3 text-right text-yellow-400">{s.paid_amount.toFixed(2)}</td>
                  <td className="py-2.5 pr-3 text-right text-zinc-300">{s.pay_rate}</td>
                  <td className="py-2.5 text-right">
                    <button onClick={() => removeCooperator(s.address)}
                      className="text-red-400 text-xs hover:text-red-300">
                      移除
                    </button>
                  </td>
                </tr>
              ))}
              {stats.length === 0 && (
                <tr><td colSpan={7} className="py-6 text-center text-zinc-500 text-sm">暂无合作方</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  )
}
