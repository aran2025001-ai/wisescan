/**
 * ShareCard — 项目情报分享卡片
 *
 * 设计：使用原版设计底图（share-card-bg.png）做背景，
 *       只在白色卡片和底部蓝色区域内叠加动态文字和二维码。
 *
 * 底图尺寸：941×1672px
 * 容器（375px宽）：375 × 666.4px
 *
 * ════ 定位规则（top% 基于容器高度 666px）════
 * 白色卡片起点 ~ 265px → ~40%
 *   项目名称值     → top: 42%
 *   合约地址值     → top: 48.5%
 *   TOP10值       → top: 55.3%
 *   信息完整度值   → top: 62.2%
 *   点评内容       → top: 70.8%
 * 底部蓝色区二维码 → bottom: 4%
 */

import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

// ============================================================
// Props 类型定义
// ============================================================

export interface ShareCardProps {
  /** 项目名称 */
  projectName: string;
  /** 合约地址（自动脱敏为 0x1234567890****89ABCD 格式） */
  contractAddress: string;
  /** TOP10 持仓占比数字（如 91.2） */
  top10Holding: number;
  /** 集中度描述（如 "高度集中" / "中度集中" / "分布较分散"） */
  riskLevel: string;
  /** 风险色（影响小圆点和文字颜色） */
  riskColor?: 'red' | 'orange' | 'yellow' | 'green';
  /** 信息完整性百分比（如 60） */
  infoCompleteness: number;
  /** 完整性等级描述（如 "中等" / "较高"） */
  completenessLevel: string;
  /** 简短点评（≤80 字，超出用省略号） */
  review: string;
  /** 二维码链接（如 https://wisescan.xyz/library?address=0x...） */
  qrCodeUrl: string;
  /** 容器宽度，默认 375（移动端）。截图时用 600+ */
  width?: number;
  /** 额外 className */
  className?: string;
}

// ============================================================
// 辅助函数
// ============================================================

/** 短格式脱敏：0x9123456789****89F492 */
const shortAddress = (addr: string): string => {
  if (!addr || addr.length < 16) return addr;
  return `${addr.slice(0, 10)}****${addr.slice(-8)}`;
};

/** 百分比智能格式化：最多1位小数、超100%截断到100% */
const fmtPct = (v: number) => {
  const clamped = Math.min(Math.max(0, Number(v) || 0), 100);
  return clamped % 1 === 0 ? `${Math.round(clamped)}%` : `${clamped.toFixed(1)}%`;
};

/** 风险色映射 */
const COLORS: Record<string, { dot: string; text: string }> = {
  red:    { dot: '#EF4444', text: '#EF4444' },
  orange: { dot: '#F97316', text: '#F97316' },
  yellow: { dot: '#EAB308', text: '#CA8A04' },
  green:  { dot: '#22C55E', text: '#22C55E' },
};

// ============================================================
// 主组件
// ============================================================

export const ShareCard: React.FC<ShareCardProps> = ({
  projectName,
  contractAddress,
  top10Holding,
  riskLevel,
  riskColor = 'red',
  infoCompleteness,
  completenessLevel,
  review,
  qrCodeUrl,
  width = 375,
  className = '',
}) => {
  const s = width / 375; // 缩放因子
  const clr = COLORS[riskColor] || COLORS.red;

  /* ━━━ 公共右侧间距（所有值统一，避免贴边）━━━ */
  const valRight = '9.6%';

  return (
    <div
      className={`relative ${className}`}
      style={{
        width,
        aspectRatio: '941 / 1672',
        backgroundImage: 'url(/share-card-bg.png)',
        backgroundSize: '100% 100%',
        backgroundRepeat: 'no-repeat',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Helvetica Neue", sans-serif',
      }}
    >
      {/* ═══ 项目名称（第 1 行，与左侧"项目名称"标签同高）═══ */}
      <div
        style={{
          position: 'absolute',
          right: valRight,
          top: '41.7%',
          maxWidth: '60%',
          fontSize: Math.round(14 * s),
          fontWeight: 600,
          color: '#374151',
          lineHeight: 1.3,
          textAlign: 'right',
          overflow: 'visible',
          wordBreak: 'break-word',
        }}
      >
        {projectName}
      </div>

      {/* ═══ 合约地址（第 2 行，与左侧"合约地址"标签同高）═══ */}
      <div
        style={{
          position: 'absolute',
          right: valRight,
          top: '48.85%',
          maxWidth: '46%',
          fontSize: Math.round(13 * s),
          fontWeight: 'normal',
          fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Helvetica Neue", sans-serif',
          color: '#475569',
          lineHeight: 1.45,
          textAlign: 'right',
          wordBreak: 'break-all',
          letterSpacing: '0.02em',
        }}
      >
        {shortAddress(contractAddress)}
      </div>

      {/* ═══ TOP10 持仓占比（第 3 行：● 百分比 · 等级）═══ */}
      <div
        style={{
          position: 'absolute',
          right: valRight,
          top: '56.62%',
          display: 'flex',
          alignItems: 'center',
          gap: Math.round(5 * s),
        }}
      >
        <span
          style={{ width: Math.round(7 * s), height: Math.round(7 * s), borderRadius: '50%', backgroundColor: clr.dot, flexShrink: 0 }}
        />
        <span style={{ fontSize: Math.round(13 * s), fontWeight: 600, color: clr.text, whiteSpace: 'nowrap' }}>
          {fmtPct(top10Holding)}
        </span>
        <span style={{ fontSize: Math.round(11.5 * s), color: clr.text, whiteSpace: 'nowrap' }}>
          · {riskLevel}
        </span>
      </div>

      {/* ═══ 信息完整性（第 4 行）═══ */}
      <div
        style={{
          position: 'absolute',
          right: valRight,
          top: '63.67%',
          display: 'flex',
          alignItems: 'center',
          gap: Math.round(5 * s),
        }}
      >
        <span style={{ fontSize: Math.round(13 * s), fontWeight: 600, color: '#334155', whiteSpace: 'nowrap' }}>
          {fmtPct(infoCompleteness)}
        </span>
        <span style={{ fontSize: Math.round(11.5 * s), color: '#94A3B8', whiteSpace: 'nowrap' }}>
          · {completenessLevel}
        </span>
      </div>

      {/* ═══ 点评内容（蓝色圆角框内，左对齐，不贴两边）═══ */}
      <div
        style={{
          position: 'absolute',
          left: '21.74%',
          right: '9.5%',
          top: '74.56%',
          fontSize: Math.round(11 * s),
          fontWeight: 400,
          color: '#1E293B',
          lineHeight: 1.45,
          letterSpacing: '-0.03em',
          maxHeight: Math.round(11 * s * 1.45 * 3),
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: '3',
          WebkitBoxOrient: 'vertical' as any,
        }}
      >
        {review}
      </div>

      {/* ═══ 二维码（底部蓝色区，白底圆角，靠左下 · px 精准定位）═══ */}
      <div
        style={{
          position: 'absolute',
          right: Math.round(41 * s),
          bottom: Math.round(37 * s),
          width: Math.round(55 * s),
          height: Math.round(55 * s),
          backgroundColor: '#fff',
          borderRadius: Math.round(6 * s),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: Math.round(3 * s),
        }}
      >
        <QRCodeSVG value={qrCodeUrl} size={Math.round(49 * s)} level="M" includeMargin={false} />
      </div>
    </div>
  );
};

export default ShareCard;
