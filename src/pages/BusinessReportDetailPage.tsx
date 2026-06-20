import { useNavigate, useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { ChevronLeft, AlertCircle, Loader2 } from 'lucide-react'
import { BusinessReportCard } from '../components/BusinessReportCard'
import { supabase } from '../lib/supabase'

export default function BusinessReportDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  
  const [reportData, setReportData] = useState<any>(null)
  const [projectName, setProjectName] = useState<string>('项目名称')
  const [patternType, setPatternType] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      setError('无效的报告 ID')
      setLoading(false)
      return
    }

    const fetchReport = async () => {
      setLoading(true)
      setError(null)

      try {
        const { data, error: fetchError } = await supabase
          .from('business_reports')
          .select('*')
          .eq('id', id)
          .single()

        if (fetchError) {
          console.error('获取报告详情失败:', fetchError.message)
          if (fetchError.code === 'PGRST116') {
            setError('报告不存在或已被删除')
          } else {
            setError(fetchError.message)
          }
        } else if (data) {
          // 设置报告数据
          setReportData(data.report_data)
          // 如果 project_name 是"用户自定义"，从 plain_explanation 提取
          let pName = data.project_name
          if (pName === '用户自定义' && data.report_data?.plain_explanation) {
            const match = data.report_data.plain_explanation.match(/项目叫([A-Za-z0-9\u4e00-\u9fff]+)/)
            if (match?.[1]) pName = match[1]
          }
          setProjectName(pName || '未命名项目')
          setPatternType(data.pattern_type || '')
          
          console.log('✅ 报告详情加载成功:', data.id)
        }
      } catch (err: any) {
        console.error('获取报告详情异常:', err.message)
        setError(err.message || '网络请求失败')
      } finally {
        setLoading(false)
      }
    }

    fetchReport()
  }, [id])

  // 加载状态
  if (loading) {
    return (
      <div className="text-white flex flex-col min-h-screen">
        <div className="sticky top-0 z-40 border-b border-[#343438] bg-black backdrop-blur">
          <div className="flex items-center px-4 py-2">
            <button
              onClick={() => navigate('/profile/business-models')}
              className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-zinc-800 transition-colors"
              aria-label="返回"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h1 className="flex-1 text-center text-sm font-semibold">加载中...</h1>
            <div className="h-8 w-8" />
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
            <p className="text-sm text-zinc-500">正在加载报告详情...</p>
          </div>
        </div>
      </div>
    )
  }

  // 错误状态
  if (error) {
    return (
      <div className="text-white flex flex-col min-h-screen">
        <div className="sticky top-0 z-40 border-b border-[#343438] bg-black backdrop-blur">
          <div className="flex items-center px-4 py-2">
            <button
              onClick={() => navigate('/profile/business-models')}
              className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-zinc-800 transition-colors"
              aria-label="返回"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h1 className="flex-1 text-center text-sm font-semibold">报告详情</h1>
            <div className="h-8 w-8" />
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="flex flex-col items-center gap-3 max-w-md">
            <AlertCircle className="h-12 w-12 text-red-400" />
            <p className="text-center text-sm text-red-400">{error}</p>
            <button
              onClick={() => navigate('/profile/business-models')}
              className="px-4 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 transition-colors"
            >
              返回报告列表
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 正常状态 - 显示报告
  return (
    <div className="text-white flex flex-col min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-[#343438] bg-black backdrop-blur">
        <div className="flex items-center justify-between px-4 py-2">
          <button
            onClick={() => navigate('/profile/business-models')}
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-zinc-800 transition-colors"
            aria-label="返回"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="text-sm font-semibold flex-1 text-center truncate px-2">
            {projectName}
          </h1>
          <div className="h-8 flex items-center">
            {patternType && (
              <span className="bg-blue-600 text-white rounded-full px-2 py-0.5 text-xs font-medium">
                {patternType}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Report Content */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto">
          {reportData ? (
            <BusinessReportCard reportData={reportData} />
          ) : (
            <div className="flex flex-col items-center gap-3 py-12">
              <AlertCircle className="h-8 w-8 text-zinc-600" />
              <p className="text-center text-sm text-zinc-500">
                报告数据为空
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
