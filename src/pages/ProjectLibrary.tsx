import { useState, useMemo, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { ChevronLeft, ChevronRight, ChevronDown, Search, AlertCircle, Info, Loader2 } from "lucide-react"
import { supabase } from "../lib/supabase"
import type { ProjectRecord } from "../services/projectService"

const RISK_LEVELS = [
  { value: "all", label: "全部", color: "bg-zinc-500" },
  { value: "critical", label: "需谨慎", color: "bg-red-600" },
  { value: "medium", label: "中等", color: "bg-orange-500" },
  { value: "good", label: "良好", color: "bg-green-500" },
]

const SORT_OPTIONS = [
  { value: "risk", label: "风险指数" },
  { value: "count", label: "评估次数" },
  { value: "date", label: "最新评估" },
]

/** 将 Supabase 数据库返回的行映射为前端 ProjectRecord 类型 */
function mapDbRow(row: Record<string, any>): ProjectRecord {
  const id = String(row.id)
  return {
    id,
    name: row.name || "未命名项目",
    contractAddress: row.contract_address || "",
    riskLevel: 1, // 后续由风险报告更新
    assessmentCount: row.assessment_count || 1,
    lastEvaluatedAt: row.last_eval_time || new Date().toISOString(),
    hasReport: false,
    createdAt: row.created_at || row.last_eval_time || new Date().toISOString(),
    previousNames: row.previous_names || [], // 曾用名
  }
}

export default function ProjectLibrary() {
  const navigate = useNavigate()
  const [searchInput, setSearchInput] = useState("")
  const [filterRisk, setFilterRisk] = useState<"all" | "good" | "medium" | "critical">("all")
  const [sortBy, setSortBy] = useState<"risk" | "count" | "date">("risk")
  const [sortAsc, setSortAsc] = useState(false)
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [, _setCarouselIndex] = useState(0)
  const [showInfoPopover, setShowInfoPopover] = useState<string | null>(null)

  // 🔗 Supabase 数据
  const [projects, setProjects] = useState<ProjectRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    // 🚀 秒开优化：先从 localStorage 读取缓存，立刻显示
    try {
      const cached = localStorage.getItem('wisescan_cache_projects')
      if (cached) {
        const parsed = JSON.parse(cached)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setProjects(parsed)
          setLoading(false) // 有缓存就不显示 loading 转圈
        }
      }
    } catch {}

    async function fetchProjects() {
      if (!cancelled && projects.length === 0) {
        setLoading(true) // 只在没缓存时显示 loading
      }
      setFetchError(null)
      console.time('⏱️ fetchProjects 总耗时')
      try {
        console.time('⏱️ supabase 并行查询')
        // 并行查询：项目列表 + 风险报告（加上 limit 防止全量扫表）
        const [projResult, reportResult] = await Promise.all([
          supabase
            .from('projects')
            .select('id, name, contract_address, assessment_count, last_eval_time, created_at, previous_names')
            .order('last_eval_time', { ascending: false })
            .limit(50),
          supabase
            .from('risk_reports')
            .select('project_id, total_score')
            .order('created_at', { ascending: false })
            .limit(500),
        ])
        console.timeEnd('⏱️ supabase 并行查询')

        if (cancelled) return
        if (projResult.error) {
          setFetchError(projResult.error.message)
        } else {
          // 构建 riskMap（取每个 project_id 的最新一条）
          let riskMap: Record<string, number> = {}
          const reports = reportResult.data || []
          const seen = new Set<string>()
          for (const r of reports) {
            if (!seen.has(r.project_id)) {
              seen.add(r.project_id)
              const ts = r.total_score
              riskMap[r.project_id] = ts >= 75 ? 1 : ts >= 55 ? 2 : ts >= 35 ? 3 : 4
            }
          }
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
          const freshProjects = (projResult.data || []).map(row => {
            const rec = mapDbRow(row)
            if (riskMap[rec.id]) rec.riskLevel = riskMap[rec.id]
            if (rec.contractAddress) {
              const localC = localCounts[rec.contractAddress.toLowerCase()]
              if (localC && localC > rec.assessmentCount) rec.assessmentCount = localC
            }
            return rec
          })
          setProjects(freshProjects)
          // 💾 写入缓存，下次秒开
          try { localStorage.setItem('wisescan_cache_projects', JSON.stringify(freshProjects)) } catch {}
        }
      } catch (e: any) {
        if (cancelled) return
        setFetchError(e.message || '网络请求失败')
      } finally {
        console.timeEnd('⏱️ fetchProjects 总耗时')
        if (!cancelled) setLoading(false)
      }
    }
    fetchProjects()
    return () => { cancelled = true }
  }, [])

  // Fuzzy search function
  const fuzzyMatch = (str: string, pattern: string): boolean => {
    const lowerStr = str.toLowerCase()
    const lowerPattern = pattern.toLowerCase()
    let patternIdx = 0
    for (let i = 0; i < lowerStr.length; i++) {
      if (lowerStr[i] === lowerPattern[patternIdx]) {
        patternIdx++
      }
    }
    return patternIdx === lowerPattern.length
  }

  // Filter and sort projects
  const filteredProjects = useMemo(() => {
    let result = projects.filter((project) => {
      // Search filter
      const matchesSearch =
        searchInput === "" ||
        fuzzyMatch(project.name, searchInput) ||
        fuzzyMatch(project.contractAddress, searchInput)

      if (!matchesSearch) return false

      // Risk filter
      if (filterRisk !== "all") {
        if (filterRisk === "critical") {
          if (project.riskLevel !== 3 && project.riskLevel !== 4) return false
        } else {
          const riskMap: { [key: string]: number } = {
            medium: 2,
            good: 1,
          }
          if (project.riskLevel !== riskMap[filterRisk]) return false
        }
      }

      return true
    })

    // Sort projects
    result.sort((a, b) => {
      let compareValue = 0
      if (sortBy === "risk") {
        compareValue = a.riskLevel - b.riskLevel
      } else if (sortBy === "count") {
        compareValue = a.assessmentCount - b.assessmentCount
      } else if (sortBy === "date") {
        compareValue = new Date(a.lastEvaluatedAt).getTime() - new Date(b.lastEvaluatedAt).getTime()
      }
      return sortAsc ? compareValue : -compareValue
    })

    return result
  }, [projects, searchInput, filterRisk, sortBy, sortAsc])

  // Get risk badge styling
  const getRiskBadge = (level: number) => {
    switch (level) {
      case 4:
        return { label: "极高风险", color: "bg-red-700 text-white" }
      case 3:
        return { label: "需谨慎", color: "bg-red-600 text-white" }
      case 2:
        return { label: "中等", color: "bg-orange-500 text-white" }
      case 1:
        return { label: "良好", color: "bg-green-500 text-white" }
      default:
        return { label: "未知", color: "bg-zinc-500 text-white" }
    }
  }

  // Get sort direction label
  const getSortDirectionLabel = (value: string, asc: boolean) => {
    if (value === "date") {
      return asc ? "从旧到新" : "从新到旧"
    }
    return asc ? "从低到高" : "从高到低"
  }

  // Mask address
  const maskAddress = (address: string) => {
    if (!address) return "无地址"
    return `${address.slice(0, 6)}...${address.slice(-6)}`
  }

  return (
    <div className="text-white">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-[#343438] bg-black backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-2">
          <button
            onClick={() => navigate("/home")}
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-zinc-800"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="flex-1 text-center text-sm font-semibold">全网项目库</h1>
          <div className="h-8 w-8" />
        </div>
      </div>

      {/* Search Bar */}
      <div className="border-b border-[#343438] bg-black px-4 py-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="搜索项目名称或合约地址"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full rounded-lg bg-zinc-800 py-2 pl-10 pr-3 text-xs placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Filters and Sort */}
      <div className="border-b border-[#343438] bg-black px-4 py-2 space-y-2">
        {/* Filter Row */}
        <div className="relative">
          <button
            onClick={() => {
              setShowFilterMenu(!showFilterMenu)
              setShowSortMenu(false)
            }}
            className="flex w-full items-center rounded-lg bg-zinc-800 hover:bg-zinc-500 active:bg-zinc-400 active:scale-[0.97] transition-all duration-150"
          >
            <span className="bg-zinc-700 px-2 py-2 rounded-l-lg text-xs font-medium whitespace-nowrap">筛选</span>
            <span className="flex-1 px-2 py-2 text-left text-xs">
              {filterRisk === "all" ? "全部" : RISK_LEVELS.find((r) => r.value === filterRisk)?.label}
            </span>
            <ChevronDown className="h-3.5 w-3.5 mr-2 text-zinc-400" />
          </button>

          {showFilterMenu && (
            <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border border-[#343438] bg-zinc-800 shadow-lg z-[99999]">
              {RISK_LEVELS.map((level) => (
                <button
                  key={level.value}
                  onClick={() => {
                    setFilterRisk(level.value as any)
                    setShowFilterMenu(false)
                  }}
                  className={`w-full px-3 py-1.5 text-left text-xs hover:bg-zinc-600 first:rounded-t-lg last:rounded-b-lg ${
                    filterRisk === level.value ? "bg-zinc-600" : ""
                  }`}
                >
                  <span className={`inline-block h-2 w-2 rounded-full mr-2 ${level.color}`} />
                  {level.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sort Row */}
        <div className="relative">
          <button
            onClick={() => {
              setShowSortMenu(!showSortMenu)
              setShowFilterMenu(false)
            }}
            className="flex w-full items-center rounded-lg bg-zinc-800 hover:bg-zinc-500 active:bg-zinc-400 active:scale-[0.97] transition-all duration-150"
          >
            <span className="bg-zinc-700 px-2 py-2 rounded-l-lg text-xs font-medium whitespace-nowrap">排序</span>
            <span className="flex-1 px-2 py-2 text-left text-xs">
              {SORT_OPTIONS.find((s) => s.value === sortBy)?.label}
              {" "}
              {getSortDirectionLabel(sortBy, sortAsc)} {sortAsc ? "↑" : "↓"}
            </span>
            <ChevronDown className="h-3.5 w-3.5 mr-2 text-zinc-400" />
          </button>

          {showSortMenu && (
            <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border border-[#343438] bg-zinc-800 shadow-lg z-[99999]">
              {SORT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    if (sortBy === option.value) {
                      setSortAsc(!sortAsc)
                    } else {
                      setSortBy(option.value as any)
                      setSortAsc(false)
                    }
                    setShowSortMenu(false)
                  }}
                  className={`w-full px-3 py-1.5 text-left text-xs hover:bg-zinc-600 first:rounded-t-lg last:rounded-b-lg flex items-center justify-between ${
                    sortBy === option.value ? "bg-zinc-600" : ""
                  }`}
                >
                  <span>{option.label}</span>
                  {sortBy === option.value && (
                    <span className="text-blue-400 text-xs">
                      {getSortDirectionLabel(option.value, sortAsc)} {sortAsc ? "↑" : "↓"}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Project List */}
      <div className="px-4 py-2 space-y-1.5">
        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
            <p className="text-center text-sm text-zinc-500">加载项目数据中...</p>
          </div>
        )}

        {/* Error State */}
        {!loading && fetchError && (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <AlertCircle className="h-8 w-8 text-red-400" />
            <p className="text-center text-sm text-red-400">加载失败：{fetchError}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 active:scale-[0.97] rounded-lg text-zinc-300 transition-all duration-150"
            >
              重试
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !fetchError && filteredProjects.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <AlertCircle className="h-8 w-8 text-zinc-600" />
            <p className="text-center text-sm text-zinc-500">
              {projects.length === 0 ? "暂无项目数据，完成一次项目评估后即可看到" : "暂无匹配的项目"}
            </p>
          </div>
        )}

        {/* Project Cards */}
        {!loading && !fetchError && filteredProjects.length > 0 && (
          <div className="space-y-1.5">
            {filteredProjects.map((project) => {
              const risk = getRiskBadge(project.riskLevel)
              const formattedDate = project.lastEvaluatedAt
                ? new Date(project.lastEvaluatedAt).toISOString().slice(0, 10)
                : '尚未评估'
              return (
                <div
                  key={project.id}
                  className="rounded-lg bg-zinc-800 hover:bg-zinc-700 active:scale-[0.98] active:brightness-110 transition-all duration-150 border border-[#343438] cursor-pointer group"
                  onClick={() => navigate(`/library/${project.id}`)}
                >
                  <div className="grid grid-cols-1 gap-1 p-2">
                    {/* Top Row: Project Name, Risk Badge, and Arrow */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <h3 className="font-semibold text-xs truncate">{project.name}</h3>
                        </div>
                        <p className="text-xs text-zinc-400 truncate mt-0.5">{maskAddress(project.contractAddress)}</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0 -mr-1">
                        <span className={`${risk.color} rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap`}>
                          {risk.label}
                        </span>
                        <ChevronRight className="h-4 w-4 text-zinc-500 group-hover:text-zinc-300 transition-colors flex-shrink-0" />
                      </div>
                    </div>

                    {/* Bottom Row: Assessment Count and Last Evaluation Time */}
                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <div className="relative flex items-center gap-1 flex-shrink-0 whitespace-nowrap text-[12px] text-zinc-400">
                        <span>评估次数 {project.assessmentCount}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setShowInfoPopover(showInfoPopover === project.id ? null : project.id as any)
                          }}
                          className="text-zinc-600 hover:text-zinc-500 transition-colors"
                        >
                          <Info className="h-2.5 w-2.5" />
                        </button>
                        {showInfoPopover === project.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setShowInfoPopover(null) }} />
                            <div className="absolute bottom-full left-0 mb-2 z-50 bg-zinc-700 border border-zinc-600 rounded-lg p-2.5 max-w-[180px] w-max shadow-xl">
                              <p className="text-zinc-100 text-xs leading-relaxed whitespace-normal break-words">评估次数反映项目被查询的频率，不代表安全性</p>
                            </div>
                          </>
                        )}
                      </div>
                      <span className="flex-shrink-0 whitespace-nowrap text-[12px] text-zinc-400">
                        最后评估时间 {formattedDate}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}
