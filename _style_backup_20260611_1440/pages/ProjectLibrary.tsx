import { useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { ChevronLeft, ChevronRight, ChevronDown, Search, AlertCircle, Info, LinkIcon } from "lucide-react"

// Mock data for projects
const MOCK_PROJECTS = [
  {
    id: 1,
    name: "Uniswap V3",
    address: "0x1111111254fb6c44bac0bed2854e76f90643097d",
    riskLevel: 1,
    assessmentCount: 24,
    tokens: ["ETH", "USDC"],
    lastEvaluation: "2024-06-08",
  },
  {
    id: 2,
    name: "OpenSea",
    address: "0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0",
    riskLevel: 2,
    assessmentCount: 18,
    tokens: ["WETH", "BLUR"],
    lastEvaluation: "2024-06-07",
  },
  {
    id: 3,
    name: "Aave Protocol",
    address: "0xbc6da0fe9ad7e36c3130ee5145995e756ed970d9",
    riskLevel: 1,
    assessmentCount: 32,
    tokens: ["AAVE", "USDC", "ETH"],
    lastEvaluation: "2024-06-09",
  },
  {
    id: 4,
    name: "Curve Finance",
    address: "0xd533a949740bb3306d119cc777fa900ba034cd52",
    riskLevel: 2,
    assessmentCount: 15,
    tokens: ["CRV", "USDC"],
    lastEvaluation: "2024-06-06",
  },
  {
    id: 5,
    name: "MakerDAO",
    address: "0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2",
    riskLevel: 3,
    assessmentCount: 12,
    tokens: ["MKR", "DAI"],
    lastEvaluation: "2024-06-05",
  },
  {
    id: 6,
    name: "Compound",
    address: "0xc00e94cb662c3520282e6f5717214fead7fec68",
    riskLevel: 1,
    assessmentCount: 28,
    tokens: ["COMP", "ETH"],
    lastEvaluation: "2024-06-08",
  },
  {
    id: 7,
    name: "Lido Finance",
    address: "0x5a98fcbea516cf06857215779fd812ca3bef1b32",
    riskLevel: 2,
    assessmentCount: 21,
    tokens: ["LDO", "stETH"],
    lastEvaluation: "2024-06-07",
  },
  {
    id: 8,
    name: "Yearn Finance",
    address: "0x0bc529c00c6401aef6d220be8c6ea1667f6ad93e",
    riskLevel: 3,
    assessmentCount: 10,
    tokens: ["YFI", "USDC"],
    lastEvaluation: "2024-06-04",
  },
]

const AD_BANNERS = [
  { id: 1, title: "Web3 安全防护指南", color: "from-blue-600 to-blue-800" },
  { id: 2, title: "智能合约审计服务", color: "from-purple-600 to-purple-800" },
  { id: 3, title: "风险评估工具推荐", color: "from-indigo-600 to-indigo-800" },
]

const RISK_LEVELS = [
  { value: "all", label: "全部", color: "bg-gray-500" },
  { value: "critical", label: "需谨慎", color: "bg-red-600" },
  { value: "medium", label: "中等", color: "bg-orange-500" },
  { value: "good", label: "良好", color: "bg-green-500" },
]

const SORT_OPTIONS = [
  { value: "risk", label: "风险指数" },
  { value: "count", label: "评估次数" },
  { value: "date", label: "最新评估" },
]

interface Project {
  id: number
  name: string
  address: string
  riskLevel: number
  assessmentCount: number
  tokens: string[]
  lastEvaluation: string
}

export default function ProjectLibrary() {
  const navigate = useNavigate()
  const [searchInput, setSearchInput] = useState("")
  const [filterRisk, setFilterRisk] = useState<"all" | "good" | "medium" | "critical">("all")
  const [sortBy, setSortBy] = useState<"risk" | "count" | "date">("risk")
  const [sortAsc, setSortAsc] = useState(false)
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [carouselIndex, setCarouselIndex] = useState(0)
  const [showInfoModal, setShowInfoModal] = useState(false)

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
    let result = MOCK_PROJECTS.filter((project: Project) => {
      // Search filter
      const matchesSearch =
        searchInput === "" ||
        fuzzyMatch(project.name, searchInput) ||
        fuzzyMatch(project.address, searchInput)

      if (!matchesSearch) return false

      // Risk filter
      if (filterRisk !== "all") {
        const riskMap: { [key: string]: number } = {
          critical: 3,
          medium: 2,
          good: 1,
        }
        if (project.riskLevel !== riskMap[filterRisk]) return false
      }

      return true
    })

    // Sort projects
    result.sort((a: Project, b: Project) => {
      let compareValue = 0

      if (sortBy === "risk") {
        compareValue = a.riskLevel - b.riskLevel
      } else if (sortBy === "count") {
        compareValue = a.assessmentCount - b.assessmentCount
      } else if (sortBy === "date") {
        compareValue = new Date(a.lastEvaluation).getTime() - new Date(b.lastEvaluation).getTime()
      }

      return sortAsc ? compareValue : -compareValue
    })

    return result
  }, [searchInput, filterRisk, sortBy, sortAsc])

  // Get risk badge styling
  const getRiskBadge = (level: number) => {
    switch (level) {
      case 3:
        return { label: "需谨慎", color: "bg-red-600 text-white" }
      case 2:
        return { label: "中等", color: "bg-orange-500 text-white" }
      case 1:
        return { label: "良好", color: "bg-green-500 text-white" }
      default:
        return { label: "未知", color: "bg-gray-500 text-white" }
    }
  }

  // Mask address
  const maskAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-6)}`
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-900 backdrop-blur">
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

      {/* Ad Carousel */}
      <div className="relative h-20 overflow-hidden bg-zinc-900">
        <div
          className="absolute inset-0 flex transition-transform duration-500"
          style={{ transform: `translateX(-${carouselIndex * 100}%)` }}
        >
          {AD_BANNERS.map((ad) => (
            <div
              key={ad.id}
              className={`h-20 w-full flex-shrink-0 bg-gradient-to-r ${ad.color} flex items-center justify-center`}
            >
              <span className="text-xs font-medium">{ad.title}</span>
            </div>
          ))}
        </div>

        {/* Carousel Controls */}
        <button
          onClick={() =>
            setCarouselIndex((carouselIndex - 1 + AD_BANNERS.length) % AD_BANNERS.length)
          }
          className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-1 hover:bg-black/70"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => setCarouselIndex((carouselIndex + 1) % AD_BANNERS.length)}
          className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-1 hover:bg-black/70"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        {/* Pagination dots */}
        <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
          {AD_BANNERS.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCarouselIndex(idx)}
              className={`h-1.5 w-1.5 rounded-full transition-colors ${
                idx === carouselIndex ? "bg-white" : "bg-gray-500"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Search Bar */}
      <div className="border-b border-zinc-800 bg-zinc-900 px-4 py-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="搜索项目名称或合约地址"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full rounded-lg bg-zinc-800 py-2 pl-10 pr-3 text-xs placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Filters and Sort */}
      <div className="border-b border-zinc-800 bg-zinc-900 px-4 py-1.5 space-y-1.5">
        {/* Filter Row */}
        <div className="relative">
          <button
            onClick={() => {
              setShowFilterMenu(!showFilterMenu)
              setShowSortMenu(false)
            }}
            className="flex w-full items-center rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
          >
            <span className="bg-zinc-700 px-2 py-1 rounded-l-lg text-xs font-medium whitespace-nowrap">筛选</span>
            <span className="flex-1 px-2 py-1 text-left text-xs">
              {filterRisk === "all" ? "全部" : RISK_LEVELS.find((r) => r.value === filterRisk)?.label}
            </span>
            <ChevronDown className="h-3.5 w-3.5 mr-2 text-gray-400" />
          </button>

          {showFilterMenu && (
            <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border border-zinc-700 bg-zinc-800 shadow-lg z-50">
              {RISK_LEVELS.map((level) => (
                <button
                  key={level.value}
                  onClick={() => {
                    setFilterRisk(level.value as any)
                    setShowFilterMenu(false)
                  }}
                  className={`w-full px-3 py-1.5 text-left text-xs hover:bg-zinc-700 first:rounded-t-lg last:rounded-b-lg ${
                    filterRisk === level.value ? "bg-zinc-700" : ""
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
            className="flex w-full items-center rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
          >
            <span className="bg-zinc-700 px-2 py-1 rounded-l-lg text-xs font-medium whitespace-nowrap">排序</span>
            <span className="flex-1 px-2 py-1 text-left text-xs">
              {SORT_OPTIONS.find((s) => s.value === sortBy)?.label}
              {sortBy === "risk" && (sortAsc ? " ↑" : " ↓")}
              {sortBy === "count" && (sortAsc ? " ↑" : " ↓")}
              {sortBy === "date" && (sortAsc ? " ↑" : " ↓")}
            </span>
            <ChevronDown className="h-3.5 w-3.5 mr-2 text-gray-400" />
          </button>

          {showSortMenu && (
            <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border border-zinc-700 bg-zinc-800 shadow-lg z-50">
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
                  className={`w-full px-3 py-1.5 text-left text-xs hover:bg-zinc-700 first:rounded-t-lg last:rounded-b-lg flex items-center justify-between ${
                    sortBy === option.value ? "bg-zinc-700" : ""
                  }`}
                >
                  <span>{option.label}</span>
                  {sortBy === option.value && (
                    <span className="text-blue-400">{sortAsc ? "↑" : "↓"}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Project List */}
      <div className="px-4 py-2 space-y-1.5">
        {filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <AlertCircle className="h-8 w-8 text-gray-600" />
            <p className="text-center text-sm text-gray-500">暂无匹配的项目</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {filteredProjects.map((project: Project) => {
              const risk = getRiskBadge(project.riskLevel)
              const isMultiToken = project.tokens.length > 1
              return (
                <div
                  key={project.id}
                  className="rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors border border-zinc-700 cursor-pointer group"
                  onClick={() => navigate(`/library/${project.id}`)}
                >
                  <div className="grid grid-cols-1 gap-1 p-2">
                    {/* Top Row: Project Name, Risk Badge, and Arrow */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-xs truncate">{project.name}</h3>
                        <div className="flex items-center gap-1 mt-0.5">
                          <p className="text-xs text-gray-400 truncate">{maskAddress(project.address)}</p>
                          {isMultiToken && (
                            <span className="text-xs text-gray-500 flex items-center gap-0.5 flex-shrink-0 whitespace-nowrap">
                              <LinkIcon className="h-2.5 w-2.5" />
                              <span className="text-gray-600">多代币</span>
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0 -mr-1">
                        <span className={`${risk.color} rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap`}>
                          {risk.label}
                        </span>
                        <ChevronRight className="h-4 w-4 text-gray-500 group-hover:text-gray-300 transition-colors flex-shrink-0" />
                      </div>
                    </div>

                    {/* Bottom Row: Assessment Count and Last Evaluation Time */}
                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowInfoModal(true)
                        }}
                        className="flex items-center gap-1 hover:text-gray-300 transition-colors flex-shrink-0 whitespace-nowrap text-[10px] text-gray-400"
                        title="查看评估次数说明"
                      >
                        <span>评估次数 {project.assessmentCount}</span>
                        <Info className="h-2.5 w-2.5 text-gray-600 hover:text-gray-500" />
                      </button>
                      <span className="flex-shrink-0 whitespace-nowrap text-[10px] text-gray-400">
                        最后评估时间 {project.lastEvaluation}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-zinc-900 rounded-lg p-4 max-w-xs mx-4 space-y-3 border border-zinc-600">
            <h2 className="text-white font-semibold text-sm text-center">评估次数说明</h2>
            <p className="text-zinc-300 text-xs text-center">评估次数反映项目被查询的频率，不代表安全性</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowInfoModal(false)}
                className="flex-1 py-1.5 px-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
