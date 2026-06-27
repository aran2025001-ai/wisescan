import { useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Spinner } from './components/ui/spinner'
import ErrorBoundary from './components/ErrorBoundary'

// 仅首页立即加载，其余全部按需加载
import Welcome from './pages/Welcome'

const Home = lazy(() => import('./pages/Home'))
const RiskAssessment = lazy(() => import('./pages/RiskAssessment'))
const BusinessBreakdown = lazy(() => import('./pages/BusinessBreakdown'))
const ProjectLibrary = lazy(() => import('./pages/ProjectLibrary'))
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'))
const Profile = lazy(() => import('./pages/Profile'))
const MyReports = lazy(() => import('./pages/MyReports'))
const MyBusinessModels = lazy(() => import('./pages/MyBusinessModels'))
const InvitationRebate = lazy(() => import('./pages/InvitationRebate'))
const MyCoupons = lazy(() => import('./pages/MyCoupons'))
const HelpCenter = lazy(() => import('./pages/HelpCenter'))
const AboutWiseScan = lazy(() => import('./pages/AboutWiseScan'))
const ReportDetail = lazy(() => import('./pages/ReportDetail'))
const BusinessReportDetailPage = lazy(() => import('./pages/BusinessReportDetailPage'))
const WithdrawalHistory = lazy(() => import('./pages/WithdrawalHistory'))
const Feedback = lazy(() => import('./pages/Feedback'))
const InviteLanding = lazy(() => import('./pages/InviteLanding'))
const ShareCardPreview = lazy(() => import('./pages/ShareCardPreview'))

// 管理后台
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'))
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const AdminWithdrawals = lazy(() => import('./pages/admin/AdminWithdrawals'))
const AdminEvidences = lazy(() => import('./pages/admin/AdminEvidences'))
const AdminProjects = lazy(() => import('./pages/admin/AdminProjects'))
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'))
const AdminUserDetail = lazy(() => import('./pages/admin/AdminUserDetail'))
const AdminFeedback = lazy(() => import('./pages/admin/AdminFeedback'))
const AdminSiteConfig = lazy(() => import('./pages/admin/AdminSiteConfig'))

function LazyFallback() {
  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <Spinner className="size-6 text-blue-400" />
    </div>
  )
}

export default function App() {
  useEffect(() => {
    const url = new URL(window.location.href)
    const needsReplace = url.searchParams.has('reset_payment') || url.searchParams.has('reset_wallet') || url.searchParams.has('reset_all')

    if (url.searchParams.has('reset_payment')) {
      localStorage.removeItem('wisescan_assessment_unlocked')
      localStorage.removeItem('wisescan_breakdown_unlocked')
      url.searchParams.delete('reset_payment')
    }
    if (url.searchParams.has('reset_all') || url.searchParams.has('reset_wallet')) {
      localStorage.clear()
      sessionStorage.clear()
      url.searchParams.delete('reset_all')
      url.searchParams.delete('reset_wallet')
    }
    if (needsReplace) {
      window.location.replace('/')
    }
  }, [])

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-black flex justify-center">
        <div className="w-full max-w-[428px] bg-[#050505]">
          <ErrorBoundary fallback={(err) => (
            <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6">
              <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 max-w-sm text-center">
                <p className="text-red-400 text-lg font-semibold mb-2">页面加载异常</p>
                <p className="text-zinc-400 text-sm mb-4">页面渲染时遇到了错误，请刷新页面重试。</p>
                <details className="text-left">
                  <summary className="text-xs text-zinc-500 cursor-pointer mb-2">错误详情</summary>
                  <pre className="text-xs text-zinc-600 whitespace-pre-wrap break-all bg-zinc-950 rounded p-2">{err.message}</pre>
                </details>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors"
                >
                  刷新页面
                </button>
              </div>
            </div>
          )}>
            <Suspense fallback={<LazyFallback />}>
              <Routes>
                <Route path="/" element={<Welcome />} />
                <Route path="/home" element={<Home />} />
                <Route path="/assess" element={<RiskAssessment />} />
                <Route path="/business" element={<BusinessBreakdown />} />
                <Route path="/library" element={<ProjectLibrary />} />
                <Route path="/library/:id" element={<ProjectDetail />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/profile/reports" element={<MyReports />} />
                <Route path="/profile/reports/:id" element={<ReportDetail />} />
                <Route path="/profile/business-models" element={<MyBusinessModels />} />
                <Route path="/profile/business-models/:id" element={<BusinessReportDetailPage />} />
                <Route path="/profile/invitation" element={<InvitationRebate />} />
                <Route path="/profile/coupons" element={<MyCoupons />} />
                <Route path="/profile/help" element={<HelpCenter />} />
                <Route path="/profile/about" element={<AboutWiseScan />} />
                <Route path="/profile/feedback" element={<Feedback />} />
                <Route path="/profile/withdrawal" element={<WithdrawalHistory />} />
                <Route path="/invite" element={<InviteLanding />} />
                <Route path="/preview/share-card" element={<ShareCardPreview />} />
                {/* 管理后台 */}
                <Route path="/admin/login" element={<AdminLogin />} />
                <Route path="/admin/dashboard" element={<AdminDashboard />} />
                <Route path="/admin/withdrawals" element={<AdminWithdrawals />} />
                <Route path="/admin/evidences" element={<AdminEvidences />} />
                <Route path="/admin/projects" element={<AdminProjects />} />
                <Route path="/admin/users" element={<AdminUsers />} />
                <Route path="/admin/users/:address" element={<AdminUserDetail />} />
                <Route path="/admin/feedback" element={<AdminFeedback />} />
                <Route path="/admin/site-config" element={<AdminSiteConfig />} />
                <Route path="/admin" element={<AdminLogin />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </div>
      </div>
    </BrowserRouter>
  )
}
