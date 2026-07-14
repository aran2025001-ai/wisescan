import { useEffect, useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { LayoutDashboard, Wallet, FileSearch, FolderKanban, Users, MessageSquareText, Settings, ShieldCheck, LogOut } from 'lucide-react'

const navItems = [
  { path: '/admin/dashboard', label: '仪表盘', icon: LayoutDashboard },
  { path: '/admin/withdrawals', label: '提现审核', icon: Wallet },
  { path: '/admin/evidences', label: '证据审核', icon: FileSearch },
  { path: '/admin/projects', label: '项目库管理', icon: FolderKanban },
  { path: '/admin/users', label: '用户管理', icon: Users },
  { path: '/admin/feedback', label: '反馈管理', icon: MessageSquareText },
  { path: '/admin/site-config', label: '站点配置', icon: Settings },
  { path: '/admin/whitelist', label: '白名单', icon: ShieldCheck },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (!token) {
      navigate('/admin/login')
    }
  }, [navigate])

  const handleLogout = () => {
    localStorage.removeItem('admin_token')
    navigate('/admin/login')
  }

  return (
    <div className="fixed inset-0 bg-gray-950 flex z-[9999]">
      {/* Sidebar */}
      <div className={`${collapsed ? 'w-14' : 'w-48'} bg-gray-900 border-r border-gray-800 flex flex-col transition-all duration-200 flex-shrink-0`}>
        <div className="p-3 border-b border-gray-800 flex items-center gap-2">
          {!collapsed && <span className="text-white text-sm font-bold truncate">明鉴后台</span>}
          <button onClick={() => setCollapsed(!collapsed)} className="text-gray-400 hover:text-white ml-auto text-xs p-1">
            {collapsed ? '→' : '←'}
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-2 space-y-0.5 px-1">
          {navItems.map(item => {
            const active = location.pathname.startsWith(item.path)
            const Icon = item.icon
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                  active ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            )
          })}
        </nav>
        <div className="p-2 border-t border-gray-800">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-2 py-1.5 text-xs text-gray-400 hover:text-red-400 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            {!collapsed && <span>退出登录</span>}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto bg-gray-950">
        <div className="max-w-6xl mx-auto p-4 md:p-6">
          {children}
        </div>
      </div>
    </div>
  )
}
