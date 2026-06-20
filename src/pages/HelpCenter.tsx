import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { ChevronLeft, ChevronDown, ChevronUp } from 'lucide-react'
import ScanMethodologyModal from '../components/ScanMethodologyModal'
import DecomposeMethodologyModal from '../components/DecomposeMethodologyModal'

interface FAQItem {
  id: number
  question: string
  answer: string
}

const faqData: FAQItem[] = [
  {
    id: 1,
    question: '如何连接钱包？',
    answer: '点击页面右上角"连接钱包"按钮，选择MetaMask、TP Wallet或WalletConnect，按照提示授权即可。'
  },
  {
    id: 2,
    question: '项目安全评估报告准确吗？',
    answer: '报告基于公开链上数据、舆情信息和用户贡献，通过多维模型自动生成，仅供参考。我们无法保证100%准确，建议用户结合其他信息自行判断。'
  },
  {
    id: 3,
    question: '什么是信息完整性评分？',
    answer: '信息完整性评分是根据项目披露的团队、融资、白皮书、审计报告等公开信息数量计算的百分比。得分越高表示项目信息披露越充分，但不代表项目绝对安全。'
  },
  {
    id: 4,
    question: '如何获得邀请返佣和代金券？',
    answer: '邀请朋友注册并连接钱包，您可以获得2.99 USDT代金券，终身一次。每邀请一人可获得0.5 USDT返佣，需累积5 USDT才可提现。'
  },
  {
    id: 5,
    question: '代金券如何使用？',
    answer: '在支付安全评估或商业模式拆解时，系统会自动使用当前最大面额的可用代金券进行抵扣。代金券存在有效期，请在有效期内使用。'
  }
]

export default function HelpCenter() {
  const navigate = useNavigate()
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [showDecomposeModal, setShowDecomposeModal] = useState(false)

  const toggleFAQ = (id: number) => {
    setExpandedFAQ(expandedFAQ === id ? null : id)
  }

  return (
    <div className="text-white flex flex-col">
      <div className="sticky top-0 z-40 border-b border-[#343438] bg-black backdrop-blur">
        <div className="flex items-center justify-between px-4 py-2">
        <button
          onClick={() => navigate('/profile')}
          className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-zinc-800 transition-colors"
          aria-label="返回"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-sm font-semibold flex-1 text-center">帮助中心</h1>
        <div className="h-8 w-8" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-6 max-w-md mx-auto space-y-6">
          <div className="flex gap-3">
            <button
              onClick={() => setShowReviewModal(true)}
              className="flex-1 px-4 py-2 bg-blue-500 rounded-full text-white text-xs font-bold hover:bg-blue-600 active:bg-blue-700 transition-colors"
              style={{ fontWeight: 700 }}
            >
              我们是怎么审查的？
            </button>
            <button
              onClick={() => setShowDecomposeModal(true)}
              className="flex-1 px-4 py-2 bg-blue-500 rounded-full text-white text-xs font-bold hover:bg-blue-600 active:bg-blue-700 transition-colors"
              style={{ fontWeight: 700 }}
            >
              我们是怎么拆解的？
            </button>
          </div>

          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-zinc-500 mb-3">常见问题</h2>
            {faqData.map((item) => (
              <div key={item.id} className="overflow-hidden rounded-lg">
                <button
                  onClick={() => toggleFAQ(item.id)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-zinc-900 hover:bg-zinc-800 transition-colors"
                >
                  <span className="text-xs font-medium text-white text-left">{item.question}</span>
                  <div className="flex-shrink-0 ml-2">
                    {expandedFAQ === item.id ? (
                      <ChevronUp size={16} className="text-zinc-500" />
                    ) : (
                      <ChevronDown size={16} className="text-zinc-500" />
                    )}
                  </div>
                </button>
                {expandedFAQ === item.id && (
                  <div className="px-4 py-2 bg-zinc-800/50 text-zinc-300 text-xs leading-relaxed">
                    {item.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <ScanMethodologyModal isOpen={showReviewModal} onClose={() => setShowReviewModal(false)} />
      <DecomposeMethodologyModal isOpen={showDecomposeModal} onClose={() => setShowDecomposeModal(false)} />
    </div>
  )
}
