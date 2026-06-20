"use client"

import { useState, useRef, useEffect } from "react"
import { ChevronLeft, Mic, Keyboard, Send, BookOpen, AlertCircle } from "lucide-react"
import { motion } from "framer-motion"

interface Message {
  id: string
  type: "ai" | "user"
  content: string
  isButton?: boolean
  subtitle?: string
  isForm?: boolean
  isScanButton?: boolean
  timestamp: Date
}

const initialWelcomeMessage = `👋 你是不是也遇到过——
项目看着很火，投进去就跑路？
白皮书全是术语，根本看不懂？
群里都说好，一提现就卡？

我是明鉴风险洞察官。我的工作就是帮你提前看穿这些风险。

你只需要：把项目名称、合约地址、或者任何你看到的资料发给我。你给得越全，我分析得越准。

第一步完全免费：我会给你一份"快速扫描"，告诉你合约有没有问题、持币是不是集中、信息披露了多少。

如果你想看更深度的全景风险报告（包括六维诊断图、全网舆情、AI综合安全解读），只需要 2.99 USDT —— 相当于少吃一顿快餐，但可能帮你避开一个几万块的坑。`

export default function ProjectAssessment() {
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
      content: "我们是怎么审查的？",
      isButton: true,
      subtitle: "点这里了解评估标准",
      timestamp: new Date(Date.now() + 500),
    },
    {
      id: "3",
      type: "ai",
      content: "准备好了吗？在下方输入项目名称或合约地址，开始查第一个项目。",
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
      content: "如果您知道该项目曾经变更过模式（如矿机→质押）或项目方团队有过负面历史，您可以在下方输入框用文字或语音进一步说明。当您认为信息已完整提供，您可点击下方按钮，开始进行项目审查。",
      timestamp: new Date(Date.now() + 2000),
    },
    {
      id: "6",
      type: "ai",
      content: "开始快速扫描",
      isScanButton: true,
      subtitle: "快速扫描完全免费，约10~30秒内返回结果",
      timestamp: new Date(Date.now() + 2500),
    },
  ])
  const [inputValue, setInputValue] = useState("")
  const [isVoiceMode, setIsVoiceMode] = useState(true)
  const [isRecording, setIsRecording] = useState(false)
  const [formData, setFormData] = useState({
    projectName: "",
    contractAddress: "",
    website: "",
    community: "",
    whitepaper: "",
    remarks: "",
    images: [],
  })
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

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
        content: "正在分析项目信息中... 这是一个演示回复。",
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
    console.log("[v0] Image upload button clicked")
  }

  return (
    <div className="flex flex-col h-screen w-full max-w-sm mx-auto bg-black">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 bg-black sticky top-0 z-10">
        <button className="text-blue-400 hover:text-blue-300 transition-colors flex-shrink-0">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-white text-base font-semibold flex-1 text-center">项目安全评估</h1>
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
            {true && (
              <div
                className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                  message.type === "ai"
                    ? "bg-blue-500 text-white"
                    : "bg-green-500 text-white"
                }`}
              >
                {message.type === "ai" ? "明" : "我"}
              </div>
            )}

            {/* Message Content */}
            <div
              className={`flex-1 flex flex-col gap-1 ${
                message.type === "user" ? "items-end" : "items-start"
              } max-w-xs`}
            >
              {message.type === "ai" && !message.isButton && (
                <span className="text-xs text-zinc-500 px-2">明鉴·风险洞察官</span>
              )}
              
              {/* Button Message */}
              {message.isButton ? (
                <div className="flex flex-col gap-2 items-start">
                  <button className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-full text-sm font-semibold flex items-center gap-2 transition-colors">
                    <BookOpen className="w-4 h-4" />
                    <span>{message.content}</span>
                  </button>
                  {message.subtitle && (
                    <span className="text-xs text-zinc-500 px-2">{message.subtitle}</span>
                  )}
                </div>
              ) : message.isScanButton ? (
                /* Scan Button Message */
                <div className="flex flex-col gap-2 items-start w-full">
                  <button className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-full text-sm font-semibold transition-colors">
                    {message.content}
                  </button>
                  {message.subtitle && (
                    <span className="text-xs text-zinc-500 px-2">{message.subtitle}</span>
                  )}
                </div>
              ) : message.isForm ? (
                /* Form Message */
                <div className="w-full bg-zinc-900 rounded-lg p-4 space-y-4">
                  <span className="text-xs text-zinc-400">请尽可能完整地提供以下信息。你给得越详细，评估就越精准。</span>
                  
                  {/* Project Name */}
                  <div className="space-y-2">
                    <label className="text-sm text-white">项目名称 <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      placeholder="输入项目名称"
                      value={formData.projectName}
                      onChange={(e) => setFormData({...formData, projectName: e.target.value})}
                      className="w-full px-3 py-2 bg-zinc-800 text-white text-sm rounded border border-zinc-700 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  {/* Contract Address */}
                  <div className="space-y-2">
                    <label className="text-sm text-white">合约地址 <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      placeholder="输入合约地址"
                      value={formData.contractAddress}
                      onChange={(e) => setFormData({...formData, contractAddress: e.target.value})}
                      className="w-full px-3 py-2 bg-zinc-800 text-white text-sm rounded border border-zinc-700 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  {/* Website */}
                  <div className="space-y-2">
                    <label className="text-sm text-white">官网链接 <span className="text-zinc-500 text-xs">(可选)</span></label>
                    <input
                      type="text"
                      placeholder="https://"
                      value={formData.website}
                      onChange={(e) => setFormData({...formData, website: e.target.value})}
                      className="w-full px-3 py-2 bg-zinc-800 text-white text-sm rounded border border-zinc-700 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  {/* Community */}
                  <div className="space-y-2">
                    <label className="text-sm text-white">社群链接 <span className="text-zinc-500 text-xs">(可选)</span></label>
                    <input
                      type="text"
                      placeholder="https://t.me/xxx 或 https://twitter.com/xxx"
                      value={formData.community}
                      onChange={(e) => setFormData({...formData, community: e.target.value})}
                      className="w-full px-3 py-2 bg-zinc-800 text-white text-sm rounded border border-zinc-700 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <span className="text-xs text-zinc-500">提供 Telegram、Discord、Twitter 等链接，可帮助分析社群舆情</span>
                  </div>

                  {/* Whitepaper */}
                  <div className="space-y-2">
                    <label className="text-sm text-white">项目白皮书/文档链接 <span className="text-zinc-500 text-xs">(可选)</span></label>
                    <input
                      type="text"
                      placeholder="https://xxx.com/whitepaper.pdf"
                      value={formData.whitepaper}
                      onChange={(e) => setFormData({...formData, whitepaper: e.target.value})}
                      className="w-full px-3 py-2 bg-zinc-800 text-white text-sm rounded border border-zinc-700 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  {/* Remarks */}
                  <div className="space-y-2">
                    <label className="text-sm text-white">补充说明 <span className="text-zinc-500 text-xs">(可选，多行文本)</span></label>
                    <textarea
                      placeholder="可以粘贴项目官方公告、群公告、聊天记录等关键信息"
                      value={formData.remarks}
                      onChange={(e) => setFormData({...formData, remarks: e.target.value})}
                      className="w-full px-3 py-2 bg-zinc-800 text-white text-sm rounded border border-zinc-700 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500 h-20 resize-none"
                    />
                    <span className="text-xs text-zinc-500">你提供的线索越多，越能发现隐藏风险</span>
                  </div>

                  {/* Image Upload */}
                  <div className="space-y-2">
                    <label className="text-sm text-white">上传图片/截图 <span className="text-zinc-500 text-xs">(可选)</span></label>
                    <div className="flex items-center gap-0 bg-zinc-800 border border-zinc-700 rounded px-3 py-2">
                      <input
                        type="text"
                        placeholder="聊天截图、提现失败截图等"
                        readOnly
                        className="flex-1 bg-transparent text-white text-sm placeholder-zinc-600 focus:outline-none"
                      />
                      <button
                        onClick={handleImageUpload}
                        className="flex-shrink-0 px-2 py-0.5 bg-zinc-600 hover:bg-zinc-500 text-zinc-300 text-xs rounded transition-colors"
                      >
                        上传
                      </button>
                    </div>
                    <span className="text-xs text-zinc-500">最多20张，支持 JPG、PNG，单张不超过5MB。可上传模式图、群聊记录、公告截图等</span>
                  </div>

                  {/* Security Warning */}
                  <div className="text-xs text-zinc-400 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>请勿上传或输入钱包私钥、密码等敏感信息。</span>
                  </div>
                </div>
              ) : (
                /* Text Message */
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
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  handleSendMessage()
                }
              }}
              placeholder="输入项目名称或合约地址..."
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
    </div>
  )
}

