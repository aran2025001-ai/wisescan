import { useState, useRef, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { useAccount } from "wagmi"
import { ChevronLeft, MessageCirclePlus, Mic, Keyboard, Send, AlertCircle, Gift, ChevronRight, Loader2 } from "lucide-react"
import { BusinessReportCard } from "@/components/BusinessReportCard"
import DecomposeMethodologyModal from "@/components/DecomposeMethodologyModal"
import ShareButton from "@/components/ShareButton"
import { renderEvidenceTaggedText } from "@/utils/evidenceTags"
import { TencentAsrClient } from "@/services/tencentAsr"

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

const initialMessages = (): Message[] => [
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
    id: "ready-prompt",
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
]

export default function BusinessBreakdown() {
  const navigate = useNavigate()
  const { isConnected, address } = useAccount()


  const [messages, setMessages] = useState<Message[]>([])

  const [inputValue, setInputValue] = useState("")
  const [isVoiceMode, setIsVoiceMode] = useState(true)
  const [isRecording, setIsRecording] = useState(false)
  const asrClientRef = useRef<TencentAsrClient | null>(null)  // 阶段六：腾讯云 ASR 客户端
  const [asrError, ] = useState<string | null>(null)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showBackConfirmModal, setShowBackConfirmModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [activeCouponAmount, setActiveCouponAmount] = useState(0)
  const [showMethodologyModal, setShowMethodologyModal] = useState(false)
  const [showAlertModal, setShowAlertModal] = useState(false)
  const [alertMsg, setAlertMsg] = useState("")
  const [localInviteCode, setLocalInviteCode] = useState<string>('')
  const [inviteCount, setInviteCount] = useState(0)  // 已成功邀请人数（>0 则隐藏邀请横幅）
  const paidKey = "wisescan_breakdown_unlocked"
  const [isBreakdownPaid, setIsBreakdownPaid] = useState(() => localStorage.getItem(paidKey) === "true")
  // 阶段五：对话权限状态
  const [chatIsPaid, setChatIsPaid] = useState(isBreakdownPaid)
  const [conversationCount, setConversationCount] = useState(0)
  const [, setRemainingCount] = useState(5)
  const [reportData, setReportData] = useState<any>(null)
  const [_isGenerating, setIsGenerating] = useState(false)
  const hasResultsRef = useRef(false)
  const resultsCardIdRef = useRef<string | null>(null)
  const [formData, setFormData] = useState({
    projectName: "",
    businessRule: "",
    uploadedImages: "",
  })
  const [businessImageFiles, setBusinessImageFiles] = useState<File[]>([])
  const businessFileInputRef = useRef<HTMLInputElement>(null)

  interface ResultsState {
    investmentAmount: number
    directReferrals: number
    indirectReferrals: number
    perPersonAmount: number
  }

  const [, __setResultsState] = useState<ResultsState>({
    investmentAmount: 1000,
    directReferrals: 0,
    indirectReferrals: 0,
    perPersonAmount: 0,
  })
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const isOnboardingRef = useRef(false)  // 引导推送中标记（推送期间不自动滚动）
  const onboardingTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])  // 引导推送定时器（用于清理）
  const location = useLocation()

  // 每次路由导航到本页时，强制滚回顶部
  useEffect(() => {
    window.scrollTo(0, 0)
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = 0
    }
  }, [location.key])

  // Redirect if wallet disconnected
  useEffect(() => {
    if (!isConnected) {
      navigate("/")
    }
  }, [isConnected, navigate])

  // 阶段五：同步对话付费状态
  useEffect(() => { setChatIsPaid(isBreakdownPaid) }, [isBreakdownPaid])

  // 获取当前钱包地址的邀请码
  useEffect(() => {
    if (!address) return
    fetch(`/api/get-invite-code?address=${address}`)
      .then(r => r.json())
      .then(data => {
        if (data.code) setLocalInviteCode(data.code)
      })
      .catch(() => {})
  }, [address])

  // 获取邀请次数（>0 则隐藏邀请横幅，终身一次）
  useEffect(() => {
    if (!address) { setInviteCount(0); return }
    fetch(`/api/invite/stats?user_address=${address}`)
      .then(r => r.json())
      .then(j => { if (j.invite_count !== undefined) setInviteCount(j.invite_count || 0) })
      .catch(() => {})
  }, [address])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const pendingCardScrollRef = useRef(false)

  /** 滚动到聊天容器内指定卡片（标题可见） */
  const scrollToCard = (cardId: string) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = document.querySelector(`[data-message-id="${cardId}"]`)
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" })
        }
      })
    })
  }

  // 新消息时滚到底部，但跳过首次渲染（location.key effect 已经滚到顶部）
  const skipScrollRef = useRef(true)
  useEffect(() => {
    // 引导推送期间不自动滚动（新用户逐步引导时保留阅读位置）
    if (isOnboardingRef.current) return
    if (skipScrollRef.current) {
      skipScrollRef.current = false
      return
    }
    // 卡片滚动由 handler 手动处理，这里跳过避免双次滚动
    if (pendingCardScrollRef.current) {
      pendingCardScrollRef.current = false
      return
    }
    scrollToBottom()
  }, [messages])

  // 新用户引导：逐步推送消息，完成后恢复自动滚动
  useEffect(() => {
    const onboarded = localStorage.getItem('wisescan_breakdown_onboarded') === 'true'
    const all = initialMessages()

    if (onboarded) {
      // 老用户：直接全展示
      setMessages(all)
    } else {
      // 新用户：逐步推送（每条间隔 2 秒）
      isOnboardingRef.current = true
      onboardingTimersRef.current = []
      all.forEach((msg, i) => {
        const timer = setTimeout(() => {
          setMessages(prev => [...prev, msg])
          // 最后一条推送完成后恢复自动滚动
          if (i === all.length - 1) {
            setTimeout(() => { isOnboardingRef.current = false }, 100)
          }
        }, i * 2000)
        onboardingTimersRef.current.push(timer)
      })
    }
  }, [])

  const handleNewConversation = () => {
    setShowConfirmModal(true)
  }

  const handleBackClick = () => {
    setShowBackConfirmModal(true)
  }

  const handleSendMessage = async (voiceText?: string) => {
    const messageText = voiceText?.trim() || inputValue.trim()
    if (!messageText) return

    const userContent = messageText
    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: userContent,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue("")

    // 插入 loading 消息
    const loadingId = (Date.now() + 1).toString()
    setMessages((prev) => [...prev, {
      id: loadingId,
      type: "ai",
      content: "正在分析中...",
      timestamp: new Date(),
    }])

    try {
      const projectName = reportData?.project_name || reportData?.data?.project_name || '未命名项目';
      const contractAddr = reportData?.contract_address || reportData?.data?.contract_address || undefined;
      const chatHistory = messages
        .filter(m => typeof m.content === 'string' && m.content !== "正在分析中...")
        .slice(-10)
        .map(m => ({ type: m.type, content: m.content as string }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_name: projectName,
          contract_address: contractAddr,
          message: userContent,
          chat_history: chatHistory,
          user_address: address || undefined,
          conversation_count: conversationCount,
          is_paid: chatIsPaid,
        }),
      });

      const data = await res.json();

      // 阶段五：处理免费用户达到上限
      if (res.status === 403 && data.error === 'FREE_LIMIT_REACHED') {
        setRemainingCount(0)
        setMessages((prev) => {
          const withoutLoading = prev.filter(m => m.id !== loadingId);
          return [...withoutLoading, {
            id: (Date.now() + 2).toString(),
            type: "ai" as const,
            content: data.reply || "您已达到免费对话上限。解锁全景报告后，可继续深入讨论本项目。",
            timestamp: new Date(),
          }];
        });
        return;
      }

      // 阶段五：更新付费状态和剩余次数
      if (data.is_paid) setChatIsPaid(true)
      if (typeof data.remaining_count === 'number') setRemainingCount(data.remaining_count)

      // 阶段五：递增 localStorage 对话计数
      const chatKey = contractAddr ? `wisescan_chat_${contractAddr}` : 'wisescan_breakdown_chat'
      const newCount = conversationCount + 1
      localStorage.setItem(chatKey, String(newCount))
      setConversationCount(newCount)

      setMessages((prev) => {
        const withoutLoading = prev.filter(m => m.id !== loadingId);
        if (data.success && data.reply) {
          return [...withoutLoading, {
            id: (Date.now() + 2).toString(),
            type: "ai" as const,
            content: data.reply,
            timestamp: new Date(),
          }];
        }
        return [...withoutLoading, {
          id: (Date.now() + 2).toString(),
          type: "ai" as const,
          content: "抱歉，分析服务暂时不可用，请稍后再试。",
          timestamp: new Date(),
        }];
      });
    } catch (err) {
      console.error('[对话] API 调用失败:', err);
      setMessages((prev) => {
        const withoutLoading = prev.filter(m => m.id !== loadingId);
        return [...withoutLoading, {
          id: (Date.now() + 2).toString(),
          type: "ai" as const,
          content: "抱歉，网络连接异常，请检查网络后重试。",
          timestamp: new Date(),
        }];
      });
    }
  }

  const toggleInputMode = () => {
    // 切换输入模式时清理 ASR
    if (isVoiceMode && asrClientRef.current) {
      asrClientRef.current.stopRecording()
      asrClientRef.current = null
    }
    setIsVoiceMode(!isVoiceMode)
    setInputValue("")
  }

  const handleVoiceStart = () => {
    setIsRecording(true)
    const client = new TencentAsrClient({
      onResult: (_text) => { /* 语音模式下不更新输入框，松手自动发送 */ },
      onError: (err) => { console.error('[ASR]', err); },
      onStart: () => setIsRecording(true),
      onEnd: (finalText) => {
        setIsRecording(false)
        asrClientRef.current = null
        if (finalText.trim()) {
          handleSendMessage(finalText)
        }
      },
    })
    asrClientRef.current = client
    client.startRecording()
  }

  const handleVoiceEnd = () => {
    if (asrClientRef.current) {
      asrClientRef.current.stopRecording()
      asrClientRef.current = null
    }
  }

  const handleImageUpload = () => {
    businessFileInputRef.current?.click()
  }

  const handleBusinessImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    const newFiles = Array.from(files)
    const total = businessImageFiles.length + newFiles.length
    if (total > 5) {
      setAlertMsg("⚠️ 上传数量超限\n\n最多支持上传5张图片，请减少后重试。")
      setShowAlertModal(true)
      return
    }
    const validTypes = ["image/jpeg", "image/png"]
    // 重复校验：用 fileName + fileSize 作为唯一标识
    const existingKeys = new Set(businessImageFiles.map(f => `${f.name}_${f.size}`))
    const duplicateNames: string[] = []
    const uniqueNewFiles: File[] = []
    for (const file of newFiles) {
      if (!validTypes.includes(file.type)) {
        setAlertMsg(`⚠️ 文件格式不支持\n\n${file.name} 格式不支持，仅支持 JPG/PNG 格式。`)
        setShowAlertModal(true)
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        setAlertMsg(`⚠️ 文件过大\n\n${file.name} 超过5MB限制，请压缩后重新上传。`)
        setShowAlertModal(true)
        return
      }
      const key = `${file.name}_${file.size}`
      if (existingKeys.has(key)) {
        duplicateNames.push(file.name)
      } else {
        uniqueNewFiles.push(file)
        existingKeys.add(key)
      }
    }
    if (duplicateNames.length > 0) {
      setAlertMsg(`⚠️ 文件已存在\n\n${duplicateNames.join(", ")} 已存在，已自动跳过重复文件。`)
      setShowAlertModal(true)
    }
    if (uniqueNewFiles.length === 0) return
    const updated = [...businessImageFiles, ...uniqueNewFiles]
    setBusinessImageFiles(updated)
    setFormData(prev => ({
      ...prev,
      uploadedImages: updated.map(f => f.name).join(", "),
    }))
    // 重置 input 值以支持重新选择同一文件
    e.target.value = ""
  }

  /** 判断输入是否无效：短且无意义，或纯符号/重复字符 */
  const isInputInvalid = (text: string): boolean => {
    const cleaned = text.replace(/\s/g, "")
    if (cleaned.length === 0) return false // 空不是"无效"，是没输入
    // 纯重复字符（如 aaaa, 1111）
    if (/^(.)\1{2,}$/.test(cleaned)) return true
    // 纯标点/符号
    if (/^[^\w\u4e00-\u9fff]+$/.test(cleaned)) return true
    // 太短且无意义（< 5 个有效字符）
    if (cleaned.length < 5) return true
    return false
  }

  const handleStartBreakdown = () => {
    const hasRule = formData.businessRule.trim().length > 0
    const hasImage = businessImageFiles.length > 0

    // 什么都没输入 → 提醒输入
    if (!hasRule && !hasImage) {
      setAlertMsg("⚠️ 请输入商业模式规则\n\n请先输入项目商业模式规则，或上传相关截图后再开始拆解。")
      setShowAlertModal(true)
      return
    }

    // 输入了但内容无效 → 提醒重新输入
    if (!hasImage && isInputInvalid(formData.businessRule)) {
      setAlertMsg("⚠️ 输入信息无效\n\n请重新输入有效的商业模式规则，或上传相关截图。")
      setShowAlertModal(true)
      return
    }

    // 每次拆解都要付费，弹出支付确认弹窗
    // 同时查代金券
    setShowPaymentModal(true)
    fetch(`/api/coupons/list?user_address=${address}`)
      .then(r => r.json())
      .then(data => {
        const activeCoupons = (data.coupons || []).filter((c: any) => c.status === 'active')
        if (activeCoupons.length > 0) {
          setActiveCouponAmount(parseFloat(activeCoupons[0].amount) || 2.99)
        } else {
          setActiveCouponAmount(0)
        }
      })
      .catch(() => setActiveCouponAmount(0))
  }

  // 统一的生成逻辑（调用真实 API）
  const generateResults = async () => {
    // 先添加 loading 消息（用 content="loading" 作为标记）
    const loadingId = Date.now().toString()
    setMessages(prev => [...prev, {
      id: loadingId,
      type: "ai",
      content: "loading",
      timestamp: new Date(),
    }])

    setIsGenerating(true)

    try {
      // 🖼️ 将上传的图片转为 base64，供 API 端进行 AI 识别
      let userNotesImages: string[] = []
      if (businessImageFiles.length > 0) {
        userNotesImages = await Promise.all(
          businessImageFiles.map(file => {
            return new Promise<string>((resolve, reject) => {
              const reader = new FileReader()
              reader.onload = () => resolve(reader.result as string)
              reader.onerror = () => reject(new Error(`读取图片失败: ${file.name}`))
              reader.readAsDataURL(file)
            })
          })
        )
      }

      const res = await fetch('/api/generate-business-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_address: address || 'anonymous',
          project_name: formData.projectName || '用户自定义',
          rule_text: formData.businessRule,
          ...(userNotesImages.length > 0 && { user_notes_images: userNotesImages }),
        }),
      })

      let json
      try { json = await res.json() }
      catch { throw new Error(`服务器响应异常 (${res.status})`) }

      if (!res.ok || !json.success || !json.data) {
        throw new Error(json?.error || `生成失败 (${res.status})`)
      }

      const { data: reportBody, report_id } = json
      // API 返回结构：{ success: true, data: { pattern_type, share_card, ... }, report_id }
      // 直接展开 data 内容，report_id 作为 id，project_name 从表单或 share_card 取
      setReportData({
        ...reportBody,
        id: report_id,
        project_name: formData.projectName || reportBody.share_card?.project_name || '未命名项目',
      })
      // ✅ 首次拆解完成标记（老用户下次进入直接展示全部内容）
      localStorage.setItem('wisescan_breakdown_onboarded', 'true')

      // 移除 loading 消息，添加报告卡片
      setMessages(prev => {
        const withoutLoading = prev.filter(m => m.id !== loadingId)
        const resultsCardId = (Date.now() + 1).toString()
        resultsCardIdRef.current = resultsCardId
        return [...withoutLoading, {
          id: resultsCardId,
          type: "ai",
          content: "business-report",
          timestamp: new Date(),
        } as any]
      })

      pendingCardScrollRef.current = true
      setTimeout(() => {
        if (resultsCardIdRef.current) scrollToCard(resultsCardIdRef.current)
      }, 100)

      // 追加跟进消息
      setTimeout(() => {
        pendingCardScrollRef.current = true
        setMessages(prev => [...prev, {
          id: (Date.now() + 2).toString(),
          type: "ai",
          content: "如果您对商业模式解读或其他内容仍有疑问，可以在下方输入框用文字或语音进一步咨询，我会为您进行解答。",
          timestamp: new Date(),
        }])
      }, 800)

    } catch (err: any) {
      console.error("生成商业模式报告失败:", err)
      setMessages(prev => {
        const withoutLoading = prev.filter(m => m.id !== loadingId)
        return [...withoutLoading, {
          id: (Date.now()).toString(),
          type: "ai",
          content: `⚠️ 生成报告失败：${err.message || "未知错误"}。请稍后重试。`,
          timestamp: new Date(),
        }]
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleConfirmPayment = async () => {
    setShowPaymentModal(false)

    // 消耗代金券（如果有的话）
    try {
      const coupRes = await fetch('/api/coupons/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_address: address }),
      })
      const coupData = await coupRes.json()
      if (coupData.success && coupData.used > 0) {
        console.log(`💳 商业模式拆解消耗代金券 ${coupData.amount} USDT (${coupData.used} 张)`)
      }
    } catch { /* 代金券消耗失败不影响报告生成 */ }

    hasResultsRef.current = true
    localStorage.setItem(paidKey, "true")
    setIsBreakdownPaid(true)
    generateResults()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="text-white flex flex-col h-screen">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-[#343438] bg-black backdrop-blur">
        <div className="flex items-center justify-between px-4 py-2">
        <button 
          onClick={handleBackClick}
          className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-zinc-800 transition-colors flex-shrink-0"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-sm font-semibold flex-1 text-center">商业模式拆解</h1>
        <button
          onClick={handleNewConversation}
          className="flex items-center justify-center gap-1 hover:bg-zinc-800 rounded-lg transition-colors flex-shrink-0 px-2 py-1"
          title="开始新对话"
        >
          <MessageCirclePlus className="w-5 h-5" />
          <span className="text-xs">新对话</span>
        </button>
        </div>
      </div>

      {/* Messages Container */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={message.id}
            data-message-id={message.id}
            style={{ scrollMarginTop: 64, animationDelay: `${index * 80}ms` }}
            className={`flex gap-2 animate-fade-in-up ${message.type === "user" ? "flex-row-reverse" : ""}`}
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
              {message.type === "ai" && !message.isButton && !message.isScanButton && !message.isResults && (
                <span className="text-xs text-zinc-500 px-2">明鉴·首席分析师</span>
              )}

              {/* Button Message */}
              {message.isButton ? (
                <div className="flex flex-col gap-2 items-start">
                  <button 
                    onClick={() => setShowMethodologyModal(true)}
                    className="min-w-[180px] px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-full text-sm font-semibold transition-colors"
                  >
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
                    className="min-w-[180px] px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-full text-sm font-semibold transition-colors"
                  >
                    {message.content}
                  </button>
                  {message.subtitle && (
                    <span className="text-xs text-zinc-500 px-2 whitespace-pre-wrap">点击后需支付 5.99 USDT 解锁完整拆解报告（含模式解答、收益计算器、动静态策略建议、风险分析等）。{"\n"}一次付费，永久查看。</span>
                  )}
                </div>
              ) : message.isForm ? (
                /* Form Message */
                <div className="w-full bg-zinc-900 rounded-lg p-4 space-y-3">
                  {/* Instructions */}
                  <div className="pb-1">
                    <span className="text-xs text-zinc-400 leading-snug">请尽可能完整地提供以下信息。您给得越详细，拆解和算账就越精准。</span>
                  </div>

                  {/* Project Name */}
                  <div className="space-y-1 -mt-1">
                    <label className="text-sm text-white">项目名称</label>
                    <input
                      type="text"
                      placeholder="输入项目名称"
                      value={formData.projectName}
                      onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
                      className="w-full px-3 py-2 bg-zinc-800 text-white text-sm rounded border border-[#343438] placeholder:text-xs placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                    />
                  </div>

                  {/* Business Rule - textarea without red * */}
                  <div className="space-y-2">
                    <label className="text-sm text-white">项目商业模式规则</label>
                    <textarea
                      placeholder="复制粘贴项目推广规则文本，例如：投资100U起，每日分红1%，直推10%，间推5%，团队业绩达标额外2%"
                      value={formData.businessRule}
                      onChange={(e) => setFormData({ ...formData, businessRule: e.target.value })}
                      className="w-full px-3 py-2 h-20 bg-zinc-800 text-white text-sm rounded border border-[#343438] placeholder:text-xs placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                    />
                  </div>

                  {/* Image Upload — matches RiskAssessment style */}
                  <div className="space-y-1">
                    <label className="text-sm text-white">上传图片/截图</label>
                    <div className="flex items-center gap-0 bg-zinc-800 border border-[#343438] rounded px-3 py-2">
                      <input
                        type="text"
                        placeholder="可上传商业模式宣传海报、规则说明等"
                        value={formData.uploadedImages}
                        readOnly
                        className="flex-1 bg-transparent text-white text-sm placeholder:text-xs placeholder-zinc-600 focus:outline-none"
                      />
                      <button
                        onClick={handleImageUpload}
                        className="flex-shrink-0 px-2 py-0.5 bg-zinc-600 hover:bg-zinc-500 text-zinc-300 text-xs rounded transition-colors"
                      >
                        上传
                      </button>
                    </div>
                    <span className="text-xs text-zinc-500">最多5张，支持 JPG、PNG，单张不超过5MB</span>
                  </div>

                  {/* Security Warning */}
                  <div className="text-xs text-zinc-400 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>请勿上传或输入钱包私钥、密码等敏感信息。</span>
                  </div>
                </div>
              ) : message.content === "loading" ? (
                <div className="flex items-center gap-2 text-zinc-400 text-sm py-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>正在生成拆解报告，请稍候（约 10~30 秒）...</span>
                </div>
              ) : message.isResults || message.content === "business-report" ? (
                /* Business Report Card */
                <BusinessReportCard reportData={reportData} onAssessRisk={() => navigate("/assess")} />
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
                      <div className="h-px bg-zinc-600"></div>
                      
                      {/* Invite Banner inside the card —— 终身一次，inviteCount>0 则隐藏 */}
                      {inviteCount === 0 && (
                      <ShareButton
                        inviteCode={localInviteCode}
                        trigger={
                          <div className="w-full px-4 py-2.5 flex items-center gap-3 bg-gradient-to-r from-blue-950/50 to-purple-950/50 hover:bg-zinc-700 transition-colors">
                            <Gift className="w-5 h-5 flex-shrink-0 text-blue-400" />
                            <div className="flex-1">
                              <div className="text-sm text-zinc-200">邀请一位朋友，立得 2.99U 代金券</div>
                              <div className="text-xs text-zinc-500">可抵扣本次支付</div>
                            </div>
                            <ChevronRight className="w-5 h-5 flex-shrink-0 text-zinc-500" />
                          </div>
                        }
                      />
                      )}
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
                      {message.type === "ai" && typeof message.content === "string"
                        ? renderEvidenceTaggedText(message.content, "text-sm leading-relaxed")
                        : message.content}
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
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-[#343438] bg-black p-4">
        {/* 输入区（始终可用） */}
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

          {isVoiceMode ? (
            <button
              onPointerDown={handleVoiceStart}
              onPointerUp={handleVoiceEnd}
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
              onClick={() => handleSendMessage()}
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

        {/* ASR 错误提示 */}
        {asrError && (
          <div className="mx-4 mt-2 p-2 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-xs text-center">
            ⚠️ {asrError}
          </div>
        )}
      </div>

      {/* Confirm Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-zinc-900 rounded-lg p-4 w-80 mx-4 space-y-3 border border-[#343438]">
            <h2 className="text-white font-semibold text-sm text-center">新建对话</h2>
            <p className="text-zinc-300 text-xs leading-relaxed">
              将清空当前对话，开始新的拆解。是否继续？
            </p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-1.5 px-3 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors text-xs"
              >
                取消
              </button>
              <button
                onClick={() => {
                  setShowConfirmModal(false)
                  // 🔒 退出当前话题 → 支付记录归零
                  localStorage.removeItem(paidKey)
                  setIsBreakdownPaid(false)
                  // 清空表单和上传的图片
                  setFormData({ projectName: "", businessRule: "", uploadedImages: "" })
                  setBusinessImageFiles([])
                  // 清理引导推送定时器（防止重复消息）
                  onboardingTimersRef.current.forEach(clearTimeout)
                  onboardingTimersRef.current = []
                  isOnboardingRef.current = false
                  setMessages(initialMessages())
                  setInputValue("")
                  setIsVoiceMode(true)
                  setIsRecording(false)
                  if (asrClientRef.current) { asrClientRef.current.stopRecording(); asrClientRef.current = null }
                  hasResultsRef.current = false
                  resultsCardIdRef.current = null
                  setBusinessImageFiles([])
                  skipScrollRef.current = true
                  setTimeout(() => {
                    const el = document.querySelector('[data-message-id="ready-prompt"]')
                    if (el) {
                      el.scrollIntoView({ behavior: "smooth", block: "start" })
                    }
                  }, 150)
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
          <div className="bg-zinc-900 rounded-lg p-4 w-80 mx-4 space-y-3 border border-[#343438]">
            <h2 className="text-white font-semibold text-sm text-center">开始拆解</h2>
            <p className="text-zinc-300 text-xs leading-relaxed">
              将为您生成商业模式拆解报告，需支付 5.99 USDT（当前仅支持BSC链（BEP20）支付）。是否继续？
            </p>
            {activeCouponAmount > 0 && (
              <div className="bg-zinc-800/70 rounded-lg p-2.5 border border-blue-500/20">
                <p className="text-blue-400 text-xs font-medium">🎟️ 检测到代金券</p>
                <p className="text-zinc-400 text-[11px] mt-1">
                  您有 <span className="text-blue-400 font-semibold">{activeCouponAmount} USDT</span> 代金券，
                  可抵扣部分费用（原价 <span className="text-zinc-300">5.99 USDT</span>）。
                </p>
                <p className="text-zinc-500 text-[10px] mt-1">
                  确认后将自动使用代金券，仍需支付 {Math.max(0, 5.99 - activeCouponAmount).toFixed(2)} USDT
                </p>
              </div>
            )}
            <div className="flex gap-3 pt-1">
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
          <div className="bg-zinc-900 rounded-lg p-4 w-80 mx-4 space-y-3 border border-[#343438]">
            <h2 className="text-white font-semibold text-sm text-center">退出商业模式拆解</h2>
            <p className="text-zinc-300 text-xs leading-relaxed">
              对话记录将在退出后清空。商业模式拆解报告已保存在"我的"历史报告中，可随时查看。
            </p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowBackConfirmModal(false)}
                className="flex-1 py-1.5 px-3 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors text-xs"
              >
                取消
              </button>
              <button
                onClick={() => {
                  setShowBackConfirmModal(false)
                  // 🔒 退出当前话题 → 支付记录归零
                  localStorage.removeItem(paidKey)
                  setIsBreakdownPaid(false)
                  // 清空表单和上传的图片
                  setFormData({ projectName: "", businessRule: "", uploadedImages: "" })
                  setBusinessImageFiles([])
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

      {/* Methodology Modal */}
      <DecomposeMethodologyModal isOpen={showMethodologyModal} onClose={() => setShowMethodologyModal(false)} />

      {/* 输入校验提示弹窗（标准样式） */}
      {showAlertModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowAlertModal(false)}>
          <div className="bg-zinc-900 rounded-lg p-4 w-80 mx-4 space-y-3 border border-[#343438]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-center text-amber-400">
              <AlertCircle className="w-8 h-8" />
            </div>
            {(() => {
              const parts = alertMsg.split('\n\n')
              const title = parts[0] || ''
              const body = parts.slice(1).join('\n\n') || ''
              return (
                <>
                  <p className="text-zinc-200 text-sm font-bold text-center leading-relaxed whitespace-pre-wrap">{title}</p>
                  {body && <p className="text-zinc-400 text-xs text-left leading-relaxed whitespace-pre-wrap">{body}</p>}
                </>
              )
            })()}
            <button
              onClick={() => setShowAlertModal(false)}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-xs font-medium"
            >
              知道了
            </button>
          </div>
        </div>
      )}

      {/* Hidden file input for business rule image upload */}
      <input
        ref={businessFileInputRef}
        type="file"
        accept="image/jpeg,image/png"
        multiple
        className="hidden"
        onChange={handleBusinessImageChange}
      />
    </div>
  )
}
