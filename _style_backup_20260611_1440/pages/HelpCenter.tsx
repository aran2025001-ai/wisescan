import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { ChevronLeft, ChevronDown, ChevronUp, X } from 'lucide-react'

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
    answer: '邀请朋友注册并连接钱包，双方各得2.99 USDT代金券（终身一次）。邀请返佣为0.5 USDT/人，需累积5 USDT才可提现。'
  },
  {
    id: 5,
    question: '代金券如何使用？',
    answer: '在支付安全评估或商业模式拆解时，系统会自动抵扣可用代金券。代金券有有效期，请在有效期内使用。'
  }
]

const dataSources = [
  { name: 'GoPlus Security', desc: '检测合约漏洞、蜜罐风险、授权异常' },
  { name: 'RugCheck', desc: '识别 Rug Pull 风险、代币经济模型基础问题' },
  { name: 'RootData', desc: '查询融资记录、投资机构、团队背景、代币解锁信息' },
  { name: 'CoinGecko', desc: '获取代币价格、市值、交易量、流动性池、官网及社媒链接' },
  { name: 'Dune Analytics', desc: '自定义追踪用户行为、跨链活动、鲸鱼钱包动向' },
  { name: 'Messari', desc: '参考项目研究报告、市场情绪指标、行业新闻' },
  { name: 'Coinhawk', desc: '聚合链上+链下数据输出风险评分参考' },
  { name: 'Twitter/Telegram/百度/微博', desc: '舆情关键词与情感分析' },
  { name: '用户贡献', desc: '经三重交叉验证的截图与聊天记录' },
]

const dimensionTable = [
  { dimension: '代码与技术安全', weight: '25%', points: '合约审计、漏洞检测、权限控制、历史变更' },
  { dimension: '团队与运营透明度', weight: '20%', points: '团队实名、融资披露、信息完整性' },
  { dimension: '经济模型与资金安全', weight: '20%', points: '代币分配、LP锁仓、资金外流' },
  { dimension: '社群与市场热度', weight: '15%', points: '社群真实性、舆情分析、开发活跃度' },
  { dimension: '历史与执行可靠性', weight: '10%', points: '模式变更次数、出金异常' },
  { dimension: '合规性与法律风险', weight: '10%', points: '法律实体、牌照、KYC/AML' },
]

