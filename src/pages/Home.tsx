import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Shield, Calculator, Database, User, DoorOpen } from "lucide-react"
import { useAccount, useDisconnect } from "wagmi"
import { EnhancedFeatureButton } from "@/components/EnhancedFeatureButton"
import { LanguageSwitch } from "@/components/LanguageSwitch"

const features = [
  {
    icon: Shield,
    title: "项目安全评估",
    subtitle: "查一查，别踩雷",
    route: "/assess",
    enabled: true,
  },
  {
    icon: Calculator,
    title: "商业模式拆解",
    subtitle: "算清收益，避开陷阱",
    route: "/business",
    enabled: true,
  },
  {
    icon: Database,
    title: "全网项目库",
    subtitle: "看看别人踩过的坑",
    route: "/library",
    enabled: true,
  },
  {
    icon: User,
    title: "我的",
    subtitle: "我的历史查询与资产",
    route: "/profile",
    enabled: true,
  },
]

export default function Home() {
  const navigate = useNavigate()
  const { isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false)

  // 钱包断开时重定向到欢迎页
  useEffect(() => {
    if (!isConnected) {
      navigate("/")
    }
  }, [isConnected, navigate])

  const handleFeatureClick = (feature: typeof features[number]) => {
    if (feature.enabled) {
      navigate(feature.route)
    }
  }

  const handleDisconnect = () => {
    setIsLogoutModalOpen(true)
  }

  const handleConfirmLogout = () => {
    setIsLogoutModalOpen(false)
    disconnect()
    localStorage.clear()
    sessionStorage.clear()
    window.location.replace('/')
  }

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-[428px] flex flex-col flex-1">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          {/* Logo */}
          <div className="text-blue-500 text-base font-semibold">
            明鉴WiseScan
          </div>

          {/* Right buttons */}
          <div className="flex items-center gap-3">
            <LanguageSwitch />

            {/* Disconnect button — same style as LanguageSwitch */}
            <button
              onClick={handleDisconnect}
              className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium bg-gradient-to-br from-zinc-800 to-zinc-900 border border-[#343438] hover:border-zinc-600 text-zinc-300 transition-all"
              title="退出"
            >
              <DoorOpen className="w-3.5 h-3.5" />
              退出
            </button>
          </div>
        </div>

        {/* Push feature buttons upward from center */}
        <div className="flex-1" />

        {/* Feature buttons */}
        <div className="flex flex-col gap-3">
          {features.map((feature) => (
            <EnhancedFeatureButton
              key={feature.title}
              icon={feature.icon}
              title={feature.title}
              subtitle={feature.subtitle}
              onClick={() => handleFeatureClick(feature)}
            />
          ))}
        </div>

        {/* Push to bottom — larger share to keep buttons higher */}
        <div className="flex-[2]" />

        {/* Bottom texts */}
        <div className="text-center pb-4">
          <div className="text-sm font-bold text-blue-400 mb-1">怕被割？先明鉴！</div>
          <div className="text-xs text-zinc-500">
            已有<span className="font-semibold text-zinc-400">500+</span>位用户使用明鉴进行项目评估
          </div>
        </div>
      </div>

      {/* 退出钱包确认弹窗 */}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setIsLogoutModalOpen(false)}>
          <div className="bg-zinc-900 rounded-lg p-4 w-80 mx-4 space-y-3 border border-[#343438]" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-white font-semibold text-sm text-center">退出钱包</h2>
            <p className="text-zinc-300 text-xs leading-relaxed text-left">确认要退出当前钱包吗？退出后需要重新连接才能使用明鉴。</p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setIsLogoutModalOpen(false)}
                className="flex-1 py-1.5 px-3 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors text-xs"
              >
                取消
              </button>
              <button
                onClick={handleConfirmLogout}
                className="flex-1 py-1.5 px-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs"
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
