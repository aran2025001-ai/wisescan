export default function RadarChart({
  labels,
  scores,
  actualScores,
  gridLevels,
}: {
  labels?: string[]
  scores?: number[]   // 0-1 normalized (eg. 0.72 for 18/25)
  actualScores?: string[]  // display text (eg. "18/25")
  gridLevels?: number[]
}) {
  const _labels = labels || ["代码安全", "团队透明度", "经济模型", "社群热度", "历史可靠性", "合规性"]
  const _scores = scores || [1.0, 0.4, 0.6, 0.67, 0.4, 0.5]
  const _actualScores = actualScores || ["25/25", "8/20", "12/20", "10/15", "4/10", "5/10"]
  const _gridLevels = gridLevels || [0.2, 0.4, 0.6, 0.8, 1.0]
  const n = _labels.length

  // 更大的画布和雷达区域，支持换行标签
  const vbW = 440, vbH = 430
  const cx = 220, cy = 215, r = 112

  const getPoint = (index: number, level: number) => {
    const angle = (Math.PI * 2 * index) / n - Math.PI / 2
    return { x: cx + r * level * Math.cos(angle), y: cy + r * level * Math.sin(angle) }
  }

  const dataPoints = _scores.map((s, i) => getPoint(i, s))

  const getLabelPos = (index: number) => {
    const angle = (Math.PI * 2 * index) / n - Math.PI / 2
    // 标签距圆心距离 = r + 40，给多行文字足够空间
    const labelR = r + 40
    return { x: cx + labelR * Math.cos(angle), y: cy + labelR * Math.sin(angle) }
  }

  // 智能换行：长度≥7的标签自动拆两行
  const splitLabel = (label: string): string[] => {
    if (label.length < 7) return [label]
    // 优先在"与"字处断开（如"代码与技术安全"→"代码与"+"技术安全"）
    const yuIdx = label.indexOf('与')
    if (yuIdx > 0 && yuIdx <= 5 && label.length <= 8) {
      return [label.substring(0, yuIdx + 1), label.substring(yuIdx + 1)]
    }
    // 否则在长度中点断开
    const mid = Math.ceil(label.length / 2)
    return [label.substring(0, mid), label.substring(mid)]
  }

  return (
    <svg viewBox={`0 0 ${vbW} ${vbH}`} className="w-full max-w-[340px] h-auto mx-auto block">
      {/* Grid polygons */}
      {_gridLevels.map((level, i) => (
        <polygon
          key={`grid-${i}`}
          points={Array.from({ length: n }, (_, j) => { const p = getPoint(j, level); return `${p.x},${p.y}` }).join(" ")}
          fill="none"
          stroke={i === _gridLevels.length - 1 ? "#52525b" : "#3f3f46"}
          strokeWidth="0.5"
        />
      ))}

      {/* Axis lines */}
      {Array.from({ length: n }, (_, i) => {
        const p = getPoint(i, 1.0)
        return <line key={`axis-${i}`} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#3f3f46" strokeWidth="0.5" />
      })}

      {/* Data polygon */}
      <polygon
        points={dataPoints.map(p => `${p.x},${p.y}`).join(" ")}
        fill="rgba(59, 130, 246, 0.15)"
        stroke="#3b82f6"
        strokeWidth="1.5"
      />

      {/* Data dots */}
      {dataPoints.map((p, i) => (
        <circle key={`dot-${i}`} cx={p.x} cy={p.y} r="3" fill="#3b82f6" stroke="#2563eb" strokeWidth="0.5" />
      ))}

      {/* Score labels — 放在数据点附近，内侧偏移，避免和外层标签重叠 */}
      {_actualScores.map((score, i) => {
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2
        const scoreVal = _scores[i] || 0
        // 分数标签放在数据点的内侧（-10px），如果太低分就放在外侧
        const isLow = scoreVal < 0.15
        const sOffset = isLow ? 16 : -10
        const sR = Math.max(r * scoreVal + sOffset, r * 0.1)
        const lx = cx + sR * Math.cos(angle)
        const ly = cy + sR * Math.sin(angle)
        const sAnchor = lx < cx - 20 ? "end" : lx > cx + 20 ? "start" : "middle"
        // 分数标签的垂直对齐微调：顶部顶点往上挪，底部顶点往下挪
        const dy = ly < cy - 30 ? "-0.3em" : ly > cy + 30 ? "0.8em" : "0.3em"
        return (
          <text
            key={`score-${i}`}
            x={lx}
            y={ly}
            textAnchor={sAnchor}
            dy={dy}
            className="fill-blue-300"
            style={{ fontSize: "13px", fontWeight: 600 }}
          >
            {score}
          </text>
        )
      })}

      {/* Dimension labels — 支持智能换行，字号12px起步 */}
      {_labels.map((label, i) => {
        const lines = splitLabel(label)
        const pos = getLabelPos(i)
        let textAnchor = "middle" as "middle" | "start" | "end"
        if (pos.x < cx - 25) textAnchor = "end"
        else if (pos.x > cx + 25) textAnchor = "start"
        // 垂直偏移：单行 vs 双行
        const firstDy = lines.length > 1 ? "-0.5em" : "0em"
        return (
          <text
            key={`label-${i}`}
            x={pos.x}
            y={pos.y}
            textAnchor={textAnchor}
            className="fill-zinc-300"
            style={{ fontSize: "16px", fontWeight: 600 }}
          >
            {lines.map((line, li) => (
              <tspan key={li} x={pos.x} dy={li === 0 ? firstDy : "1.3em"}>{line}</tspan>
            ))}
          </text>
        )
      })}
    </svg>
  )
}
