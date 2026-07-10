import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccount, useDisconnect } from 'wagmi'
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  BarChart,
  Users,
  Ticket,
  HelpCircle,
  Info,
  LogOut,
  MessageSquare,
} from 'lucide-react'

interface MenuItem {
  icon: React.ReactNode
  label: string
  onClick: () => void
}

export default function Profile() {
  const navigate = useNavigate()
  const { address } = useAccount()
  const { disconnect } = useDisconnect()
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false)
  const [userCount, setUserCount] = useState('500')

  // 获取后台配置的用户展示数字
  useEffect(() => {
    fetch('/api/site-config?key=display_user_count')
      .then(r => r.json())
      .then(data => {
        if (data.success && data.data?.display_user_count) {
          setUserCount(data.data.display_user_count)
        }
      })
      .catch(() => {})
  }, [])

  const maskAddress = (addr: string): string => {
    if (!addr || addr.length < 10) return addr || ''
    return `${addr.slice(0, 5)}...${addr.slice(-5)}`
  }

  const handleProjectAssessment = () => {
    navigate('/profile/reports')
  }

  const handleBusinessModel = () => {
    navigate('/profile/business-models')
  }

  const handleInviteRebate = () => {
    navigate('/profile/invitation')
  }

  const handleCoupons = () => {
    navigate('/profile/coupons')
  }

  const handleHelpCenter = () => {
    navigate('/profile/help')
  }

  const handleAbout = () => {
    navigate('/profile/about')
  }

  const handleFeedback = () => {
    navigate('/profile/feedback')
  }

  const handleLogout = () => {
    setIsLogoutModalOpen(true)
  }

  const handleConfirmLogout = () => {
    setIsLogoutModalOpen(false)
    disconnect()
    // 清除所有 localStorage/sessionStorage 避免 wagmi/RainbowKit 状态残留
    localStorage.clear()
    sessionStorage.clear()
    // 用 location.replace 做完整页面刷新，确保 RainbowKit/wagmi 重新初始化
    window.location.replace('/')
  }

  const allMenuItems: MenuItem[] = [
    {
      icon: <FileText size={20} />,
      label: '我的项目评估报告',
      onClick: handleProjectAssessment,
    },
    {
      icon: <BarChart size={20} />,
      label: '我的商业模式拆解报告',
      onClick: handleBusinessModel,
    },
    {
      icon: <Users size={20} />,
      label: '邀请返佣',
      onClick: handleInviteRebate,
    },
    {
      icon: <Ticket size={20} />,
      label: '我的代金券',
      onClick: handleCoupons,
    },
    {
      icon: <HelpCircle size={20} />,
      label: '帮助中心',
      onClick: handleHelpCenter,
    },
    {
      icon: <Info size={20} />,
      label: '关于明鉴',
      onClick: handleAbout,
    },
    {
      icon: <MessageSquare size={20} />,
      label: '问题反馈与优化建议',
      onClick: handleFeedback,
    },
    {
      icon: <LogOut size={20} />,
      label: '退出钱包',
      onClick: handleLogout,
    },
  ]

  return (
    <div className="text-white flex flex-col min-h-screen">
      {/* 顶部导航栏 */}
      <div className="sticky top-0 z-40 border-b border-[#343438] bg-black backdrop-blur">
        <div className="flex items-center px-4 py-2">
        <button
          onClick={() => navigate('/home')}
          className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-zinc-800 active:bg-zinc-700 active:scale-[0.95] transition-all duration-150"
          aria-label="返回"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="flex-1 text-center text-sm font-semibold">我的</h1>
        <span className="text-xs text-zinc-400">
          {address ? maskAddress(address) : '未连接'}
        </span>
        </div>
      </div>

      {/* 菜单列表 */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-4 space-y-2">
          {allMenuItems.map((item, index) => (
            <button
              key={index}
              onClick={item.onClick}
              className="w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-150 text-zinc-300 hover:bg-zinc-900 hover:text-blue-400 active:bg-zinc-800 active:scale-[0.97] group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex-shrink-0 text-zinc-500 group-hover:text-blue-400 transition-colors">
                  {item.icon}
                </div>
                <span className="text-sm font-medium truncate group-hover:text-blue-400 transition-colors">
                  {item.label}
                </span>
              </div>
              <ChevronRight
                size={18}
                className="flex-shrink-0 ml-2 text-zinc-700 group-hover:text-blue-400 transition-colors"
              />
            </button>
          ))}
        </div>
      </div>

      {/* 底部文案 — 照搬 Home 页结构 */}
      <div className="text-center pb-12">
        <div className="text-sm font-bold text-blue-400 mb-1">怕被割？先明鉴！</div>
        <div className="text-xs text-zinc-500">
          已有<span className="font-semibold text-zinc-400">{userCount}+</span>位用户使用明鉴进行项目评估
        </div>
      </div>

      {/* 退出钱包确认弹窗 */}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[99999]" onClick={() => setIsLogoutModalOpen(false)}>
          <div className="bg-zinc-900 rounded-lg p-4 w-80 mx-4 space-y-3 border border-[#343438]" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-white font-semibold text-sm text-center">退出钱包</h2>
            <p className="text-zinc-300 text-xs leading-relaxed text-left">确认要退出当前钱包吗？退出后需要重新连接才能使用明鉴。</p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setIsLogoutModalOpen(false)}
                className="flex-1 py-3 px-3 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 active:bg-zinc-600 active:scale-[0.97] transition-all duration-150 text-sm"
              >
                取消
              </button>
              <button
                onClick={handleConfirmLogout}
                className="flex-1 py-1.5 px-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-500 active:scale-[0.97] transition-all duration-150 text-xs"
              >
                确认退出
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
