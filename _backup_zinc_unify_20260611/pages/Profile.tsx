import { useState } from 'react'
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
  X,
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
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false)
  const [feedbackText, setFeedbackText] = useState('')

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
    setIsFeedbackModalOpen(true)
  }

  const handleSubmitFeedback = () => {
    if (!feedbackText.trim()) {
      alert('请填写反馈内容')
      return
    }
    alert('感谢您的反馈！我们会认真考虑。')
    setFeedbackText('')
    setIsFeedbackModalOpen(false)
  }

  const handleCloseFeedbackModal = () => {
    setFeedbackText('')
    setIsFeedbackModalOpen(false)
  }

  const handleLogout = () => {
    disconnect()
    navigate('/')
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
    <div className="text-white flex flex-col">
      {/* 顶部导航栏 */}
      <div className="sticky top-0 z-40 flex items-center justify-between px-4 py-4 border-b border-neutral-800 bg-black/95 backdrop-blur-sm">
        <button
          onClick={() => navigate('/home')}
          className="flex items-center justify-center w-10 h-10 text-white hover:opacity-70 transition-opacity"
          aria-label="返回"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-semibold">我的</h1>
        <span className="text-sm text-neutral-400">
          {address ? maskAddress(address) : '未连接'}
        </span>
      </div>

      {/* 菜单列表 */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-4 space-y-2">
          {allMenuItems.map((item, index) => (
            <button
              key={index}
              onClick={item.onClick}
              className="w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-200 text-neutral-300 hover:bg-neutral-900 hover:text-blue-400 group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex-shrink-0 text-neutral-500 group-hover:text-blue-400 transition-colors">
                  {item.icon}
                </div>
                <span className="text-sm font-medium truncate group-hover:text-blue-400 transition-colors">
                  {item.label}
                </span>
              </div>
              <ChevronRight
                size={18}
                className="flex-shrink-0 ml-2 text-neutral-700 group-hover:text-blue-400 transition-colors"
              />
            </button>
          ))}
        </div>

        <div style={{ textAlign: 'center', paddingBottom: '32px', paddingTop: '24px' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#3B82F6' }}>怕被割？先明鉴！</div>
        </div>
      </div>

      {/* 反馈模态框 */}
      {isFeedbackModalOpen && (
        <div className="fixed inset-0 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 rounded-2xl p-5 w-[85%] max-w-sm shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold text-base">反馈与建议</h2>
              <button
                onClick={handleCloseFeedbackModal}
                className="p-1 hover:bg-neutral-800 rounded transition-colors text-neutral-500 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="请描述您遇到的问题或优化建议"
              className="w-full h-24 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm placeholder-neutral-500 focus:outline-none focus:border-blue-400 resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleSubmitFeedback}
                className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors"
              >
                提交
              </button>
              <button
                onClick={handleCloseFeedbackModal}
                className="flex-1 px-4 py-2 border border-blue-400 text-blue-400 hover:bg-blue-400/10 rounded-lg font-medium text-sm transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
