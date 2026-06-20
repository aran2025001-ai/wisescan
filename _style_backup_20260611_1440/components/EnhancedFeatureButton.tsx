import type { LucideIcon } from "lucide-react"
import { useState, useRef } from "react"
import { ChevronRight } from "lucide-react"

interface EnhancedFeatureButtonProps {
  icon: LucideIcon
  title: string
  subtitle: string
  onClick?: () => void
}

export function EnhancedFeatureButton({
  icon: Icon,
  title,
  subtitle,
  onClick,
}: EnhancedFeatureButtonProps) {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [isHovering, setIsHovering] = useState(false)
  const [isPressed, setIsPressed] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!buttonRef.current) return

    const rect = buttonRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    setMousePosition({ x, y })
  }

  return (
    <button
      ref={buttonRef}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => {
        setIsHovering(false)
        setIsPressed(false)
      }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      className="group relative w-full rounded-2xl px-5 py-3 transition-all duration-100 touch-manipulation"
      style={{
        transform: isPressed ? "translateY(2px)" : "translateY(0)",
      }}
    >
      {/* Ambient glow background - blue glow with reduced range */}
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl blur-xl transition-opacity duration-300"
        style={{
          background: `radial-gradient(300px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(59, 130, 246, 0.12), transparent 60%)`,
          opacity: isHovering ? 1 : 0,
          zIndex: -2,
        }}
      />

      {/* Main button background with deep blue gradient */}
      <div
        className="absolute inset-0 rounded-2xl transition-all duration-100"
        style={{
          background: isHovering
            ? "linear-gradient(135deg, rgba(18, 38, 95, 0.95) 0%, rgba(10, 22, 65, 0.95) 100%)"
            : "linear-gradient(135deg, rgba(12, 30, 80, 0.95) 0%, rgba(6, 15, 50, 0.95) 100%)",
          boxShadow: isPressed
            ? "0 8px 16px rgba(0, 0, 0, 0.8), inset 0 2px 4px rgba(0, 0, 0, 0.6)"
            : isHovering
              ? "0 20px 40px rgba(0, 0, 0, 0.8), 0 0 30px rgba(59, 130, 246, 0.15)"
              : "0 12px 24px rgba(0, 0, 0, 0.8)",
        }}
      />

      {/* Outer border */}
      <div
        className="absolute inset-0 rounded-2xl border border-blue-700 transition-all duration-100 pointer-events-none"
        style={{
          boxShadow: isHovering ? `0 0 12px rgba(59, 130, 246, 0.2)` : "none",
        }}
      />

      {/* Inner decorative border - light blue, highlights on selection */}
      <div
        className="absolute inset-0 rounded-2xl border border-blue-600 transition-all duration-100 pointer-events-none"
        style={{
          opacity: isHovering || isPressed ? 0.8 : 0.15,
          boxShadow: isHovering || isPressed ? `inset 0 0 12px rgba(59, 130, 246, 0.15)` : "none",
        }}
      />

      {/* Inner glow line at top (light reflection) */}
      <div
        className="absolute inset-x-0 top-0 h-1/3 rounded-t-2xl bg-gradient-to-b from-white/8 via-white/3 to-transparent transition-opacity duration-100 pointer-events-none"
        style={{
          opacity: isPressed ? 0.2 : isHovering ? 1 : 0.5,
        }}
      />

      {/* Bottom shadow effect */}
      <div className="absolute inset-x-0 bottom-0 h-1/4 rounded-b-2xl bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />

      {/* Hover glow spot effect - blue glow */}
      <div
        className="absolute inset-0 rounded-2xl transition-opacity duration-150 pointer-events-none"
        style={{
          background: isHovering
            ? `radial-gradient(150px circle at ${mousePosition.x}px ${mousePosition.y}px, 
                rgba(147, 197, 253, 0.15) 0%, 
                rgba(59, 130, 246, 0.05) 40%, 
                transparent 70%)`
            : "transparent",
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Icon
            className="h-6 w-6 flex-shrink-0 transition-all duration-200"
            style={{
              color: isPressed ? "#60a5fa" : isHovering ? "#93c5fd" : "#3b82f6",
              filter: isHovering ? "drop-shadow(0 0 6px rgba(59, 130, 246, 0.4))" : "none",
            }}
          />
          <div className="flex flex-col items-start">
            <div className="text-left text-sm font-semibold text-white">{title}</div>
            <div
              className="text-left text-xs transition-colors duration-200"
              style={{
                color: isHovering ? "#93c5fd" : "#71717a",
              }}
            >
              {subtitle}
            </div>
          </div>
        </div>
        <ChevronRight
          className="h-5 w-5 flex-shrink-0 transition-all duration-200"
          style={{
            color: isPressed ? "#60a5fa" : isHovering ? "#93c5fd" : "#71717a",
          }}
        />
      </div>
    </button>
  )
}
