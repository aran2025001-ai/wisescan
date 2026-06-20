import { X } from 'lucide-react'

interface DecomposeMethodologyModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function DecomposeMethodologyModal({ isOpen, onClose }: DecomposeMethodologyModalProps) {
  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-zinc-900 rounded-lg w-full max-h-[75vh] max-w-[350px] overflow-hidden pointer-events-auto flex flex-col border border-[#343438]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-[#343438] flex-shrink-0">
            <h2 className="text-white text-base font-semibold flex-1 text-center">商业模式拆解方法论</h2>
            <button onClick={onClose} className="p-1 hover:bg-zinc-700 rounded transition-colors text-zinc-400 hover:text-white flex-shrink-0 ml-2">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="overflow-y-auto flex-1 px-4 py-4">
            <div className="space-y-4 text-xs text-zinc-400 leading-relaxed">
              {/* 一、解析过程 */}
              <div className="space-y-2">
                <h3 className="text-white font-semibold text-sm">一、解析过程</h3>
                <p>我们使用明鉴AI智能系统将您输入的规则文本或图片，自动提取为结构化参数，包括：</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>投资门槛（最低投资额）</li>
                  <li>静态收益率（日/周/月）</li>
                  <li>返佣层级（直推、间推、团队级差）</li>
                  <li>锁仓周期</li>
                  <li>其他特殊条件（如业绩考核、对碰奖等）</li>
                </ul>
                <p>所有提取的参数会以 JSON 格式输出，确保后续计算的准确性。</p>
              </div>

              {/* 二、计算逻辑 */}
              <div className="space-y-2">
                <h3 className="text-white font-semibold text-sm">二、计算逻辑</h3>
                <p>基于预置的数学模型模板（覆盖 90% 常见模式），包括：</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>级差返佣（直推、间推比例递减）</li>
                  <li>矩阵制（固定层数、固定人数）</li>
                  <li>对碰奖（左右两区业绩取小）</li>
                  <li>静态分红（固定日化收益）</li>
                  <li>团队级差（按总业绩划分等级）</li>
                </ul>
                <p>前端使用 JavaScript 精确计算：</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>静态收益：投资额 × 日化率 × 天数</li>
                  <li>动态收益：直推奖 + 间推奖 + 团队奖</li>
                  <li>回本周期：投资额 / 日收益</li>
                </ul>
                <p>所有计算不依赖 AI 推理，确保数字准确无误。</p>
              </div>

              {/* 三、策略生成 */}
              <div className="space-y-2">
                <h3 className="text-white font-semibold text-sm">三、策略生成</h3>
                <p>根据您的投资预算和推广能力，明鉴AI智能系统会推荐利益最大化方案：</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>账户拆分建议（例如"分 3 个账户，每个投资 1000U，形成 A 推 B、B 推 C 的层级"）</li>
                  <li>点位布局图（树形图展示上下级关系）</li>
                  <li>收益模拟（基于您填写的推广人数，预估总收益）</li>
                </ul>
                <p>策略基于数学优化算法，并附上"仅供参考"提示。</p>
              </div>

              {/* 四、风险识别 */}
              <div className="space-y-2">
                <h3 className="text-white font-semibold text-sm">四、风险识别</h3>
                <p>自动检测以下高风险特征：</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>静态收益承诺 + 多级返佣（≥2 级） → 标记为 <span className="text-red-400">庞氏骗局潜在风险</span></li>
                  <li>锁仓机制不透明 → 提示"资金可能无法随时取出"</li>
                  <li>提现门槛突然提高或频繁维护 → 警示"出金障碍信号"</li>
                </ul>
                <p>同时提供资金依赖程度评估（高/中/低），以及风险自查清单（提现变慢、抱怨增多等）。</p>
              </div>

              {/* 五、数据更新说明 */}
              <div className="space-y-2">
                <h3 className="text-white font-semibold text-sm">五、数据更新说明</h3>
                <ul className="list-disc pl-4 space-y-1">
                  <li>报告基于当前规则生成，项目方可能随时修改条款。</li>
                  <li>市场动态变化，静态分析仅供参考。</li>
                  <li>建议用户定期重新拆解（付费刷新）或关注社群舆情。</li>
                </ul>
              </div>

              {/* 六、免责声明 */}
              <div className="space-y-2">
                <h3 className="text-white font-semibold text-sm">六、免责声明</h3>
                <ul className="list-disc pl-4 space-y-1">
                  <li>本工具所有拆解结果基于公开规则和数学模型，不构成投资建议。</li>
                  <li>用户应自行核实并承担风险。</li>
                </ul>
              </div>
            </div>
            <div className="h-2" />
          </div>
        </div>
      </div>
    </>
  )
}