const riskLevelTable = [
  { score: '90-100', level: '极低风险', conclusion: '可以参与' },
  { score: '75-89', level: '低风险', conclusion: '可以参与' },
  { score: '60-74', level: '中等风险', conclusion: '谨慎参与' },
  { score: '40-59', level: '高风险', conclusion: '不建议参与' },
  { score: '0-39', level: '极高风险', conclusion: '严禁参与' },
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
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="sticky top-0 z-40 flex items-center justify-between px-4 py-4 border-b border-neutral-800 bg-black/95 backdrop-blur-sm">
        <button
          onClick={() => navigate('/profile')}
          className="flex items-center justify-center w-10 h-10 text-white hover:opacity-70 transition-opacity"
          aria-label="返回"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-sm font-semibold flex-1 text-center">帮助中心</h1>
        <div className="w-10" />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-6 max-w-md mx-auto space-y-6">
          <div className="flex gap-3">
            <button
              onClick={() => setShowReviewModal(true)}
              className="flex-1 flex items-center gap-2 px-4 py-2 bg-blue-500 rounded-full text-white text-xs font-medium hover:bg-blue-600 active:bg-blue-700 transition-colors"
            >
              <span>📖</span>
              <span>我们是怎么审查的？</span>
            </button>
            <button
              onClick={() => setShowDecomposeModal(true)}
              className="flex-1 flex items-center gap-2 px-4 py-2 bg-blue-500 rounded-full text-white text-xs font-medium hover:bg-blue-600 active:bg-blue-700 transition-colors"
            >
              <span>📖</span>
              <span>我们是怎么拆解的？</span>
            </button>
          </div>

          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-neutral-500 mb-3">常见问题</h2>
            {faqData.map((item) => (
              <div key={item.id} className="overflow-hidden rounded-lg">
                <button
                  onClick={() => toggleFAQ(item.id)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-neutral-900 hover:bg-neutral-800 transition-colors"
                >
                  <span className="text-xs font-medium text-white text-left">{item.question}</span>
                  <div className="flex-shrink-0 ml-2">
                    {expandedFAQ === item.id ? (
                      <ChevronUp size={16} className="text-neutral-500" />
                    ) : (
                      <ChevronDown size={16} className="text-neutral-500" />
                    )}
                  </div>
                </button>
                {expandedFAQ === item.id && (
                  <div className="px-4 py-2 bg-neutral-800/50 text-neutral-300 text-xs leading-relaxed">
                    {item.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 我们是怎么审查的？模态框 */}
      {showReviewModal && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-40 z-40"
            onClick={() => setShowReviewModal(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div
              className="bg-neutral-900 rounded-lg w-full max-w-md max-h-4/5 overflow-hidden pointer-events-auto flex flex-col border border-neutral-800"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 flex-shrink-0">
                <h2 className="text-white text-sm font-semibold flex-1 text-center">全景扫描方法论</h2>
                <button
                  onClick={() => setShowReviewModal(false)}
                  className="p-1 hover:bg-neutral-800 rounded transition-colors text-neutral-500 hover:text-white flex-shrink-0 ml-2"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="overflow-y-auto flex-1 px-4 py-3 space-y-3">
                <div className="space-y-1">
                  <h3 className="text-white font-semibold text-xs">🔍 1. 数据来源与用途</h3>
                  <p className="text-neutral-400 text-xs">明鉴综合以下多个权威渠道，交叉验证，确保评估客观性。</p>
                  <div className="space-y-1 bg-neutral-800 bg-opacity-50 rounded p-2">
                    {dataSources.map((source, idx) => (
                      <div key={idx} className="text-xs">
                        <p className="text-neutral-200 font-medium text-xs">{source.name}</p>
                        <p className="text-neutral-500 text-xs ml-1">{source.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <h3 className="text-white font-semibold text-xs">📊 2. 评估维度与权重</h3>
                  <div className="space-y-1 text-xs">
                    {dimensionTable.map((row, idx) => (
                      <div key={idx} className="flex items-start gap-2 p-2 bg-neutral-800 bg-opacity-30 rounded">
                        <div className="flex-1">
                          <p className="text-neutral-200 font-medium text-xs">{row.dimension}</p>
                          <p className="text-neutral-500 text-xs">{row.points}</p>
                        </div>
                        <div className="text-blue-400 font-semibold flex-shrink-0 text-xs">{row.weight}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <h3 className="text-white font-semibold text-xs">⚠️ 3. 风险等级标准</h3>
                  <div className="space-y-1 text-xs">
                    {riskLevelTable.map((row, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 bg-neutral-800 bg-opacity-30 rounded">
                        <div className="flex-1">
                          <p className="text-neutral-200 font-medium text-xs">{row.level}</p>
                          <p className="text-neutral-500 text-xs">评分：{row.score}</p>
                        </div>
                        <div className="text-neutral-400 text-xs flex-shrink-0">{row.conclusion}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <h3 className="text-white font-semibold text-xs">🔄 4. 动态更新机制</h3>
                  <ul className="text-neutral-400 text-xs space-y-1 ml-3 list-disc">
                    <li>报告基于评估时的公开数据生成，项目状态可能变化</li>
                    <li>用户可支付 1 USDT 刷新报告，获取最新分析</li>
                    <li>历史报告保存在"我的"页面，支持对比查看</li>
                  </ul>
                </div>
                <div className="space-y-1 border-t border-neutral-800 pt-2">
                  <h3 className="text-white font-semibold text-xs">⚖️ 5. 免责声明</h3>
                  <p className="text-neutral-400 text-xs leading-relaxed">
                    本工具所有报告均基于公开API、链上数据及用户贡献信息自动生成。明鉴不对信息的绝对准确性、完整性或时效性作任何保证。用户应自行核实并承担投资风险。平台不提供任何投资建议。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 我们是怎么拆解的？模态框 */}
      {showDecomposeModal && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-40 z-40"
            onClick={() => setShowDecomposeModal(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div
              className="bg-neutral-900 rounded-lg w-full max-w-md max-h-4/5 overflow-hidden pointer-events-auto flex flex-col border border-neutral-800"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 flex-shrink-0">
                <h2 className="text-white text-sm font-semibold flex-1 text-center">商业模式拆解方法论</h2>
                <button
                  onClick={() => setShowDecomposeModal(false)}
                  className="p-1 hover:bg-neutral-800 rounded transition-colors text-neutral-500 hover:text-white flex-shrink-0 ml-2"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="overflow-y-auto flex-1 px-4 py-3 space-y-3">
                <div className="space-y-1">
                  <h3 className="text-white font-semibold text-xs">📌 什么是商业模式拆解？</h3>
                  <p className="text-neutral-400 text-xs leading-relaxed">
                    通过系统分析项目的收入结构、资金流向、激励机制、可持续性和风险点，用计算器、图表和文字三维呈现模式收益模型，帮助用户理解真实盈利逻辑。
                  </p>
                </div>
                <div className="space-y-1">
                  <h3 className="text-white font-semibold text-xs">🔍 拆解步骤</h3>
                  <div className="space-y-1 text-xs">
                    <div className="p-2 bg-neutral-800 bg-opacity-30 rounded">
                      <p className="text-neutral-200 font-medium text-xs">1. 模式识别</p>
                      <p className="text-neutral-500 text-xs">分类项目属于传销、级差返佣、挖矿、质押、DAO等类型</p>
                    </div>
                    <div className="p-2 bg-neutral-800 bg-opacity-30 rounded">
                      <p className="text-neutral-200 font-medium text-xs">2. 收益计算</p>
                      <p className="text-neutral-500 text-xs">根据直推、间推、代币价格等变量建立动态计算模型</p>
                    </div>
                    <div className="p-2 bg-neutral-800 bg-opacity-30 rounded">
                      <p className="text-neutral-200 font-medium text-xs">3. 风险评估</p>
                      <p className="text-neutral-500 text-xs">识别资金依赖、流动性风险、法律风险等关键问题</p>
                    </div>
                    <div className="p-2 bg-neutral-800 bg-opacity-30 rounded">
                      <p className="text-neutral-200 font-medium text-xs">4. 可持续性分析</p>
                      <p className="text-neutral-500 text-xs">预测模式在不同市场条件下的存活周期</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <h3 className="text-white font-semibold text-xs">🧮 计算器说明</h3>
                  <div className="space-y-1 text-xs text-neutral-400">
                    <p>• 静态收益计算器：基于固定参数（投资额、直推人数等）预算收益</p>
                    <p>• 动态计算器：考虑代币价格波动、推荐链深度、时间衰减等因素</p>
                    <p>• 所有数据仅供参考，实际收益可能与计算不符</p>
                  </div>
                </div>
                <div className="space-y-1 border-t border-neutral-800 pt-2">
                  <h3 className="text-white font-semibold text-xs">⚖️ 免责声明</h3>
                  <p className="text-neutral-400 text-xs leading-relaxed">
                    商业模式拆解基于项目公开信息和用户输入自动生成，不代表我们对项目的投资建议或背书。用户应自行判断模式合法性和可持续性，风险自担。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
