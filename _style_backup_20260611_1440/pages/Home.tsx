import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Shield, Calculator, Database, User, LogOut } from "lucide-react"
import { useAccount, useDisconnect } from "wagmi"
import { LanguageSwitch } from "@/components/LanguageSwitch"
import { EnhancedFeatureButton } from "@/components/EnhancedFeatureButton"

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

  // 钱包断开时重定向到欢迎页
  useEffect(() => {
    if (!isConnected) {
      navigate("/")
    }
  }, [isConnected, navigate])

  const handleFeatureClick = (feature: typeof features[number]) => {
    if (feature.enabled) {
      navigate(feature.route)
    } else {
      console.log(`页面开发中: ${feature.title}`)
    }
  }

  const handleDisconnect = () => {
    disconnect()
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-[428px]">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          {/* Logo */}
          <div className="text-blue-500 text-base font-semibold">
            明鉴WiseScan
          </div>

          {/* Right buttons */}
          <div className="flex items-center gap-3">
            {/* Language switch */}
            <LanguageSwitch />

            {/* Disconnect button */}
            <button
              onClick={handleDisconnect}
              className="px-3 py-1.5 rounded-lg flex items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-700 hover:border-zinc-600 transition-all text-zinc-300"
              title="Disconnect"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Feature buttons */}
        <div className="flex flex-col gap-3 mb-12">
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

        {/* Footer text */}
        <div className="text-center text-zinc-600 text-xs">
          已有<span className="font-semibold text-zinc-400">500+</span>位用户使用明鉴进行项目评估
        </div>
      </div>
    </div>
  )
}
