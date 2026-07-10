/**
 * BusinessShareCard — 商业模式拆解分享卡片
 *
 * 底图：「business-share-bg.png」（从「分享画面生成3 空白.png」复制）
 * 渲染容器：width × (width * 2000/1125)，默认 375×667
 *
 * 定位方式：px 级绝对定位（left 对齐）
 * 底图已有标签名 → 本组件只渲染动态值
 */

import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

export interface BusinessShareCardProps {
  reportData: any;
  width?: number;
  className?: string;
  /** 二维码链接。传短链接（/s/xxx）或报告详情页链接。如果不传则自动用 /profile/business-models/:id */
  qrCodeUrl?: string;
}

/** 通用截断（不加省略号） */
function truncate(str: string, maxLen: number): string {
  if (!str) return str;
  return str.length > maxLen ? str.slice(0, maxLen) : str;
}

/**
 * 规则描述二次清洗函数
 * 只去除明显的动词/连接词，保留核心数字和规则关键词
 * 截断上限：10个字符（如"直推10%间推5%"=9字符）
 */
function cleanRuleSummary(text: string): string {
  if (!text) return '';

  // 只去除明显的废话连接词，不过度删除业务词汇
  let cleaned = text
    .replace(/用户可以通过/g, '')
    .replace(/用户可以/g, '')
    .replace(/需要通过/g, '')
    .replace(/通过/g, '')
    .replace(/进行/g, '')
    .replace(/操作/g, '')
    .replace(/需要/g, '')
    .replace(/可以/g, '')
    // 去除空白和标点
    .replace(/\s+/g, '')
    .replace(/[，。、；,.（）()【】\[\]]/g, '');

  // 超过10个字符直接截断（不加省略号）
  return cleaned.length > 10 ? cleaned.slice(0, 10) : cleaned;
}

/**
 * 需关注维度二次清洗函数
 * 每个标签最多4个字，不加省略号
 * 最多展示3个标签
 */
function cleanWatchPoints(points: string[]): string[] {
  if (!points || points.length === 0) return [];

  return points
    .map(p => p.replace(/\s+/g, '').replace(/[，。、；,.（）()【】\[\]]/g, ''))
    .filter(p => p.length > 0)
    .map(p => p.length > 4 ? p.slice(0, 4) : p)
    .slice(0, 3);
}

/**
 * 从文本中提取项目名称（纯代号/名称）
 */
function extractProjectName(text: string): string | null {
  if (!text) return null;

  // 模式1：显式标注 → "项目叫XXX"、"名为XXX"
  const explicitPatterns = [
    /项目叫[：:\s]*([A-Za-z0-9\u4e00-\u9fff]{1,10})/,
    /名为[：:\s]*([A-Za-z0-9\u4e00-\u9fff]{1,10})/,
    /项目名[称]?[：:\s]*([A-Za-z0-9\u4e00-\u9fff]{1,10})/,
    /平台[：:\s]*([A-Za-z0-9\u4e00-\u9fff]{1,10})/,
  ];
  for (const re of explicitPatterns) {
    const m = text.match(re);
    if (m?.[1]) return m[1];
  }

  // 模式2：文本开头就是项目名 + 描述词
  const startPatterns = [
    /^([A-Z][A-Za-z0-9]{1,10})(?=[\s，。是的一个基于平台叫做])/,
    /^([A-Z][A-Z0-9]{1,10})是基于/,
    /叫([A-Za-z0-9\u4e00-\u9fff]{1,10})[的\s]/,
    /([A-Za-z]{2,10})(?:代币|Token|token|币|项目)/,
  ];
  for (const re of startPatterns) {
    const m = text.match(re);
    if (m?.[1] && m[1].length <= 10) return m[1];
  }

  // 模式3：开头连续大写英文+数字
  const codeMatch = text.match(/^([A-Z][A-Z0-9]{1,10})/);
  if (codeMatch && codeMatch[1].length >= 2 && codeMatch[1].length <= 10) {
    return codeMatch[1];
  }

  return null;
}

