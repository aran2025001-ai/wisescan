import { useState, useRef, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAccount, useDisconnect } from "wagmi"
import { ChevronLeft, Plus, Mic, Keyboard, Send, AlertCircle, Gift, ChevronRight } from "lucide-react"
import { motion } from "framer-motion"
import { ResultsSection } from "@/components/ResultsSection"

interface Message {
  id: string
  type: "ai" | "user"
  content: string
  timestamp: Date
  isButton?: boolean
  subtitle?: string
  isForm?: boolean
  isScanButton?: boolean
  isResults?: boolean
}

const initialWelcomeMessage = `👋 看不懂项目的推广规则？直推、间推、团队奖……到底能赚多少钱？

把项目商业模式给我看，我帮你拆解成大白话，解释的明明白白，再给你做一个专属于你的计算器——你填数字，我算收益。每天、每周、每月、每年都能算出来。

还会告诉你：如何排兵布阵利益最大化，点位怎么安排，要拉多少人才能不亏。

一次全面拆解仅需 5.99 USDT，包含商业模式专业解读、静态、动态收益，还有风险预警，避免让你盲目投进去，把帐算明白，让你明确市场打法，也避免被坑。一个顶级专家陪你闯天下！`

export default function BusinessBreakdown() {
  const navigate = useNavigate()
  const { isConnected } = useAccount()
  const { disconnect } = useDisconnect()

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      type: "ai",
      content: initialWelcomeMessage,
      timestamp: new Date(),
    },
    {
      id: "2",
      type: "ai",
      content: "我们是怎么拆解的？",
      isButton: true,
      subtitle: "点这里了解拆解标准",
      timestamp: new Date(Date.now() + 500),
    },
    {
      id: "3",
      type: "ai",
      content: "准备好了吗？在下方输入项目商业模式，开始拆解。",
      timestamp: new Date(Date.now() + 1000),
    },
    {
      id: "4",
      type: "ai",
      isForm: true,
      content: "form",
      timestamp: new Date(Date.now() + 1500),
    },
    {
      id: "5",
      type: "ai",
      content: "如有补充，您可以在下方输入框用文字或语音进一步说明。当您认为信息已完整提供，您可点击下方按钮，开始进行商业模式拆解。",
      timestamp: new Date(Date.now() + 2000),
    },
    {
      id: "6",
      type: "ai",
      content: "开始拆解",
      isScanButton: true,
      subtitle: "快速生成完整拆解，约10~30秒内返回结果",
      timestamp: new Date(Date.now() + 2500),
    },
  ])

  const [inputValue, setInputValue] = useState("")
  const [isVoiceMode, setIsVoiceMode] = useState(true)
  const [isRecording, setIsRecording] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showBackConfirmModal, setShowBackConfirmModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [formData, setFormData] = useState({
    businessRule: "",
    uploadedImages: "",
  })
  
  interface ResultsState {
    investmentAmount: number
    directReferrals: number
    indirectReferrals: number
    perPersonAmount: number
  }

  const [resultsState, setResultsState] = useState<ResultsState>({
    investmentAmount: 1000,
    directReferrals: 0,
    indirectReferrals: 0,
    perPersonAmount: 0,
  })
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Redirect if wallet disconnected
  useEffect(() => {
    if (!isConnected) {
      navigate("/")
    }
  }, [isConnected, navigate])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleNewConversation = () => {
    setShowConfirmModal(true)
  }

  const handleBackClick = () => {
    setShowBackConfirmModal(true)
  }

  const handleSendMessage = () => {
    if (!inputValue.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: inputValue,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue("")

    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        type: "ai",
        content: "正在分析您提供的信息中... 这是一个演示回复。",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, aiResponse])
    }, 800)
  }

  const toggleInputMode = () => {
    setIsVoiceMode(!isVoiceMode)
    setInputValue("")
  }

  const handleVoiceStart = () => {
    setIsRecording(true)
  }

  const handleVoiceEnd = () => {
    setIsRecording(false)
  }

  const handleImageUpload = () => {
    console.log("[BusinessBreakdown] Image upload button clicked")
  }

  const handleStartBreakdown = () => {
    setShowPaymentModal(true)
  }

  const handleConfirmPayment = () => {
    setShowPaymentModal(false)
    alert("支付功能开发中，当前为演示模式。将展示模拟数据。")
    
    // Add loading message
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      type: "ai",
      content: "正在为您生成拆解报告，请稍等。",
      timestamp: new Date(),
    }])
    
    // Simulate loading and show results after 2 seconds
    setTimeout(() => {
      setShowResults(true)
      // Add results message
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        type: "ai",
        content: "results",
        isResults: true,
        timestamp: new Date(),
      } as any])
      
      // Add follow-up message
      setTimeout(() => {
        setMessages(prev => [...prev, {
          id: (Date.now() + 2).toString(),
          type: "ai",
          content: "如果您对商业模式解读或其他内容仍有疑问，可以在下方输入框用文字或语音进一步咨询，我会为您进行解答。",
          timestamp: new Date(),
        }])
      }, 500)
    }, 2000)
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-black sticky top-0 z-10">
        <button 
          onClick={handleBackClick}
          className="text-blue-400 hover:text-blue-300 transition-colors flex-shrink-0"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-white text-base font-semibold flex-1 text-center">商业模式拆解</h1>
        <button
          onClick={handleNewConversation}
          className="text-blue-400 hover:text-blue-300 transition-colors flex-shrink-0 flex items-center gap-1"
          title="开始新对话"
        >
          <Plus className="w-5 h-5" />
          <span className="text-xs">新对话</span>
        </button>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((message, index) => (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.08 }}
            className={`flex gap-2 ${message.type === "user" ? "flex-row-reverse" : ""}`}
          >
            {/* Avatar */}
            <div
              className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                message.type === "ai"
                  ? "bg-blue-500 text-white"
                  : "bg-green-500 text-white"
              }`}
            >
              {message.type === "ai" ? "明" : "我"}
            </div>

            {/* Message Content */}
            <div
              className={`flex-1 flex flex-col gap-1 ${
                message.type === "user" ? "items-end" : "items-start"
              } max-w-xs`}
            >
              {message.type === "ai" && !message.isButton && !message.isForm && !message.isScanButton && (
                <span className="text-xs text-zinc-500 px-2">明鉴·首席分析师</span>
              )}

              {/* Button Message */}
              {message.isButton ? (
                <div className="flex flex-col gap-2 items-start">
                  <button className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-full text-sm font-semibold flex items-center gap-2 transition-colors">
                    <span>📖</span>
                    <span>{message.content}</span>
                  </button>
                  {message.subtitle && (
                    <span className="text-xs text-zinc-500 px-2">{message.subtitle}</span>
                  )}
                </div>
              ) : message.isScanButton ? (
                /* Scan Button Message */
                <div className="flex flex-col gap-2 items-start w-full">
                  <button
                    onClick={handleStartBreakdown}
                    className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-full text-sm font-semibold transition-colors"
                  >
                    {message.content}
                  </button>
                  {message.subtitle && (
                    <span className="text-xs text-zinc-500 px-2">点击后需支付 5.99 USDT 解锁完整拆解报告（含模式解答、收益计算器、动静态策略建议、风险分析等）。一次付费，永久查看。</span>
                  )}
                </div>
              ) : message.isForm ? (
                /* Form Message */
                <div className="w-full bg-zinc-900 rounded-lg p-4 space-y-4">
                  {/* Header with AI name */}
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-xs font-semibold text-white">明</div>
                    <span className="text-sm text-zinc-300 font-medium">明鉴·首席分析师</span>
                  </div>

                  {/* Instructions */}
                  <span className="text-xs text-zinc-400">请尽可能完整地提供以下信息。您给得越详细，拆解和算账就越精准。</span>

                  {/* Business Rule - textarea without red * */}
                  <div className="space-y-2">
                    <label className="text-sm text-white">项目商业模式规则</label>
                    <textarea
                      placeholder="复制粘贴项目推广规则文本，例如：投资100U起，每日分红1%，直推10%，间推5%，团队业绩达标额外2%"
                      value={formData.businessRule}
                      onChange={(e) => setFormData({ ...formData, businessRule: e.target.value })}
                      className="w-full px-3 py-2 h-20 bg-zinc-800 text-white text-sm rounded border border-zinc-700 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                    />
                  </div>

                  {/* Image Upload - without red *, optimized placeholder, improved button style */}
                  <div className="space-y-2">
                    <label className="text-sm text-white">上传图片/截图</label>
                    <div className="flex items-stretch gap-0 h-20 bg-zinc-800 border border-zinc-700 rounded overflow-hidden focus-within:ring-1 focus-within:ring-blue-500">
                      <input
                        type="text"
                        placeholder="可上传商业模式宣传海报、规则说明等&#10;支持 JPG、PNG，单张不超过5MB"
                        value={formData.uploadedImages}
                        readOnly
                        className="flex-1 px-3 py-2 bg-transparent text-white text-sm placeholder-zinc-600 focus:outline-none leading-tight"
                      />
                      <button
                        onClick={handleImageUpload}
                        className="flex-shrink-0 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors border-l border-zinc-700"
                      >
                        上传
                      </button>
                    </div>
                  </div>

                  {/* Security Warning */}
                  <div className="text-xs text-zinc-400 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>请勿上传或输入钱包私钥、密码等敏感信息。</span>
                  </div>
                </div>
              ) : message.isResults ? (
                /* Results Section Message */
                <ResultsSection
                  onStaticChange={(amount) => setResultsState({ ...resultsState, investmentAmount: amount })}
                />
              ) : (
                /* Text Message */
                <div className={message.id === "5" ? "" : "flex flex-col gap-1"}>
                  {message.id === "5" ? (
                    /* Combined card for message 5 with invite banner */
                    <div className="bg-zinc-800 text-zinc-200 rounded-lg overflow-hidden">
                      {/* Message content */}
                      <div className="px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
                        {message.content}
                      </div>
                      
                      {/* Divider */}
                      <div className="h-px bg-gray-600"></div>
                      
                      {/* Invite Banner inside the card */}
                      <button 
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowInviteModal(true)
                        }}
                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-zinc-700 transition-colors text-left"
                      >
                        <Gift className="w-5 h-5 flex-shrink-0 text-blue-400" />
                        <span className="text-sm flex-1 text-gray-300">
                          邀请一位朋友，立得 2.99U 代金券（终身一次）
                        </span>
                        <ChevronRight className="w-5 h-5 flex-shrink-0 text-gray-500" />
                      </button>
                    </div>
                  ) : (
                    /* Regular message */
                    <div
                      className={`px-4 py-2 rounded-lg text-sm leading-relaxed whitespace-pre-wrap ${
                        message.type === "ai"
                          ? "bg-zinc-800 text-zinc-200"
                          : "bg-green-500 text-white"
                      }`}
                    >
                      {message.content}
                    </div>
                  )}
                </div>
              )}

              {!message.isForm && !message.isScanButton && (
                <span className="text-xs text-zinc-600 px-2">
                  {message.timestamp.toLocaleTimeString("zh-CN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}
            </div>
          </motion.div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-zinc-800 bg-black p-4">
        <div className="flex items-center gap-2">
          {/* Mode Toggle Button */}
          <button
            onClick={toggleInputMode}
            className="flex-shrink-0 p-2 rounded-lg bg-zinc-700 text-zinc-400 hover:bg-zinc-600 transition-colors"
            title={isVoiceMode ? "切换到文字输入" : "切换到语音输入"}
          >
            {isVoiceMode ? (
              <Keyboard className="w-5 h-5" />
            ) : (
              <Mic className="w-5 h-5" />
            )}
          </button>

          {/* Main Button - Voice or Input */}
          {isVoiceMode ? (
            <button
              onMouseDown={handleVoiceStart}
              onMouseUp={handleVoiceEnd}
              onMouseLeave={handleVoiceEnd}
              onTouchStart={handleVoiceStart}
              onTouchEnd={handleVoiceEnd}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all text-sm ${
                isRecording
                  ? "bg-blue-500 text-white"
                  : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
              }`}
            >
              {isRecording ? "松开发送" : "按住说话"}
            </button>
          ) : (
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSendMessage()
                }
              }}
              placeholder="输入补充说明..."
              className="flex-1 px-4 py-2 bg-zinc-700 text-white rounded-lg text-sm placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
            />
          )}

          {/* Send Button (only in text mode) */}
          {!isVoiceMode && (
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim()}
              className={`flex-shrink-0 p-2 rounded-lg transition-colors ${
                inputValue.trim()
                  ? "bg-blue-500 text-white hover:bg-blue-600"
                  : "bg-zinc-700 text-zinc-500 cursor-not-allowed"
              }`}
              title="发送"
            >
              <Send className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Confirm Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-zinc-900 rounded-lg p-4 max-w-xs mx-4 space-y-3 border border-zinc-600">
            <h2 className="text-white font-semibold text-sm text-center">新建对话</h2>
            <p className="text-zinc-300 text-xs text-center whitespace-nowrap">将清空当前对话，开始新的拆解。是否继续？</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-1.5 px-3 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors text-xs"
              >
                取消
              </button>
              <button
                onClick={() => {
                  setShowConfirmModal(false)
                  setMessages([
                    {
                      id: "1",
                      type: "ai",
                      content: initialWelcomeMessage,
                      timestamp: new Date(),
                    },
                  ])
                }}
                className="flex-1 py-1.5 px-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Confirm Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-zinc-900 rounded-lg p-4 max-w-xs mx-4 space-y-3 border border-zinc-600">
            <h2 className="text-white font-semibold text-sm text-center">开始拆解</h2>
            <p className="text-zinc-300 text-xs text-center">将为您生成商业模式拆解报告，需支付 5.99 USDT。是否继续？</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 py-1.5 px-3 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors text-xs"
              >
                取消
              </button>
              <button
                onClick={handleConfirmPayment}
                className="flex-1 py-1.5 px-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Back Confirm Modal */}
      {showBackConfirmModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-zinc-900 rounded-lg p-4 max-w-xs mx-4 space-y-3 border border-zinc-600">
            <h2 className="text-white font-semibold text-sm text-center">确认退出</h2>
            <p className="text-zinc-300 text-xs text-center leading-relaxed">对话记录将在退出后清空。<br />商业模式拆解报告已保存在"我的"历史报告中，可随时查看。<br /><br />确定退出吗？</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowBackConfirmModal(false)}
                className="flex-1 py-1.5 px-3 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors text-xs"
              >
                取消
              </button>
              <button
                onClick={() => {
                  setShowBackConfirmModal(false)
                  navigate("/home")
                }}
                className="flex-1 py-1.5 px-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-zinc-900 rounded-lg p-4 max-w-xs mx-4 space-y-3 border border-zinc-600">
            <h2 className="text-white font-semibold text-sm text-center">邀请功能</h2>
            <p className="text-zinc-300 text-xs text-center">邀请功能开发中</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowInviteModal(false)}
                className="flex-1 py-1.5 px-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
