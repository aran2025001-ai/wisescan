import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function AdminLogin() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  // 检查旧 token 是否有效，无效则清除
  useEffect(() => {
    const oldToken = localStorage.getItem('admin_token')
    if (!oldToken) return
    // 快速验证 token 是否可用（用轻量请求）
    fetch('/api/admin/dashboard', {
      headers: { Authorization: `Bearer ${oldToken}` },
    }).then(r => {
      if (r.ok) navigate('/admin/dashboard', { replace: true })
      else localStorage.removeItem('admin_token')
    }).catch(() => localStorage.removeItem('admin_token'))
  }, [navigate])

  const handleLogin = async () => {
    if (!password.trim()) { setError('请输入密码'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!data.success) {
        setError(data.error || '登录失败')
      } else {
        localStorage.setItem('admin_token', data.token)
        navigate('/admin/dashboard')
      }
    } catch {
      setError('连接服务器失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-950 flex items-center justify-center z-[9999]">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 w-80 space-y-5">
        <div className="text-center">
          <h1 className="text-white text-lg font-bold">明鉴管理后台</h1>
          <p className="text-gray-400 text-xs mt-1">WiseScan Admin</p>
        </div>
        <div className="space-y-3">
          <input
            type="password"
            value={password}
            onChange={e => setError('') || setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="请输入管理员密码"
            className="w-full px-3 py-2 bg-gray-800 text-white text-sm rounded border border-gray-700 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            autoFocus
          />
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </div>
      </div>
    </div>
  )
}
