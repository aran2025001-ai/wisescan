import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

export default function About() {
  const navigate = useNavigate()

  const aboutSections = [
    {
      title: '使命',
      content: '帮助普通投资者规避加密项目风险，用客观数据辅助决策。'
    },
    {
      title: '核心功能',
      content: '项目安全评估（六维评分）、商业模式拆解、全网项目库。'
    },
    {
      title: '数据来源',
      items: [
        '链上数据（BscScan/Etherscan、GoPlus、RugCheck）',
        '项目融资与团队（RootData）',
        '代币市场（CoinGecko）',
        '深度链上分析（Dune Analytics）',
        '公开舆情（Twitter/Telegram/百度/微博）',
        '用户贡献（交叉验证）'
      ]
    },
    {
      title: '评估原则',
      items: [
        '证据先行',
        '结论克制',
        '用户自决'
      ]
    },
    {
      title: '版本',
      content: 'v1.0'
    },
    {
      title: '免责声明',
      content: '本平台所有报告基于公开信息生成，仅供参考，不构成投资建议。用户应自行核实并承担风险。'
    }
  ]

  return (
    <div className="text-white flex flex-col">
      <div className="sticky top-0 z-40 flex items-center justify-between px-4 py-4 border-b border-neutral-800 bg-black/95 backdrop-blur-sm">
        <button
          onClick={() => navigate('/profile')}
          className="flex items-center justify-center w-10 h-10 text-white hover:opacity-70 transition-opacity"
          aria-label="返回"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-semibold flex-1 text-center">关于明鉴</h1>
        <div className="w-10" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-3 pb-4">
          {aboutSections.map((section, index) => (
            <div
              key={index}
              className="bg-neutral-900 rounded-lg p-4 space-y-2"
            >
              <h2 className="text-white font-bold text-sm">{section.title}</h2>
              {section.content && (
                <p className="text-neutral-300 text-xs leading-relaxed">
                  {section.content}
                </p>
              )}
              {section.items && (
                <ul className="space-y-1 pl-4">
                  {section.items.map((item, itemIndex) => (
                    <li
                      key={itemIndex}
                      className="text-neutral-300 text-xs leading-relaxed list-disc"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
