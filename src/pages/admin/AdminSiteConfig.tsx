import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from './AdminLayout'

export default function AdminSiteConfig() {
  const navigate = useNavigate()
  const [displayCount, setDisplayCount] = useState('500')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetch('/api/site-config?key=display_user_count')
      .then(r => r.json())
      .then(data => {
        if (data.success && data.data?.display_user_count) {
          setDisplayCount(data.data.display_user_count)
        }
      })
      .catch(() => {})
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setMsg('')
    try {
      const pw = prompt('请输入管理员密码：')
      if (!pw) { setSaving(false); return }
      const res = await fetch('/api/site-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'display_user_count', value: displayCount, password: pw }),
      })
      const data = await res.json()
      if (data.success) {
        setMsg('✅ 保存成功，刷新前端页面后生效')
      } else {
        setMsg('❌ 保存失败: ' + (data.error || '未知错误'))
      }
    } catch {
      setMsg('❌ 网络错误')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminLayout>
      <h1 className="text-white text-lg font-bold mb-4">站点配置</h1>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 max-w-md">
        <h2 className="text-white text-sm font-semibold mb-3">前端展示数字</h2>
        <p className="text-gray-400 text-xs mb-3 leading-relaxed">
          修改此数字将影响首页、我的页面、欢迎页底部显示的<br />
          <span className="text-zinc-300">"已有 <span className="text-purple-400 font-semibold">XXX</span> 位用户使用明鉴进行项目评估"</span>
        </p>

        <div className="flex items-center gap-2 mb-4">
          <span className="text-gray-400 text-xs">显示：</span>
          <input
            type="number"
            min={0}
            value={displayCount}
            onChange={e => setDisplayCount(e.target.value)}
            className="w-24 px-3 py-1.5 bg-gray-800 text-white text-sm rounded border border-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <span className="text-gray-400 text-xs">位用户</span>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg text-xs transition-colors"
        >
          {saving ? '保存中...' : '保存'}
        </button>

        {msg && <p className="mt-3 text-xs">{msg}</p>}
      </div>
    </AdminLayout>
  )
}
