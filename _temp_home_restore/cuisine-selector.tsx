"use client"

import { useState, useEffect } from "react"
import { Shield, Calculator, Database, User, LogOut } from "lucide-react"
import { EnhancedFeatureButton } from "./components/enhanced-feature-button"

const features = [
  {
    icon: Shield,
    title: "项目安全评估",
    subtitle: "查一查，别踩雷",
  },
  {
    icon: Calculator,
    title: "商业模式拆解",
    subtitle: "算清收益，避开陷阱",
  },
  {
    icon: Database,
    title: "全网项目库",
    subtitle: "看看别人踩过的坑",
  },
  {
    icon: User,
    title: "我的",
    subtitle: "我的历史查询与资产",
  },
]

export default function WiseScanHome() {
  const [language, setLanguage] = useState<"en" | "zh" | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setLanguage("zh")
    setMounted(true)
  }, [])

  const handleFeatureClick = (title: string) => {
    console.log(`功能: ${title}`)
  }

  const handleDisconnect = () => {
    console.log("钱包已断开连接")
  }

  if (!mounted) return null

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
            {/* Language button */}
            <button
              onClick={() => setLanguage(language === "en" ? "zh" : "en")}
              className="px-3 py-1.5 rounded-lg flex items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-700 hover:border-zinc-600 transition-all text-zinc-300 text-xs font-medium"
              title="Language"
            >
              {language === "en" ? "EN" : "中文"}
            </button>

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

        {/* Main content */}
        <div className="flex flex-col gap-3 mb-12">
          {features.map((feature) => (
            <EnhancedFeatureButton
              key={feature.title}
              icon={feature.icon}
              title={feature.title}
              subtitle={feature.subtitle}
              onClick={() => handleFeatureClick(feature.title)}
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
