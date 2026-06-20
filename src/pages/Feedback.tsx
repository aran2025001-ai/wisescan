import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Mail } from 'lucide-react'

export default function Feedback() {
  const navigate = useNavigate()
  const [feedbackText, setFeedbackText] = useState('')
  const [showToast, setShowToast] = useState(false)

  const handleSubmit = () => {
    if (!feedbackText.trim()) return
    setShowToast(true)
    setTimeout(() => {
      setShowToast(false)
      setFeedbackText('')
      navigate('/profile')
    }, 2000)
  }

  return (
    <div className="text-white flex flex-col min-h-screen">
      {/* 顶部导航 */}
      <div className="sticky top-0 z-40 border-b border-[#343438] bg-black backdrop-blur">
        <div className="flex items-center justify-between px-4 py-2">
          <button
            onClick={() => navigate('/profile')}
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-zinc-800 transition-colors"
            aria-label="返回"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="text-sm font-semibold flex-1 text-center">问题反馈与优化建议</h1>
          <div className="h-8 w-8" />
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto flex flex-col items-center px-4 pt-6 pb-10">
        <div className="w-full max-w-sm space-y-4">
          {/* 图标（居中，精致样式） */}
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Mail className="w-7 h-7 text-white" />
          </div>

          {/* 说明文字 + 输入框（左对齐，整体往上靠） */}
          <div className="space-y-3">
            <p className="text-zinc-400 text-xs leading-relaxed">
              请描述您遇到的问题或优化建议，我们会认真考虑每一条反馈。
            </p>

            {/* 输入框 */}
            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="请输入反馈内容..."
              className="w-full h-36 bg-zinc-900 border border-[#343438] rounded-lg px-3 py-2.5 text-xs text-white placeholder-zinc-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 resize-none leading-relaxed"
            />
          </div>

          {/* 提交按钮 */}
          <button
            onClick={handleSubmit}
            disabled={!feedbackText.trim()}
            className="w-full py-2.5 bg-blue-500 rounded-full text-white text-sm font-semibold hover:bg-blue-600 active:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            提交
          </button>
        </div>
      </div>

      {/* 底部 slogan */}
      <div className="py-4 text-center">
        <span className="text-xs text-white">出一份力，让天下每一位投资者不再被割韭菜！</span>
      </div>

      {/* 提交成功提示 */}
      {showToast && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-zinc-900 border border-[#343438] rounded-lg px-6 py-4 shadow-xl pointer-events-auto">
            <p className="text-white text-sm">感谢您的反馈！我们会认真考虑。</p>
          </div>
        </div>
      )}
    </div>
  )
}
