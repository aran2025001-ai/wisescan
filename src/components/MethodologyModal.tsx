interface MethodologyModalProps {
  open: boolean
  onClose: () => void
}

export function MethodologyModal({ open, onClose }: MethodologyModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-[hsl(var(--card))] p-6 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[hsl(var(--foreground))]">
            全景扫描方法论
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 text-sm text-[hsl(var(--foreground))] leading-relaxed">
          <section>
            <h3 className="font-semibold mb-2">六维评估体系</h3>
            <p className="text-[hsl(var(--muted-foreground))]">
              明鉴采用六大维度综合评分体系，对加密项目进行全面风险评估：
            </p>
            <table className="w-full mt-3 text-xs border-collapse">
              <thead>
                <tr className="border-b border-[hsl(var(--border))]">
                  <th className="text-left py-2 pr-2 text-[hsl(var(--muted-foreground))] font-medium">维度</th>
                  <th className="text-right py-2 pl-2 text-[hsl(var(--muted-foreground))] font-medium">权重</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]">
                <tr>
                  <td className="py-2 pr-2">代码与技术安全</td>
                  <td className="text-right py-2 pl-2">25%</td>
                </tr>
                <tr>
                  <td className="py-2 pr-2">团队与运营透明度</td>
                  <td className="text-right py-2 pl-2">20%</td>
                </tr>
                <tr>
                  <td className="py-2 pr-2">经济模型与资金安全</td>
                  <td className="text-right py-2 pl-2">20%</td>
                </tr>
                <tr>
                  <td className="py-2 pr-2">社群与市场热度</td>
                  <td className="text-right py-2 pl-2">15%</td>
                </tr>
                <tr>
                  <td className="py-2 pr-2">历史与执行可靠性</td>
                  <td className="text-right py-2 pl-2">10%</td>
                </tr>
                <tr>
                  <td className="py-2 pr-2">合规性与法律风险</td>
                  <td className="text-right py-2 pl-2">10%</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section>
            <h3 className="font-semibold mb-2">风险等级划分</h3>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-[hsl(var(--border))]">
                  <th className="text-left py-2 pr-2 text-[hsl(var(--muted-foreground))] font-medium">分数</th>
                  <th className="text-left py-2 px-2 text-[hsl(var(--muted-foreground))] font-medium">等级</th>
                  <th className="text-left py-2 pl-2 text-[hsl(var(--muted-foreground))] font-medium">建议</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]">
                <tr><td className="py-2 pr-2">90-100</td><td className="py-2 px-2">极低风险</td><td className="py-2 pl-2">✅ 可以参与</td></tr>
                <tr><td className="py-2 pr-2">75-89</td><td className="py-2 px-2">低风险</td><td className="py-2 pl-2">✅ 可以参与</td></tr>
                <tr><td className="py-2 pr-2">60-74</td><td className="py-2 px-2">中等风险</td><td className="py-2 pl-2">⚠️ 谨慎参与</td></tr>
                <tr><td className="py-2 pr-2">40-59</td><td className="py-2 px-2">高风险</td><td className="py-2 pl-2">❌ 不建议参与</td></tr>
                <tr><td className="py-2 pr-2">0-39</td><td className="py-2 px-2">极高风险</td><td className="py-2 pl-2">❌ 严禁参与</td></tr>
              </tbody>
            </table>
          </section>

          <section>
            <h3 className="font-semibold mb-2">数据来源</h3>
            <ul className="list-disc pl-5 text-[hsl(var(--muted-foreground))] space-y-1">
              <li>合约安全：GoPlus Security API</li>
              <li>链上数据：BscScan / Etherscan API</li>
              <li>Rug Pull 检测：RugCheck API</li>
              <li>舆情监测：公开社交媒体与搜索引擎数据</li>
              <li>AI 分析：DeepSeek 语言模型</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold mb-2">免责声明</h3>
            <p className="text-[hsl(var(--muted-foreground))]">
              本报告基于公开信息和第三方数据生成，仅供参考，不构成投资建议。数字资产投资风险极高，请自行核实并承担全部责任。
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
