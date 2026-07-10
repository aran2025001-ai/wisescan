import { useState, useRef, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { useAccount } from "wagmi"
import { ChevronLeft, MessageCirclePlus, Mic, Keyboard, Send, AlertCircle, Gift, ChevronRight, Loader2 } from "lucide-react"
import { BusinessReportCard } from "@/components/BusinessReportCard"
import DecomposeMethodologyModal from "@/components/DecomposeMethodologyModal"
import ShareButton from "@/components/ShareButton"
import { renderEvidenceTaggedText } from "@/utils/evidenceTags"
import { TencentAsrClient } from "@/services/tencentAsr"
import PaymentModal from "@/components/PaymentModal"

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


  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = sessionStorage.getItem('wisescan_biz_messages')
      if (saved) {
        const p = JSON.parse(saved)
        if (Array.isArray(p) && p.length) {
          // 恢复 timestamp 为 Date 对象，并确保 content 为字符串
          return p.map(m => ({
            ...m,
            timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
            content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
          }))
        }
      }
    } catch { /* 陈旧数据，忽略 */ }
    return []
  })

  const [inputValue, setInputValue] = useState("")
  const [isVoiceMode, setIsVoiceMode] = useState(false)
  // 语音是否不可用（浏览器限制如 TP 钱包 WebView）
  const voiceDisabled = !(typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia)
  const [isRecording, setIsRecording] = useState(false)
  const asrClientRef = useRef<TencentAsrClient | null>(null)  // 阶段六：腾讯云 ASR 客户端
  const [asrError, setAsrError] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showBackConfirmModal, setShowBackConfirmModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [activeCouponAmount, setActiveCouponAmount] = useState(0)
  const [activeCouponId, setActiveCouponId] = useState<string | undefined>(undefined)
  const [showMethodologyModal, setShowMethodologyModal] = useState(false)
  const [showAlertModal, setShowAlertModal] = useState(false)
  const [alertMsg, setAlertMsg] = useState("")
  const [localInviteCode, setLocalInviteCode] = useState<string>('')
  const [inviteCount, setInviteCount] = useState(0)  // 已成功邀请人数（>0 则隐藏邀请横幅）
  const paidKey = "wisescan_breakdown_unlocked"
  const [isBreakdownPaid, setIsBreakdownPaid] = useState(() => sessionStorage.getItem(paidKey) === "true")  // 付费状态持久化（刷新保留）
  // 阶段五：对话权限状态
  const [chatIsPaid, setChatIsPaid] = useState(isBreakdownPaid)
  const [conversationCount, setConversationCount] = useState(0)
  const [, setRemainingCount] = useState(5)
  const [reportData, setReportData] = useState<any>(() => {
    try {
      const saved = sessionStorage.getItem('wisescan_biz_report')
      if (saved) return JSON.parse(saved)
    } catch { /* 陈旧数据，忽略 */ }
    return null
  })
  const [_isGenerating, setIsGenerating] = useState(false)
  const hasResultsRef = useRef(false)
  const resultsCardIdRef = useRef<string | null>(null)
  // ── 表单数据（切APP时 sessionStorage 兜底）──
  const [formData, setFormData] = useState(() => {
    try {
      const saved = sessionStorage.getItem('wisescan_biz_form')
      if (saved) return JSON.parse(saved)
    } catch {}
    return {
      projectName: "",
      businessRule: "",
      uploadedImages: "",
    }
  })
  // ── 表单数据自动保存到 sessionStorage（切APP不丢失）──
  useEffect(() => {
    try { sessionStorage.setItem('wisescan_biz_form', JSON.stringify(formData)) } catch {}
  }, [formData])
  const [businessImageFiles, setBusinessImageFiles] = useState<File[]>([])
  // 图片的 base64 预览 URL，用于稳定显示缩略图（不受页面重渲染影响）
  const [imagePreviews, setImagePreviews] = useState<string[]>([])

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

  // 每次路由导航到本页时，根据状态定位到不同位置
  useEffect(() => {
    const hasChatHistory = messages.some(m => m.type === 'user')
    const t = setTimeout(() => {
      if (hasChatHistory) {
        // 有聊天记录（切换APP回来/锁屏回来）→ 滚动到底部看最新对话
        messagesEndRef.current?.scrollIntoView({ behavior: 'instant' })
      } else {
        // 新用户/新建话题 → 滚动到表单位置
        const formEl = document.querySelector('[data-message-id="4"]')
        if (formEl) {
          formEl.scrollIntoView({ behavior: 'instant', block: 'start' })
        } else {
          window.scrollTo(0, 0)
        }
      }
    }, 100)
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = 0
    }
    return () => clearTimeout(t)
  }, [location.key])

  // Redirect if wallet disconnected (仅从未在本会话连接过时才跳转)
  useEffect(() => {
    if (isConnected) {
      sessionStorage.setItem('wisescan_wallet_connected', '1')
      return
    }
    const wasConnected = sessionStorage.getItem('wisescan_wallet_connected')
    if (!wasConnected) navigate("/")
  }, [isConnected, navigate])

  // Toast 自动消失
  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(''), 2500); return () => clearTimeout(t) }
  }, [toast])

  // 阶段五：同步对话付费状态
  useEffect(() => { setChatIsPaid(isBreakdownPaid) }, [isBreakdownPaid])

  // 链上支付：页面加载时检查是否已付费（防止 sessionStorage 被清除后重复付）
  useEffect(() => {
    if (!isBreakdownPaid && address) {
      fetch(`/api/check-payment?userAddress=${address}&reportType=business`)
        .then(r => r.json())
        .then(data => {
          if (data.isPaid) {
            sessionStorage.setItem(paidKey, "true")
            setIsBreakdownPaid(true)
          }
        })
        .catch(() => {}) // 静默失败，不影响体验
    }
  }, [address])

  // 获取当前钱包地址的邀请码
  useEffect(() => {
    if (!address) return
    fetch(`/api/get-invite-code?address=${address}`)
      .then(r => r.json())
      .then(data => {
        if (data.code) setLocalInviteCode(data.code)
      })
      .catch((err) => console.error('[BusinessBreakdown] 获取邀请码失败:', err))
  }, [address])

  // 获取邀请次数（>0 则隐藏邀请横幅，终身一次）
  useEffect(() => {
    if (!address) { setInviteCount(0); return }
    fetch(`/api/invite/stats?user_address=${address}`)
      .then(r => r.json())
      .then(j => { if (j.invite_count !== undefined) setInviteCount(j.invite_count || 0) })
      .catch((err) => console.error('[BusinessBreakdown] 获取邀请统计失败:', err))
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

  // 持久化：消息变化时保存到 sessionStorage
  // 过滤掉非字符串 content 的消息（React 元素、对象等），避免下次加载报错
  useEffect(() => {
    if (messages.length > 0) {
      const safe = messages.map(m => ({
        ...m,
        content: typeof m.content === 'string' ? m.content : '',
      }))
      sessionStorage.setItem('wisescan_biz_messages', JSON.stringify(safe))
    }
  }, [messages])

  // 持久化：报告数据变化时保存
  useEffect(() => {
    if (reportData) {
      sessionStorage.setItem('wisescan_biz_report', JSON.stringify(reportData))
    }
  }, [reportData])

  // 新用户引导：逐步推送消息，完成后恢复自动滚动
  useEffect(() => {
    // 如果已有持久化的消息（用户回来继续聊），跳过引导
    if (messages.length > 0) {
      // review the content 是旧数据的恢复，不需要初始化消息
      return
    }

    const onboarded = sessionStorage.getItem('wisescan_breakdown_onboarded') === 'true'
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
          page: 'business',
          // 直接传递报告数据，确保即使 DB 保存失败 AI 也有数据可用
          report_data: reportData || undefined,
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

      // 阶段五：递增 sessionStorage 对话计数
      const chatKey = contractAddr ? `wisescan_chat_${contractAddr}` : 'wisescan_breakdown_chat'
      const newCount = conversationCount + 1
      sessionStorage.setItem(chatKey, String(newCount))
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
    // 当前是语音模式 → 切到文字模式（键盘按钮始终可用）
    if (isVoiceMode) {
      if (asrClientRef.current) {
        asrClientRef.current.stopRecording()
        asrClientRef.current = null
      }
      setIsVoiceMode(false)
      setInputValue("")
      return
    }
    // 当前是文字模式 → 尝试切到语音模式
    if (voiceDisabled) {
      // 语音不可用且已在文字模式 → 无需操作
      return
    }
    setIsVoiceMode(true)
    setInputValue("")
  }

  const handleVoiceStart = (e?: React.TouchEvent | React.MouseEvent | React.PointerEvent) => {
    e?.preventDefault()
    setAsrError(null)
    setIsRecording(true)
    const client = new TencentAsrClient({
      onResult: (_text) => { /* 语音模式下不更新输入框，松手自动发送 */ },
      onError: (err) => { setAsrError(err); console.error('[ASR]', err); },
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

  const handleVoiceEnd = (e?: React.TouchEvent | React.MouseEvent | React.PointerEvent) => {
    e?.preventDefault()
    if (asrClientRef.current) {
      asrClientRef.current.stopRecording()
      asrClientRef.current = null
    }
  }

  const handleImageUpload = () => {
    // Android 多选兼容：动态创建 input 元素
    // accept="image/*" 在手机上触发系统相册（漂亮的网格视图），比具体 MIME 列表更友好
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true       // 先设 multiple 再设 accept，某些浏览器有顺序依赖
    input.accept = 'image/*'
    input.onchange = (e: Event) => {
      const target = e.target as HTMLInputElement
      if (target.files && target.files.length > 0) {
        handleBusinessImageChange(e as unknown as React.ChangeEvent<HTMLInputElement>)
      }
      target.remove()
    }
    input.click()
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
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]
    // 先做基础校验（格式 + 大小）
    let typeError = false
    for (const file of newFiles) {
      if (!validTypes.includes(file.type)) {
        setAlertMsg(`⚠️ 文件格式不支持\n\n${file.name} 格式不支持，仅支持 JPG/PNG/WebP 格式。`)
        setShowAlertModal(true)
        typeError = true
        break
      }
      if (file.size > 5 * 1024 * 1024) {
        setAlertMsg(`⚠️ 文件过大\n\n${file.name} 超过5MB限制，请压缩后重新上传。`)
        setShowAlertModal(true)
        typeError = true
        break
      }
    }
    if (typeError) return

    // 用 base64 前120字符做去重指纹（比 fileName+size+lastModified 更可靠）
    // 同一张图片在不同手机上可能文件名不同，但 base64 内容相同
    const existingFingerprints = new Set(
      imagePreviews.map(p => p.slice(0, 120))
    )
    Promise.all(
      newFiles.map(file => new Promise<{ file: File; b64: string }>((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve({ file, b64: reader.result as string })
        reader.readAsDataURL(file)
      }))
    ).then(results => {
      const duplicateNames: string[] = []
      const uniqueFiles: File[] = []
      const uniquePreviews: string[] = []
      for (const { file, b64 } of results) {
        const fp = b64.slice(0, 120)
        if (existingFingerprints.has(fp)) {
          duplicateNames.push(file.name)
        } else {
          uniqueFiles.push(file)
          uniquePreviews.push(b64)
          existingFingerprints.add(fp)
        }
      }
      if (duplicateNames.length > 0) {
        setAlertMsg(`⚠️ 图片已存在\n\n${duplicateNames.join(", ")} 已存在，已自动跳过。`)
        setShowAlertModal(true)
      }
      if (uniqueFiles.length === 0) return
      const updated = [...businessImageFiles, ...uniqueFiles]
      setBusinessImageFiles(updated)
      setImagePreviews(prev => [...prev, ...uniquePreviews])
      setFormData(prev => ({
        ...prev,
        uploadedImages: updated.map(f => f.name).join(", "),
      }))
    })
    // 重置 input 值以支持重新选择同一文件
    e.target.value = ""
  }

  /** 删除单张已上传图片 */
  const handleRemoveBusinessImage = (index: number) => {
    setBusinessImageFiles(prev => {
      const updated = prev.filter((_, i) => i !== index)
      setFormData(fd => ({
        ...fd,
        uploadedImages: updated.map(f => f.name).join(", "),
      }))
      return updated
    })
    setImagePreviews(prev => prev.filter((_, i) => i !== index))
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

    // 🏷️ 调试模式：跳过支付（VITE_SKIP_PAYMENT=true 时直接生成报告，不弹支付窗）
    if (import.meta.env.VITE_SKIP_PAYMENT === 'true') {
      handlePaymentSuccess()
      return
    }

    // 💰 已付费用户 → 跳过支付，直接免费重试或重新生成
    if (isBreakdownPaid) {
      generateResults()
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
          setActiveCouponAmount(parseFloat(activeCoupons[0].amount) || 0)
          setActiveCouponId(activeCoupons[0].id)
        } else {
          setActiveCouponAmount(0)
          setActiveCouponId(undefined)
        }
      })
      .catch((err) => { console.error('[BusinessBreakdown] 获取优惠券列表失败:', err); setActiveCouponAmount(0); setActiveCouponId(undefined) })
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

      const { data: reportBody, report_id, db_save_failed } = json
      // API 返回结构：{ success: true, data: { pattern_type, share_card, ... }, report_id }
      // 直接展开 data 内容，report_id 作为 id，project_name 从表单或 share_card 取
      setReportData({
        ...reportBody,
        id: report_id,
        project_name: formData.projectName || reportBody.share_card?.project_name || '未命名项目',
      })
      // ✅ 报告成功生成 → 清除付费标记，下次点生成需重新付费
      sessionStorage.removeItem(paidKey)
      setIsBreakdownPaid(false)
      // ✅ 首次拆解完成标记（老用户下次进入直接展示全部内容）
      sessionStorage.setItem('wisescan_breakdown_onboarded', 'true')

      // ⚠️ DB 保存失败 → 不阻塞报告展示，只给提示
      if (db_save_failed) {
        setTimeout(() => {
          setMessages(prev => [...prev, {
            id: (Date.now() + 3).toString(),
            type: "ai",
            content: "⚠️ 提示：报告已成功生成，但保存到数据库时遇到问题（可能是网络波动）。报告内容仍可正常查看和使用，建议截图保存以防丢失。如果需要重新保存，可以再次点击「开始拆解」免费重试。",
            timestamp: new Date(),
          }])
        }, 1200)
      }

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

  const handlePaymentSuccess = () => {
    hasResultsRef.current = true
    sessionStorage.setItem(paidKey, "true")
    setIsBreakdownPaid(true)
    generateResults()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="text-white flex flex-col h-[100dvh]">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-[#343438] bg-black backdrop-blur">
        <div className="flex items-center justify-between px-4 py-2">
        <button 
          onClick={handleBackClick}
          className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-zinc-800 active:bg-zinc-700 active:scale-[0.95] transition-all duration-150 flex-shrink-0"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-sm font-semibold flex-1 text-center">商业模式拆解</h1>
        <button
          onClick={handleNewConversation}
          className="flex items-center justify-center gap-1 hover:bg-zinc-800 active:bg-zinc-700 active:scale-[0.95] rounded-lg transition-all duration-150 flex-shrink-0 px-2 py-1"
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
                    className="min-w-[180px] px-6 py-2.5 bg-blue-500 hover:bg-blue-600 active:bg-blue-400 active:scale-[0.97] text-white rounded-full text-sm font-semibold transition-all duration-150"
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
                    className="min-w-[180px] px-6 py-2.5 bg-blue-500 hover:bg-blue-600 active:bg-blue-400 active:scale-[0.97] text-white rounded-full text-sm font-semibold transition-all duration-150"
                  >
                    {message.content}
                  </button>
                  {message.subtitle && (
                    <span className="text-xs text-zinc-500 px-2 whitespace-pre-wrap">点击后需支付 5.99 USDT 解锁完整拆解报告（含模式解答、收益计算器、动静态策略建议、风险分析等）。{"\n"}一次付费，永久查看。</span>
                  )}
                </div>
              ) : message.isForm ? (
                /* Form Message */
                <div className="w-full bg-zinc-800 rounded-lg p-4 space-y-3">
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
                      className="w-full px-3 py-2 bg-zinc-700 text-white text-sm rounded border border-[#343438] placeholder:text-xs placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                    />
                  </div>

                  {/* Business Rule - textarea without red * */}
                  <div className="space-y-2">
                    <label className="text-sm text-white">项目商业模式规则</label>
                    <textarea
                      placeholder="复制粘贴项目推广规则文本，例如：投资100U起，每日分红1%，直推10%，间推5%，团队业绩达标额外2%"
                      value={formData.businessRule}
                      onChange={(e) => setFormData({ ...formData, businessRule: e.target.value })}
                      className="w-full px-3 py-2 h-20 bg-zinc-700 text-white text-sm rounded border border-[#343438] placeholder:text-xs placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                    />
                  </div>

                  {/* Image Upload — matches RiskAssessment style */}
                  <div className="space-y-1">
                    <label className="text-sm text-white">上传图片/截图</label>
                    <div className="flex items-center gap-0 bg-zinc-700 border border-[#343438] rounded px-3 py-2">
                      <input
                        type="text"
                        placeholder="可上传商业模式宣传海报、规则说明等"
                        value={formData.uploadedImages}
                        readOnly
                        className="flex-1 bg-transparent text-white text-sm placeholder:text-xs placeholder-zinc-500 focus:outline-none"
                      />
                      <button
                        onClick={handleImageUpload}
                        className="flex-shrink-0 px-2 py-0.5 bg-zinc-600 hover:bg-zinc-500 text-zinc-300 text-xs rounded transition-colors"
                      >
                        上传
                      </button>
                    </div>

                    {/* 图片缩略图预览 */}
                    {imagePreviews.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {imagePreviews.map((preview, idx) => (
                          <div key={idx} className="relative">
                            <img
                              src={preview}
                              alt={`图片${idx + 1}`}
                              className="w-16 h-16 object-cover rounded border border-zinc-600 bg-zinc-800"
                            />
                            {/* 删除按钮：默认半透明（兼容手机触摸），hover/点击时全显 */}
                            <button
                              type="button"
                              onClick={() => handleRemoveBusinessImage(idx)}
                              className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px] opacity-60 hover:opacity-100 active:opacity-100 transition-opacity"
                              style={{ lineHeight: 0 }}
                              aria-label="删除图片"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <span className="text-xs text-zinc-500">最多5张，支持 JPG/PNG/WebP/HEIC，单张不超过5MB，可多选</span>
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
                          <div className="w-full px-4 py-2.5 flex items-center gap-3 bg-gradient-to-r from-blue-950/50 to-purple-950/50 hover:bg-zinc-700 active:scale-[0.98] active:brightness-110 transition-all duration-150">
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
                        : typeof message.content === "string"
                          ? message.content
                          : JSON.stringify(message.content)}
                    </div>
                  )}
                </div>
              )}

              {!message.isForm && !message.isScanButton && (
                <span className="text-xs text-zinc-600 px-2">
                  {new Date(message.timestamp).toLocaleTimeString("zh-CN", {
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
        {/* ASR 错误提示（仅在语音模式显示，放在按钮行上方） */}
        {asrError && isVoiceMode && (
          <div className="mb-2 px-3 py-1.5 bg-zinc-800/80 border border-zinc-700 rounded-md text-zinc-300 text-xs text-center">
            ⚠️ {asrError}
          </div>
        )}

        {/* 输入区（始终可用） */}
        <div className="flex items-center gap-2">
          {/* Mode Toggle Button */}
          <button
            onClick={toggleInputMode}
            className={`flex-shrink-0 p-3 rounded-lg transition-all duration-150 ${
              voiceDisabled && !isVoiceMode
                ? 'bg-zinc-800 text-zinc-500 cursor-default'
                : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600 active:bg-zinc-500 active:scale-[0.95]'
            }`}
            title={voiceDisabled && !isVoiceMode ? '当前浏览器不支持语音输入' : (isVoiceMode ? '切换到文字输入' : '切换到语音输入')}
          >
            {voiceDisabled && !isVoiceMode ? (
              <Keyboard className="w-5 h-5" />
            ) : isVoiceMode ? (
              <Keyboard className="w-5 h-5" />
            ) : (
              <Mic className="w-5 h-5" />
            )}
          </button>

          {isVoiceMode ? (
            <button
              onTouchStart={handleVoiceStart}
              onTouchEnd={handleVoiceEnd}
              onMouseDown={handleVoiceStart}
              onMouseUp={handleVoiceEnd}
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
              className="flex-1 px-4 py-3 bg-zinc-700 text-white rounded-lg text-sm placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
            />
          )}

          {/* Send Button (only in text mode) */}
          {!isVoiceMode && (
            <button
              onClick={() => handleSendMessage()}
              disabled={!inputValue.trim()}
              className={`flex-shrink-0 p-3 rounded-lg transition-colors ${
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

        {/* Toast 提示 */}
        {toast && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[999999] px-4 py-2 bg-zinc-800/95 border border-zinc-700 rounded-lg text-zinc-200 text-xs shadow-xl whitespace-nowrap">
            {toast}
          </div>
        )}
      </div>

      {/* Confirm Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[99999]">
          <div className="bg-zinc-900 rounded-lg p-4 w-80 mx-4 space-y-3 border border-[#343438]">
            <h2 className="text-white font-semibold text-sm text-center">新建对话</h2>
            <p className="text-zinc-300 text-xs leading-relaxed">
              将清空当前对话，开始新的拆解。是否继续？
            </p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-3 px-3 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors text-sm"
              >
                取消
              </button>
              <button
                onClick={() => {
                  setShowConfirmModal(false)
                  // 🔒 退出当前话题 → 支付记录归零
                  sessionStorage.removeItem(paidKey)
                  sessionStorage.removeItem('wisescan_biz_messages')
                  sessionStorage.removeItem('wisescan_biz_report')
                  sessionStorage.removeItem('wisescan_biz_count')
                  setIsBreakdownPaid(false)
                  // 清空表单和上传的图片
                  setFormData({ projectName: "", businessRule: "", uploadedImages: "" })
                  sessionStorage.removeItem('wisescan_biz_form')
                  setBusinessImageFiles([])
                  // 清理引导推送定时器（防止重复消息）
                  onboardingTimersRef.current.forEach(clearTimeout)
                  onboardingTimersRef.current = []
                  isOnboardingRef.current = false
                  setMessages(initialMessages())
                  setInputValue("")
                  setIsVoiceMode(false)
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

      {/* 链上 USDT 支付弹窗 */}
      {showPaymentModal && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          reportType="business"
          price={5.99}
          projectId={undefined}
          projectName={formData.projectName || undefined}
          userAddress={address || ''}
          couponAmount={activeCouponAmount > 0 ? activeCouponAmount : undefined}
          couponId={activeCouponId}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}

      {/* Back Confirm Modal */}
      {showBackConfirmModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[99999]">
          <div className="bg-zinc-900 rounded-lg p-4 w-80 mx-4 space-y-3 border border-[#343438]">
            <h2 className="text-white font-semibold text-sm text-center">退出商业模式拆解</h2>
            <p className="text-zinc-300 text-xs leading-relaxed">
              对话记录将在退出后清空。商业模式拆解报告已保存在"我的"历史报告中，可随时查看。
            </p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowBackConfirmModal(false)}
                className="flex-1 py-3 px-3 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors text-sm"
              >
                取消
              </button>
              <button
                onClick={() => {
                  setShowBackConfirmModal(false)
                  // 🔒 退出当前话题 → 支付记录归零
                  sessionStorage.removeItem(paidKey)
                  sessionStorage.removeItem('wisescan_biz_messages')
                  sessionStorage.removeItem('wisescan_biz_report')
                  sessionStorage.removeItem('wisescan_biz_count')
                  setIsBreakdownPaid(false)
                  // 清空表单和上传的图片
                  setFormData({ projectName: "", businessRule: "", uploadedImages: "" })
                  sessionStorage.removeItem('wisescan_biz_form')
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
      {/* 已改用动态创建 input 的方式（handleImageUpload），不再保留隐藏 input */}
    </div>
  )
}
