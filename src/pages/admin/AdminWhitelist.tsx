import { useState, useEffect } from 'react'

interface WhitelistEntry {
  address: string
  note: string
  addedAt: string
}

export default function AdminWhitelist() {
  const [entries, setEntries] = useState<WhitelistEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(false)
  const [newAddress, setNewAddress] = useState('')
  const [newNote, setNewNote] = useState('')
  const [msg, setMsg] = useState('')

  // 自动登录：从 sessionStorage 读取上次的密码
  useEffect(() => {
    const saved = sessionStorage.getItem('wisescan_admin_pw')
    if (saved) { setPassword(saved); login(saved) }
    else setLoading(false)
  }, [])

  const login = async (pw?: string) => {
    const p = pw || password
    if (!p.trim()) { setError('请输入密码'); return }
    setLoading(true); setError('')
    try {
      const r = await fetch(`/api/whitelist?action=list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: p }),
      })
      const j = await r.json()
      if (!j.success) { setError(j.error || '密码错误'); setLoading(false); return }
      setAuthed(true)
      setEntries(j.data || [])
      sessionStorage.setItem('wisescan_admin_pw', p)
    } catch (e: any) {
      setError('网络错误: ' + e.message)
    }
    setLoading(false)
  }

  const addEntry = async () => {
    const addr = newAddress.trim()
    if (!addr) { setMsg('请输入合约地址'); return }
    setMsg(''); setLoading(true)
    try {
      const r = await fetch(`/api/whitelist?action=add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, address: addr, note: newNote.trim() }),
      })
      const j = await r.json()
      if (!j.success) { setMsg(j.error || '添加失败'); setLoading(false); return }
      setNewAddress(''); setNewNote('')
      // 刷新列表
      const r2 = await fetch(`/api/whitelist?action=list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const j2 = await r2.json()
      if (j2.success) setEntries(j2.data || [])
      setMsg('✅ 添加成功')
    } catch (e: any) { setMsg('网络错误: ' + e.message) }
    setLoading(false)
  }

  const removeEntry = async (addr: string) => {
    if (!confirm(`确定移除 ${addr.slice(0, 10)}...？`)) return
    setLoading(true)
    try {
      const r = await fetch(`/api/whitelist?action=remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, address: addr }),
      })
      const j = await r.json()
      if (!j.success) { setMsg(j.error || '移除失败'); setLoading(false); return }
      setEntries(entries.filter(e => e.address !== addr))
      setMsg('✅ 已移除')
    } catch (e: any) { setMsg('网络错误: ' + e.message) }
    setLoading(false)
  }

  if (!authed) {
    return (
      <div className="max-w-md mx-auto mt-20 p-6 bg-zinc-800 rounded-lg border border-zinc-700">
        <h2 className="text-lg font-semibold text-white mb-4">白名单管理 - 登录</h2>
        <input
          type="password"
          placeholder="管理员密码"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full p-2 rounded bg-zinc-700 text-white border border-zinc-600 mb-3"
          onKeyDown={e => e.key === 'Enter' && login()}
        />
        {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
        <button onClick={() => login()} className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          登录
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto mt-8 p-4">
      <h2 className="text-lg font-semibold text-white mb-4">白名单管理</h2>

      {msg && <p className="text-sm text-zinc-300 mb-3 bg-zinc-700 p-2 rounded">{msg}</p>}

      {/* 添加表单 */}
      <div className="flex gap-2 mb-6">
        <input
          placeholder="钱包地址（0x / T / Solana格式）"
          value={newAddress}
          onChange={e => setNewAddress(e.target.value)}
          className="flex-1 p-2 rounded bg-zinc-700 text-white border border-zinc-600 text-sm"
        />
        <input
          placeholder="备注（如：主播小明）"
          value={newNote}
          onChange={e => setNewNote(e.target.value)}
          className="w-36 p-2 rounded bg-zinc-700 text-white border border-zinc-600 text-sm"
        />
        <button onClick={addEntry} disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm">
          添加
        </button>
      </div>

      {/* 列表 */}
      <div className="space-y-2">
        {entries.length === 0 && <p className="text-zinc-400 text-sm">暂无白名单地址</p>}
        {entries.map((e, i) => (
          <div key={i} className="flex items-center justify-between bg-zinc-800 p-3 rounded border border-zinc-700">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-zinc-200 font-mono truncate">{e.address}</p>
              {e.note && <p className="text-xs text-zinc-400 mt-0.5">{e.note}</p>}
            </div>
            <button onClick={() => removeEntry(e.address)}
              className="ml-3 px-3 py-1 bg-red-600/80 text-white text-xs rounded hover:bg-red-600 flex-shrink-0">
              移除
            </button>
          </div>
        ))}
      </div>
      <p className="text-xs text-zinc-500 mt-4">白名单用户支付时展示完整付费流程，实际不扣费。</p>
    </div>
  )
}
