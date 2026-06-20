import { Component, ErrorInfo, ReactNode } from "react"

interface Props {
  children: ReactNode
  fallback?: (error: Error) => ReactNode
  /** 渲染出错时回调 —— 让父组件知道需要触发重试/降级逻辑 */
  onError?: () => void
}

interface State {
  hasError: boolean
  error?: Error
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const errorDetail = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    }
    console.error("🚨 ErrorBoundary caught:", errorDetail)
    // 通知父组件（例如设置 reportFailed，让用户可以通过重试按钮重新生成）
    this.props.onError?.()
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return <>{this.props.fallback(this.state.error!)}</>
      }
      return (
        <div className="px-4 py-2 rounded-lg text-sm leading-relaxed bg-zinc-800 text-zinc-200">
          报告暂时无法显示，请再次点击上方「解锁全景风险报告」按钮重新生成，不会重复扣费
          {this.state.error && (
            <details className="mt-1 text-xs text-zinc-500">
              <summary>错误详情</summary>
              <pre className="mt-1 whitespace-pre-wrap break-all">{this.state.error.message}</pre>
            </details>
          )}
        </div>
      )
    }

    return this.props.children
  }
}
