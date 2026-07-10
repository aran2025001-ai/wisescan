/**
 * WalletGuard — 钱包连接保持 + 断线提示横幅
 *
 * 策略（优先级从高到低）：
 * 1. sessionStorage + injected 自动恢复 → 尽量不掉线
 * 2. 掉线后等待 30 秒让 wagmi 自动重连（TP Wallet 连接波动可能持续较久）
 * 3. 用户交互（点击/滚动）重置计时器 → 避免用户操作中误弹横幅
 * 4. 30 秒后还没连上 → 弹出横幅让用户手动重连
 */

import { useEffect, useState, useRef } from 'react'
import { useAccount, useConnect } from 'wagmi'
import { useLocation } from 'react-router-dom'

const EVER_CONNECTED_KEY = 'wisescan_ever_connected'
const DISCONNECT_TIMEOUT = 30000 // 30 秒（TP Wallet 内部重连可能持续 10-20 秒）

export default function WalletGuard() {
  const { isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const location = useLocation()

  const [showBanner, setShowBanner] = useState(false)
  const disconnectTimer = useRef<ReturnType<typeof setTimeout>>()
  const autoReconnectAttempted = useRef(false)
  const isConnectedRef = useRef(isConnected)

  // 同步最新 isConnected 到 ref
  useEffect(() => { isConnectedRef.current = isConnected }, [isConnected])

  // 页面加载时自动重连（不在欢迎页/邀请页触发）
  useEffect(() => {
    if (autoReconnectAttempted.current) return
    autoReconnectAttempted.current = true
    const isWelcome = typeof window !== 'undefined' &&
      (window.location.pathname === '/' || window.location.pathname.startsWith('/invite'))
    if (isWelcome) return
    const wasConnected = typeof window !== 'undefined' &&
      localStorage.getItem(EVER_CONNECTED_KEY) === '1'
    if (!wasConnected || isConnected) return
    const injected = connectors.find(c => c.id === 'injected' || c.name === 'Injected')
    if (injected) connect({ connector: injected })
  }, [])

  // ── 监听连接状态变化 ──
  useEffect(() => {
    if (isConnected) {
      // 已连上 → 存标记 + 隐藏横幅
      try { localStorage.setItem(EVER_CONNECTED_KEY, '1') } catch {}
      setShowBanner(false)
      if (disconnectTimer.current) {
        clearTimeout(disconnectTimer.current)
        disconnectTimer.current = undefined
      }
    } else {
      const wasConnected = typeof window !== 'undefined' &&
        localStorage.getItem(EVER_CONNECTED_KEY) === '1'
      // 仅在页面可见时才启动断线定时器（页面hidden时暂停计时）
      if (wasConnected && !disconnectTimer.current && document.visibilityState === 'visible') {
        // 等 30 秒让 wagmi 尝试自动重连（手机端注入式连接波动可能持续较久）
        disconnectTimer.current = setTimeout(() => {
          if (isConnectedRef.current) return
          setShowBanner(true)
        }, DISCONNECT_TIMEOUT)
      }
    }
    return () => {
      if (disconnectTimer.current) {
        clearTimeout(disconnectTimer.current)
        disconnectTimer.current = undefined
      }
    }
  }, [isConnected])

  // ── 切回页面时重新检查连接状态（切 APP 回来时可能已恢复）──
  // 关键策略：页面隐藏（如打开系统相册）时暂停断线定时器，
  // 页面可见时重新启动 30 秒窗口，给 wagmi 充足自动重连时间
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        // 用户离开页面（如打开系统相册选图）→ 暂停断线定时器
        if (disconnectTimer.current) {
          clearTimeout(disconnectTimer.current)
          disconnectTimer.current = undefined
        }
      } else if (document.visibilityState === 'visible') {
        // 用户回到页面 → 如果断线且横幅还没显示，重启 30 秒定时器
        if (!isConnectedRef.current) {
          const wasConnected = typeof window !== 'undefined' &&
            localStorage.getItem(EVER_CONNECTED_KEY) === '1'
          if (wasConnected && !disconnectTimer.current && !showBanner) {
            // 给一个新的 30 秒窗口让 wagmi 自动重连
            disconnectTimer.current = setTimeout(() => {
              if (isConnectedRef.current) return
              setShowBanner(true)
            }, DISCONNECT_TIMEOUT)
          }
        } else {
          // 已重连 → 隐藏横幅 + 清除定时器
          setShowBanner(false)
          if (disconnectTimer.current) {
            clearTimeout(disconnectTimer.current)
            disconnectTimer.current = undefined
          }
        }
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [showBanner])

  // ── 用户交互时重置断线计时器 ──
  // TP Wallet 注入式连接可能出现短暂波动，用户正在操作时不弹横幅
  useEffect(() => {
    const resetTimer = () => {
      if (disconnectTimer.current && !isConnectedRef.current) {
        clearTimeout(disconnectTimer.current)
        disconnectTimer.current = setTimeout(() => {
          if (isConnectedRef.current) return
          setShowBanner(true)
        }, DISCONNECT_TIMEOUT)
      }
    }
    const events = ['pointerdown', 'touchstart', 'scroll']
    events.forEach(ev => document.addEventListener(ev, resetTimer, { passive: true }))
    return () => {
      events.forEach(ev => document.removeEventListener(ev, resetTimer))
    }
  }, [])

  // 离开页面时清理定时器
  useEffect(() => {
    return () => {
      if (disconnectTimer.current) {
        clearTimeout(disconnectTimer.current)
        disconnectTimer.current = undefined
      }
    }
  }, [location.pathname])

  const shouldHide = location.pathname === '/' || location.pathname.startsWith('/invite')
  const wasEverConnected = typeof window !== 'undefined' &&
    localStorage.getItem(EVER_CONNECTED_KEY) === '1'
  if (!wasEverConnected || shouldHide || !showBanner) return null

  const handleReconnect = () => {
    setShowBanner(false)
    const injected = connectors.find(c => c.id === 'injected' || c.name === 'Injected')
    if (injected) connect({ connector: injected })
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[99999] flex items-center justify-between px-3"
      style={{ height: 32, background: 'linear-gradient(135deg, #DC2626 0%, #F59E0B 100%)' }}>
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <span className="text-white text-xs font-medium truncate">钱包连接已断开</span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button onClick={handleReconnect}
          className="px-2.5 h-5 rounded bg-white/20 text-white text-[13px] font-semibold hover:bg-white/30 active:scale-95 transition-all whitespace-nowrap">
          重新连接
        </button>
        <button onClick={() => setShowBanner(false)}
          className="flex items-center justify-center w-5 h-5 rounded hover:bg-white/10 active:scale-90 transition-all" aria-label="关闭">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>
    </div>
  )
}
