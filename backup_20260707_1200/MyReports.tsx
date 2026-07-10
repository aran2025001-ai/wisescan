import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, AlertCircle, Info, Loader2 } from 'lucide-react'
import { useAccount } from 'wagmi'
import { supabase } from '../lib/supabase'

const getRiskBadge = (level: number) => {
  switch (level) {
    case 4:
      return { label: '极高风险', color: 'bg-red-700 text-white' }
    case 3:
      return { label: '需谨慎', color: 'bg-red-600 text-white' }
    case 2:
      return { label: '中等', color: 'bg-orange-500 text-white' }
    case 1:
      return { label: '良好', color: 'bg-green-500 text-white' }
    default:
      return { label: '未知', color: 'bg-zinc-500 text-white' }
  }
}

const maskAddress = (address: string): string => {
  return `${address.slice(0, 6)}...${address.slice(-6)}`
}

export default function MyReports() {
  const navigate = useNavigate()
  const { address } = useAccount()
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showInfoPopover, setShowInfoPopover] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        // 未连接钱包时不查数据
        if (!address) {
          if (!cancelled) { setReports([]); setLoading(false) }
          return
        }

        // 先从 localStorage 加载缓存（秒开）
        const cacheKey = `wisescan_myreports_${address.toLowerCase()}`
        try {
          const cached = localStorage.getItem(cacheKey)
          if (cached) {
            const parsed = JSON.parse(cached)
            if (Array.isArray(parsed) && parsed.length > 0) {
              if (!cancelled) { setReports(parsed); setLoading(false) }
            }
          }
        } catch {}

        // 加载该用户有付费报告的项目
        // ⚠️ 使用 LEFT JOIN（!left）而非 INNER JOIN：新记录可能因 project_id=null 被 INNER JOIN 排掉
        let query = supabase.from('risk_reports').select(`
          id, project_id, total_score, created_at, report_data,
          projects!left(name, contract_address)
        `).order('created_at', { ascending: false })

        query = query.ilike('user_address', address.toLowerCase())

        const { data: rows } = await query.limit(100)
        if (cancelled) return

        // 合并 localStorage 评估次数
        let localCounts: Record<string, number> = {}
        try {
          const raw = localStorage.getItem('wisescan_project_library')
          if (raw) {
            const lib = JSON.parse(raw)
            for (const p of (lib || [])) {
              if (p.contractAddress && p.assessmentCount) {
                localCounts[p.contractAddress.toLowerCase()] = p.assessmentCount
              }
            }
          }
        } catch {}

        // 去重：每个合约地址只保留最新的一条
        // LEFT JOIN 下 projects 可能为 null（project_id=null 的记录），从 report_data 提取合约地址作为 fallback
        const seen = new Set<string>()
        const deduped: any[] = []
        for (const r of (rows || [])) {
          // 优先用 projects 表的 contract_address，其次从 report_data 提取
          const projAddr = (r as any)?.projects?.contract_address?.toLowerCase()
          const reportAddr = r.report_data?.contract_address?.toLowerCase() || r.report_data?.address?.toLowerCase() || ''
          const addr = projAddr || reportAddr || ''
          if (addr && !seen.has(addr)) {
            seen.add(addr)
            deduped.push(r)
          }
        }

        const items = deduped.map((r: any) => {
          const proj = r.projects || {}
          // LEFT JOIN 下 projects 可能 null，fallback 到 report_data 的字段
          const displayName = proj.name || r.report_data?.project_name || '未命名'
          let addr = proj.contract_address || ''
          if (!addr && r.report_data) {
            addr = r.report_data?.contract_address || r.report_data?.address || ''
          }
          const ts = r.total_score || 0
          const risk = ts >= 75 ? 1 : ts >= 55 ? 2 : ts >= 35 ? 3 : 4
          const localC = localCounts[addr.toLowerCase()]
          return {
            id: String(r.id),
            projectName: displayName,
            contractAddress: addr,
            riskLevel: risk,
            assessmentCount: localC || 1,
            lastEvaluationDate: r.created_at?.slice(0, 10) || '--',
          }
        })
        // 缓存到 localStorage（下次秒开）
        try { localStorage.setItem(cacheKey, JSON.stringify(items)) } catch {}
        setReports(items)
      } catch (e: any) {
        console.error('加载我的报告失败:', e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [address])

  return (
    <div className="text-white flex flex-col">
      <div className="sticky top-0 z-40 border-b border-[#343438] bg-black backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-2">
          <button
            onClick={() => navigate('/profile')}
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-zinc-800 transition-colors"
            aria-label="返回"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="flex-1 text-center text-sm font-semibold">我的项目评估报告</h1>
          <div className="h-8 w-8" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-2 space-y-1.5">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-blue-500" />
            </div>
          ) : reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <AlertCircle className="h-8 w-8 text-zinc-600" />
              <p className="text-center text-sm text-zinc-500">
                暂无项目评估报告，去安全评估页面开始查一个项目吧
              </p>
              <button
                onClick={() => navigate('/assess')}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-full transition-colors"
              >
                去项目安全评估
              </button>
            </div>
          ) : (
            <div className="space-y-1.5">
              {reports.map((report) => {
                const risk = getRiskBadge(report.riskLevel)
                return (
                  <button
                    key={report.id}
                    onClick={() => navigate(`/profile/reports/${report.id}`, { state: { report } })}
                    className="w-full rounded-lg bg-zinc-800 hover:bg-zinc-700 active:scale-[0.98] active:brightness-110 transition-all duration-150 border border-[#343438] cursor-pointer group text-left"
                  >
                    <div className="grid grid-cols-1 gap-1 p-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-xs truncate">
                            {report.projectName}
                          </h3>
                          <p className="text-xs text-zinc-400 truncate">
                            {maskAddress(report.contractAddress)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0 -mr-1">
                          <span
                            className={`${risk.color} rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap`}
                          >
                            {risk.label}
                          </span>
                          <ChevronRight className="h-4 w-4 text-zinc-500 group-hover:text-zinc-300 transition-colors flex-shrink-0" />
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="relative flex items-center gap-1 flex-shrink-0 whitespace-nowrap text-[12px] text-zinc-400">
                          <span>已评估 {report.assessmentCount.toLocaleString()} 次</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setShowInfoPopover(showInfoPopover === report.id ? null : report.id)
                            }}
                            className="text-zinc-600 hover:text-zinc-500 transition-colors"
                          >
                            <Info className="h-2.5 w-2.5" />
                          </button>
                          {showInfoPopover === report.id && (
                            <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setShowInfoPopover(null) }} />
                          )}
                        </div>
                        <span className="text-[12px] text-zinc-400">
                          {report.lastEvaluationDate}
                        </span>
                      </div>
                    </div>
                    {showInfoPopover === report.id && (
                      <div className="fixed z-50 bg-zinc-800 border border-[#343438] rounded-lg p-2.5 w-44 shadow-lg"
                        style={{ top: '30%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                        <p className="text-zinc-300 text-xs leading-relaxed">评估次数反映项目被查询的频率，不代表安全性</p>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
