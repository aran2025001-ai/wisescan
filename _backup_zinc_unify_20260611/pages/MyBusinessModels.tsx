import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react'

interface BusinessModelReport {
  id: number
  projectName: string
  contractAddress: string
  analysisDate: string
  modelType: string
  riskLevel: 'low' | 'medium' | 'high'
}

const getRiskBadge = (riskLevel: string) => {
  switch (riskLevel) {
    case 'low':
      return { label: '安全', color: 'bg-green-600' }
    case 'medium':
      return { label: '风险中等', color: 'bg-orange-500' }
    case 'high':
      return { label: '高风险', color: 'bg-red-600' }
    default:
      return { label: '未评估', color: 'bg-gray-500' }
  }
}

const mockReports: BusinessModelReport[] = [
  {
    id: 1,
    projectName: 'MY Project',
    contractAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    analysisDate: '2026-06-08',
    modelType: '级差返佣',
    riskLevel: 'low',
  },
  {
    id: 2,
    projectName: 'Test Project',
    contractAddress: '0x1111111254fb6c44bac0bed2854e76f90643097d',
    analysisDate: '2026-06-07',
    modelType: '流动性挖矿',
    riskLevel: 'medium',
  },
  {
    id: 3,
    projectName: 'Demo Token',
    contractAddress: '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0',
    analysisDate: '2026-06-06',
    modelType: 'DAO 治理',
    riskLevel: 'high',
  },
]

const maskAddress = (address: string): string => {
  return `${address.slice(0, 6)}...${address.slice(-6)}`
}

export default function MyBusinessModels() {
  const navigate = useNavigate()
  const [reports] = useState<BusinessModelReport[]>(mockReports)

  const handleCardClick = (id: number) => {
    navigate(`/profile/business-models/${id}`)
  }

  return (
    <div className="text-white flex flex-col">
      <div className="sticky top-0 z-40 border-b border-neutral-800 bg-black/95 backdrop-blur-sm">
        <div className="flex items-center gap-3 px-4 py-4">
          <button
            onClick={() => navigate('/profile')}
            className="flex h-10 w-10 items-center justify-center text-neutral-300 hover:opacity-70 transition-opacity"
            aria-label="返回"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <h1 className="flex-1 text-center text-lg font-semibold">我的商业模式拆解报告</h1>
          <div className="h-10 w-10" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-3 space-y-3">
          {reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <AlertCircle className="h-8 w-8 text-neutral-600" />
              <p className="text-center text-sm text-neutral-500">
                暂无商业模式拆解报告，去商业模式拆解页面开始分析吧
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => {
                const risk = getRiskBadge(report.riskLevel)
                return (
                  <button
                    key={report.id}
                    onClick={() => handleCardClick(report.id)}
                    className="w-full rounded-2xl bg-[#1E1E2F] hover:bg-[#26263e] transition-colors border border-neutral-700 cursor-pointer group text-left"
                  >
                    <div className="grid grid-cols-1 gap-2 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm text-white truncate">
                            {report.projectName}
                          </h3>
                          <p className="text-xs text-neutral-400 truncate mt-1">
                            {maskAddress(report.contractAddress)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 -mr-2">
                          <span
                            className={`${risk.color} rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap`}
                          >
                            {risk.label}
                          </span>
                          <ChevronRight className="h-5 w-5 text-neutral-500 group-hover:text-neutral-300 transition-colors flex-shrink-0" />
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-neutral-400">
                          模式: {report.modelType}
                        </span>
                        <span className="text-xs text-neutral-500">
                          {report.analysisDate}
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