export const BusinessShareCard: React.FC<BusinessShareCardProps> = ({
  reportData,
  width = 375,
  className = '',
  qrCodeUrl,
}) => {
  const s = width / 375;

  // ── 数据读取 ──
  const shareCard = reportData?.share_card || {};

  // ── 项目名称提取（优先级：数据库 → AI → 文本）──
  let projectName: string | null = null;

  // ★ 策略0：优先用数据库值 reportData.project_name（最可靠，前端传什么就存什么）
  if (reportData?.project_name &&
      reportData.project_name !== '用户自定义' &&
      reportData.project_name !== '未命名项目' &&
      reportData.project_name.length >= 2) {
    const trimmed = reportData.project_name.slice(0, 10);
    if (!/是|的|一个|基于|平台|叫做|项目叫|名为|具有|典型/.test(trimmed)) {
      projectName = trimmed;
    }
  }

  // 策略1：如果 share_card.project_name 本身就是有效的短名称，直接用
  if (!projectName && shareCard.project_name &&
      shareCard.project_name !== '用户自定义' &&
      shareCard.project_name !== '未命名项目' &&
      shareCard.project_name.length >= 2 &&
      shareCard.project_name.length <= 10 &&
      !/是|的|一个|基于|平台|叫做|项目叫|名为|具有|典型/.test(shareCard.project_name)) {
    projectName = shareCard.project_name;
  }

  // 策略2~5：多来源提取（兜底）
  const sources = [
    reportData?.project_name,
    shareCard.project_name,
    reportData?.plain_explanation,
    shareCard.rule_summary,
  ];
  for (const src of sources) {
    if (projectName) break;
    if (!src || src === '用户自定义' || src === '未命名项目') continue;
    const extracted = extractProjectName(src);
    if (extracted && extracted.length >= 2 && extracted.length <= 10) {
      projectName = extracted;
    }
  }

  // 兜底
  if (!projectName) projectName = '未命名';
  if (projectName && /是|的|一个|基于|平台|叫做|项目叫|名为|具有|典型/.test(projectName)) {
    projectName = '未命名';
  }
  if (projectName.length > 10) projectName = truncate(projectName, 10);

  // ── 其他字段（share_card 优先，reportData 兜底）──
  const patternType = shareCard.pattern_type || reportData?.pattern_type || null;

  // 层级结构：去除括号说明
  const structure = shareCard.structure
    ? shareCard.structure.replace(/[（(][^)）]*[)）]/g, '').trim()
    : reportData?.structure || null;

  // 规则描述：二次清洗（share_card 为空时从 plain_explanation 提取摘要）
  const ruleSummaryRaw = shareCard.rule_summary || null;
  const ruleSummary = ruleSummaryRaw
    ? cleanRuleSummary(ruleSummaryRaw)
    : reportData?.rule_summary
      ? cleanRuleSummary(reportData.rule_summary)
      : null;

  // 需关注维度：二次清洗（share_card 为空时从 risk_assessment 提取）
  const watchPointsRaw = (shareCard.watch_points && Array.isArray(shareCard.watch_points))
    ? shareCard.watch_points
    : (reportData?.watch_points && Array.isArray(reportData.watch_points))
      ? reportData.watch_points
      : [];
  const watchPoints = cleanWatchPoints(watchPointsRaw);

  // ── 二维码链接 ──
  // 优先使用外部传入的短链接（/s/xxx），否则用详情页 URL
  const originRaw = typeof window !== 'undefined' ? window.location.origin : 'https://wisescan.xyz';
  const LOCAL_PATTERN = /^(https?:\/\/)(localhost|127\.|192\.168\.|10\.|0\.0\.0\.0)/;
  const baseUrl = LOCAL_PATTERN.test(originRaw) ? 'https://wisescan.xyz' : originRaw;
  const reportId = reportData?.id || '';
  const qrUrl = qrCodeUrl || (inviteCode ? `${baseUrl}/invite?code=${inviteCode}` : baseUrl);

  /* 统一左边距（恢复原始值，不左右移动） */
  const valLeft = Math.round(175 * s);

  return (
    <div
      className={`relative ${className}`}
      style={{
        width,
        aspectRatio: '1125 / 2000',
        fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Helvetica Neue", sans-serif',
      }}
    >
      {/* ═══ 底图 ═══ */}
      <img src="/business-share-bg.png" alt="" style={{
        position: 'absolute', top: 0, left: 0,
        width: '100%', height: '100%',
        objectFit: 'cover', pointerEvents: 'none',
      }} />

      {/* ═══ 1. 项目名称（单行 ≤10字）═══ */}
      {projectName && (
        <div style={{
          position: 'absolute',
          left: valLeft,
          top: Math.round(282 * s),
          maxWidth: '55%',
          fontSize: projectName === '未命名' ? Math.round(12 * s) : Math.round(13 * s),
          fontWeight: 600,
          color: '#374151',
          lineHeight: 1.5,
          textAlign: 'left',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          paddingBottom: Math.round(2 * s),
        }}>
          {projectName}
        </div>
      )}

      {/* ═══ 2. 模式类型（单行 ≤16字）═══ */}
      {patternType && (
        <div style={{
          position: 'absolute',
          left: valLeft,
          top: Math.round(334 * s),
          maxWidth: '58%',
          fontSize: Math.round(12 * s),
          fontWeight: 500,
          color: '#374151',
          lineHeight: 1.6,
          textAlign: 'left',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          paddingBottom: Math.round(2 * s),
        }}>
          {truncate(patternType, 16)}
        </div>
      )}

      {/* ═══ 3. 层级结构（最多2行 ≤24字）═══ */}
      {structure && (
        <div style={{
          position: 'absolute',
          left: valLeft,
          top: Math.round(385 * s),
          maxWidth: '52%',
          fontSize: Math.round(12 * s),
          fontWeight: 400,
          color: '#4B5563',
          lineHeight: 1.6,
          textAlign: 'left',
          wordBreak: 'break-word',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          paddingBottom: Math.round(2 * s),
        }}>
          {truncate(structure, 24)}
        </div>
      )}

      {/* ═══ 4. 规则描述（最多2行，清洗后≤10字）═══ */}
      {ruleSummary && (
        <div style={{
          position: 'absolute',
          left: valLeft,
          top: Math.round(437 * s),
          maxWidth: '52%',
          fontSize: Math.round(12 * s),
          fontWeight: 400,
          color: '#4B5563',
          lineHeight: 1.6,
          textAlign: 'left',
          wordBreak: 'break-word',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          paddingBottom: Math.round(2 * s),
        }}>
          {ruleSummary}
        </div>
      )}

      {/* ═══ 5. 需关注维度（红色警示，最多2行）═══ */}
      {watchPoints.length > 0 && (
        <div style={{
          position: 'absolute',
          left: valLeft,
          top: Math.round(493 * s),
          maxWidth: '52%',
          fontSize: Math.round(11.5 * s),
          fontWeight: 600,
          color: '#DC2626',
          lineHeight: 1.6,
          textAlign: 'left',
          wordBreak: 'break-word',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          paddingBottom: Math.round(2 * s),
        }}>
          {watchPoints.join(' · ')}
        </div>
      )}

      {/* ═══ 二维码（右下角 · 初始位置）═══ */}
      <div style={{
        position: 'absolute',
        right: Math.round(41 * s),   // ← 恢复原始位置
        bottom: Math.round(37 * s),  // ← 初始位置（不再乱动）
        width: Math.round(55 * s),
        height: Math.round(55 * s),
        backgroundColor: '#fff',
        borderRadius: Math.round(6 * s),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: Math.round(3 * s),
      }}>
        <QRCodeSVG value={qrUrl} size={Math.round(49 * s)} level="M" includeMargin={false} />
      </div>
    </div>
  );
};

export default BusinessShareCard;
