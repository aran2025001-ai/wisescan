import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import { useAccount } from 'wagmi'
import { ChevronLeft, ChevronRight, AlertCircle, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface BusinessModelReport {
  id: string
  user_address: string
  project_name: string | null
  rule_text: string | null
  report_data: any
  pattern_type: string | null
  created_at: string
}

export default function MyBusinessModels() {
  const navigate = useNavigate()
  const { address, isConnected } = useAccount()
  const [reports, setReports] = useState<BusinessModelReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchReports = useCallback(async () => {
    if (!isConnected || !address) {
      setReports([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await supabase
        .from('business_reports')
        .select('*')
        .eq('user_address', address.toLowerCase())
        .order('created_at', { ascending: false })

      if (fetchError) {
        console.error('获取报告失败:', fetchError.message)
        setError(fetchError.message)
      } else {
        // 去重：按 project_name 合并，只保留每个项目最新的一条
        const latestMap = new Map<string, any>()
        for (const r of (data || [])) {
          let pn = r.project_name
          if (pn === '用户自定义' && r.report_data?.plain_explanation) {
            const match = r.report_data.plain_explanation.match(/项目叫([A-Za-z0-9\u4e00-\u9fff]+)/)
            if (match?.[1]) pn = match[1]
          }
          const key = pn || '未命名项目_' + r.user_address
          // 保留每个项目最新的一条（data 已按 created_at DESC 排序，第一个就是最新的）
          if (!latestMap.has(key)) {
            const clone = { ...r }
            if (pn !== r.project_name) clone.project_name = pn
            latestMap.set(key, clone)
          }
        }
        setReports(Array.from(latestMap.values()))
      }
    } catch (err: any) {
      console.error('获取报告异常:', err.message)
      setError(err.message || '网络请求失败')
    } finally {
      setLoading(false)
    }
  }, [address, isConnected])

  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  const handleCardClick = (report: BusinessModelReport) => {
    navigate(`/profile/business-models/${report.id}`)
  }

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr)
    return date.toISOString().slice(0, 10)
  }

  const getPatternTypeBadge = (patternType: string | null) => {
    if (!patternType) return { label: '未知', color: 'bg-zinc-500 text-white' }
    
    // 根据模式类型返回不同的颜色
    const typeMap: Record<string, { label: string; color: string }> = {
      '级差返佣': { label: '级差返佣', color: 'bg-blue-500 text-white' },
      '矩阵制': { label: '矩阵制', color: 'bg-purple-500 text-white' },
      '对碰奖': { label: '对碰奖', color: 'bg-green-500 text-white' },
      '静态分红': { label: '静态分红', color: 'bg-orange-500 text-white' },
      '混合模式': { label: '混合模式', color: 'bg-pink-500 text-white' },
    }

    return typeMap[patternType] || { label: patternType, color: 'bg-zinc-500 text-white' }
  }

  return (
    <div className="text-white flex flex-col min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-[#343438] bg-black backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-2">
          <button
            onClick={() => navigate('/profile')}
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-zinc-800 transition-colors"
            aria-label="返回"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="flex-1 text-center text-sm font-semibold">我的商业模式拆解报告</h1>
          <div className="h-8 w-8" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-2 space-y-1.5">
          {/* Loading State */}
          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
              <p className="text-center text-sm text-zinc-500">加载报告数据中...</p>
            </div>
          )}

          {/* Error State */}
          {!loading && error && (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <AlertCircle className="h-8 w-8 text-red-400" />
              <p className="text-center text-sm text-red-400">加载失败：{error}</p>
              <button
                onClick={() => fetchReports()}
                className="px-4 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 transition-colors"
              >
                重试
              </button>
            </div>
          )}

          {/* Not Connected */}
          {!loading && !error && !isConnected && (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <AlertCircle className="h-8 w-8 text-zinc-600" />
              <p className="text-center text-sm text-zinc-500">
                请先连接钱包以查看您的拆解报告
              </p>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && isConnected && reports.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <AlertCircle className="h-8 w-8 text-zinc-600" />
              <p className="text-center text-sm text-zinc-500">
                暂无拆解报告，去商业模式拆解页面分析一个项目吧
              </p>
              <button
                onClick={() => navigate('/business')}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-full transition-colors"
              >
                去商业模式拆解
              </button>
            </div>
          )}

          {/* Report List */}
          {!loading && !error && reports.length > 0 && (
            <div className="space-y-1.5">
              {reports.map((report) => {
                const pattern = getPatternTypeBadge(report.pattern_type)
                return (
                  <button
                    key={report.id}
                    onClick={() => handleCardClick(report)}
                    className="w-full rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors border border-[#343438] cursor-pointer group text-left"
                  >
                    <div className="grid grid-cols-1 gap-1 p-2">
                      {/* Top Row: Project Name + Arrow */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-xs truncate text-blue-400">
                            {report.project_name === '用户自定义' ? '未命名项目' : (report.project_name || '未命名项目')}
                          </h3>
                        </div>
                        <ChevronRight className="h-4 w-4 text-zinc-500 group-hover:text-zinc-300 transition-colors flex-shrink-0 mt-0.5" />
                      </div>

                      {/* Bottom Row: Pattern Type Badge + Date */}
                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        <span className={`${pattern.color} rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap`}>
                          {pattern.label}
                        </span>
                        <span className="text-[10px] text-zinc-400">
                          {formatDate(report.created_at)}
                        </span>
                      </div>
                    </div>
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
