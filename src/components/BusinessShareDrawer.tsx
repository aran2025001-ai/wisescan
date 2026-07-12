/**
 * BusinessShareDrawer — 商业模式拆解分享抽屉组件
 *
 * 功能：点击"分享拆解结果" → 展示 BusinessShareCard 全屏预览 → 底部抽屉弹窗 → 保存/分享到社交渠道
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BusinessShareCard } from './BusinessShareCard';
import { capturePosterToImageUrl } from '../utils/share-poster-image';

// ============================================================
// 分享渠道配置
// ============================================================

const Channels = [
  {
    id: 'wechat',
    label: '微信',
    iconBg: '#07C160',
    iconUrl: 'https://cdn.simpleicons.org/wechat/ffffff',
  },
  {
    id: 'qq',
    label: 'QQ',
    iconBg: '#12B7F5',
    iconUrl: 'https://cdn.simpleicons.org/qq/ffffff',
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    iconBg: '#25D366',
    iconUrl: 'https://cdn.simpleicons.org/whatsapp/ffffff',
  },
  {
    id: 'telegram',
    label: 'Telegram',
    iconBg: '#0088CC',
    iconUrl: 'https://cdn.simpleicons.org/telegram/ffffff',
  },
  {
    id: 'more',
    label: '更多',
    iconBg: '#6B7280',
    iconSvg: (
      <svg viewBox="0 0 24 24" width="26" height="26" fill="#fff">
        <circle cx="12" cy="5" r="2"/>
        <circle cx="12" cy="12" r="2"/>
        <circle cx="12" cy="19" r="2"/>
      </svg>
    ),
  },
];

// ============================================================
// Props
// ============================================================

interface BusinessShareDrawerProps {
  reportData: any;
  trigger?: React.ReactNode;
  label?: string;
  className?: string;
  /** 邀请码（用于生成二维码链接 → 分享者获得邀请收益） */
  inviteCode?: string;
}

// ============================================================
// 主组件
// ============================================================

export default function BusinessShareDrawer({
  reportData,
  trigger,
  label = '分享拆解结果',
  className = '',
  inviteCode,
}: BusinessShareDrawerProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [showSheet, setShowSheet] = useState(false);
  const [toast, setToast] = useState('');
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; channel: string }>({ open: false, channel: '' });
  const [shortCode, setShortCode] = useState<string>('');
  const [posterImageUrl, setPosterImageUrl] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const scaleContainerRef = useRef<HTMLDivElement>(null);
  const posterNodeRef = useRef<HTMLDivElement>(null);
  const hasGeneratedRef = useRef(false);

  // ── 海报缩放：卡片固定 375px 渲染，scale 到 85vw 容器 ──
  const [cardScale, setCardScale] = useState(() => {
    if (typeof window === 'undefined') return 1;
    return Math.min(window.innerWidth * 0.85, 375) / 375;
  });

  useEffect(() => {
    const el = scaleContainerRef.current;
    if (!el || !showPreview) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setCardScale(entry.contentRect.width / 375);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [showPreview]);

  // ── 从 reportData 提取信息 ──
  const shareCard = reportData?.share_card || {};
  const projectName = shareCard.project_name || '未命名';
  const reportId = reportData?.id || '';

  // ── Toast 自动消失 ──
  useEffect(() => {
    if (toast) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setToast(''), 2000);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [toast]);

  // ── 基础 URL ──
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://wisescan.xyz';
  // 二维码内容：带邀请码的欢迎页（分享者获得邀请收益）
  const qrContentUrl = inviteCode ? `${baseUrl}/invite?code=${inviteCode}` : baseUrl;
  // 优先使用短链接，回退到长链接（给用户去分享的链接）
  const posterParams = new URLSearchParams({
    type: 'business',
    name: projectName,
    pattern: shareCard.pattern_type || '',
    structure: shareCard.structure || '',
    rules: shareCard.rule_summary || '',
    watch: Array.isArray(shareCard.watch_points) ? shareCard.watch_points.join('·') : '',
    rid: reportId,
  });
  const longUrl = `${baseUrl}/share/poster?${posterParams.toString()}`;
  const shareUrl = shortCode ? `${baseUrl}/s/${shortCode}` : longUrl;

  // ── 生成海报 PNG 图片 + 短链接（预览打开时异步创建）──
  useEffect(() => {
    if (!showPreview || shortCode || isGenerating || hasGeneratedRef.current) return;
    const node = posterNodeRef.current;
    if (!node) return;
    hasGeneratedRef.current = true;
    setIsGenerating(true);

    const posterData = {
      type: 'business',
      data: {
        name: projectName,
        pattern: shareCard.pattern_type || '',
        structure: shareCard.structure || '',
        rules: shareCard.rule_summary || '',
        watch: Array.isArray(shareCard.watch_points) ? shareCard.watch_points.join('·') : '',
        rid: reportId,
      },
    };

    const generate = async () => {
      try {
        // ── Phase 1：预生成短码，让二维码先渲染短链接 ──
        const ts = Date.now().toString(36).slice(-4);
        const rand = Math.random().toString(36).slice(2, 6);
        const preCode = `${ts}${rand}`;
        setShortCode(preCode);

        // ── Phase 2：等 React 渲染 + 二维码稳定 ──
        await new Promise(r => setTimeout(r, 600));
        const imageUrl = await capturePosterToImageUrl(node, { scale: 4 });
        setPosterImageUrl(imageUrl);

        // ── Phase 3：用预生成短码创建短链（含 imageUrl） ──
        await fetch('/api/shorten', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientCode: preCode, ...posterData, imageUrl }),
        });
      } catch (e) {
        console.warn('[BusinessShareDrawer] generate poster image failed:', e);
      } finally {
        setIsGenerating(false);
      }
    };

    generate();
  }, [showPreview, shortCode, isGenerating, projectName, shareCard.pattern_type, shareCard.structure, shareCard.rule_summary, shareCard.watch_points, reportId]);

  // ── 分享文案 ──
  const shareText = (() => {
    const pType = shareCard.pattern_type || '未知';
    const struct = shareCard.structure || '无';
    return `明鉴WiseScan — 我正在拆解${projectName}\n\n📊 ${projectName}商业模式基本情报：\n模式类型：${pType}\n层级结构：${struct}\n\n点击查看完整商业模式基本情报：\n${shareUrl}\n\n如果要查看${projectName}的完整商业模式拆解报告，请扫码进入明鉴进行查看。`;
  })();

  // ── 渠道标签 & 颜色 ──
  const channelLabel: Record<string, string> = { wechat: '微信', qq: 'QQ', whatsapp: 'WhatsApp', telegram: 'Telegram' };
  const channelColor: Record<string, string> = { wechat: '#07C160', qq: '#12B7F5', whatsapp: '#25D366', telegram: '#0088CC' };

  // ── 复制文本 ──
  const doCopy = useCallback((text: string) => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    } else {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  }, []);

  // ── 核心分享逻辑 ──
  const doShare = useCallback(async (method: string) => {
    setShowSheet(false);
    try {
      switch (method) {
        case 'more': {
          if (navigator.share) {
            try {
              await navigator.share({ title: `明鉴 WiseScan - ${projectName}`, text: shareText, url: shareUrl });
              setToast('✅ 分享成功！');
              return;
            } catch { /* 用户取消 */ }
          }
          doCopy(shareText);
          setToast('📋 文案已复制！');
          return;
        }
        default: return;
      }
    } catch (e) {
      console.warn('[BusinessShareDrawer] share error:', e);
      setToast('分享失败，请重试');
    }
  }, [projectName, shareText, shareUrl, doCopy]);

  // ── 渠道点击：复制文案 → 确认弹窗 ──
  const handleChannelClick = useCallback((channelId: string) => {
    if (isGenerating) {
      setToast('海报图片生成中，请稍候...');
      return;
    }
    if (channelId === 'wechat' || channelId === 'qq' || channelId === 'whatsapp' || channelId === 'telegram') {
      doCopy(shareText);
      setConfirmModal({ open: true, channel: channelId });
      setShowSheet(false);
    } else {
      doShare(channelId);
    }
  }, [shareText, doCopy, doShare, isGenerating]);

  const handleConfirmOk = useCallback(() => {
    const ch = confirmModal.channel;
    const chLabel = channelLabel[ch] || ch;
    setConfirmModal({ open: false, channel: '' });
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (isMobile) {
      // 手机端：文案已在渠道点击时复制，直接提示
      setToast(`📋 文案已复制！请打开${chLabel}并粘贴发送`);
      return;
    }

    // PC 端：尝试唤起桌面客户端
    if (ch === 'wechat') {
      try { window.location.href = 'weixin://'; } catch {}
      setToast('📋 文案已复制！正在打开微信...');
    } else if (ch === 'qq') {
      try { window.location.href = 'mqqapi://'; } catch {}
      setToast('📋 文案已复制！正在打开QQ...');
    } else if (ch === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank', 'noopener,noreferrer');
      setToast('📋 文案已复制！正在打开 WhatsApp...');
    } else if (ch === 'telegram') {
      window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`, '_blank', 'noopener,noreferrer');
      setToast('📋 文案已复制！正在打开 Telegram...');
    }
  }, [confirmModal.channel, shareText, shareUrl, channelLabel]);

  const closeAll = () => {
    setShowPreview(false);
    setShowSheet(false);
  };

  /** 保存海报图片（直接下载，不跳浏览器） */
  const handleSaveImage = useCallback(() => {
    const src = posterImageUrl || '';
    if (!src) { setToast('图片尚未生成，请稍候'); return }
    try {
      const a = document.createElement('a');
      a.href = src;
      a.download = `明鉴-${projectName || '项目'}-拆解卡片.png`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch (e) {
      setToast('保存失败，请截图保存');
    }
  }, [posterImageUrl, projectName]);

  const handleClick = () => {
    hasGeneratedRef.current = false;
    setShortCode('');
    setPosterImageUrl('');
    setIsGenerating(false);
    setShowPreview(true);
  };

  return (
    <>
      {/* ── 触发按钮 ── */}
      {trigger ? (
        <div onClick={handleClick} style={{ cursor: 'pointer' }}>
          {trigger}
        </div>
      ) : (
        <button onClick={handleClick} className={className}>
          {label}
        </button>
      )}

      {/* ═══ 状态1：全屏 BusinessShareCard 预览 ═══ */}
      {showPreview && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-start pt-[10vh] px-6">
          <div ref={scaleContainerRef} className="relative rounded-2xl shadow-2xl"
            style={{ width: '85vw', maxWidth: 375, overflow: 'hidden' }}>
            <div ref={posterNodeRef} style={{
              width: 375,
              transform: `scale(${cardScale})`,
              transformOrigin: 'top left',
            }}>
              <BusinessShareCard reportData={reportData} width={375} qrCodeUrl={qrContentUrl} />
            </div>

            {/* 顶部返回按钮 */}
            <button onClick={closeAll}
              className="absolute flex items-center justify-center rounded-full"
              style={{ top: '2%', left: '2%', width: 36, height: 36, background: 'rgba(0,0,0,0.3)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>

            {/* 右上角分享按钮 → 打开抽屉 */}
            <button onClick={() => setShowSheet(true)}
              className="absolute flex items-center justify-center rounded-full"
              style={{ top: '2%', right: '2%', width: 36, height: 36, background: 'rgba(0,0,0,0.3)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
            </button>
          </div>

          {/* 海报生成状态提示 */}
          {isGenerating && (
            <div className="mt-4 flex items-center gap-2 text-white/80 text-xs">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
              <span>正在生成分享图片...</span>
            </div>
          )}
          {!isGenerating && shortCode && posterImageUrl && (
            <div className="mt-3 text-white/60 text-[13px]">分享图片已生成</div>
          )}
        </div>,
        document.body
      )}

      {/* ═══ 状态2：底部分享抽屉 ═══ */}
      {showSheet && createPortal(
        <div className="fixed inset-0 z-[99999]" onClick={() => setShowSheet(false)}>
          <div className="absolute inset-0 bg-black/50"/>
          <div className="absolute bottom-0 left-0 right-0 rounded-t-3xl px-5 pt-3 pb-6 animate-slide-up"
            style={{ background: 'linear-gradient(180deg,#F0F4FC 0%,#E4ECFA 100%)', maxWidth: 430, margin: '0 auto' }}
            onClick={e => e.stopPropagation()}>

            {/* 拖拽条 + 右上角关闭 */}
            <div className="flex items-center mb-4">
              <div className="flex-1 flex justify-center">
                <div className="w-10 h-1 rounded-full opacity-40" style={{ background: '#8899AA' }}/>
              </div>
              <button onClick={() => setShowSheet(false)}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-black/10 hover:bg-black/15 active:scale-95 transition-all absolute right-5">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#666" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* 卡片预览 */}
            <div className="bg-white rounded-2xl p-4 shadow-sm mb-5">
              <div className="text-sm font-semibold text-gray-800">
                明鉴-{projectName}-商业模式拆解
              </div>
              <div className="text-xs text-gray-400 mt-0.5">商业模式拆解分享卡片</div>
              <div className="flex justify-center mt-3">
                <div className="rounded-xl overflow-hidden shadow-md" style={{ width: 150, height: Math.round(150 * 2000 / 1125) }}>
                  <BusinessShareCard reportData={reportData} width={150} qrCodeUrl={qrContentUrl} />
                </div>
              </div>
            </div>

            {/* 分享渠道 */}
            <div className="flex justify-around items-start px-1 mb-4">
              {Channels.map(ch => (
                <button key={ch.id} onClick={() => handleChannelClick(ch.id)}
                  className="flex flex-col items-center gap-1 active:scale-95 transition-transform">
                  <div className="rounded-xl flex items-center justify-center overflow-hidden shadow-sm"
                    style={{ width: 44, height: 44, background: ch.iconBg }}>
                    {'iconSvg' in ch ? (
                      ch.iconSvg
                    ) : (
                      <img src={ch.iconUrl} alt={ch.label}
                        style={{ width: 26, height: 26 }}
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}/>
                    )}
                  </div>
                  <span className="text-[13px] text-gray-600 mt-0.5">{ch.label}</span>
                </button>
              ))}
            </div>

            {/* 底部操作按钮：保存图片 + 关闭 */}
            <div className="flex gap-3 mt-4">
              <button onClick={handleSaveImage}
                className="flex-1 h-11 rounded-xl bg-blue-500 text-white text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.97] transition-transform">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                保存图片
              </button>
              <button onClick={() => setShowSheet(false)}
                className="flex-1 h-11 rounded-xl border border-gray-300 text-gray-600 text-sm font-medium flex items-center justify-center gap-2 active:scale-[0.97] transition-transform">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
                关闭
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ═══ 确认弹窗（微信/QQ/WhatsApp/Telegram）═══ */}
      {confirmModal.open && createPortal(
        <div className="fixed inset-0 z-[999999] flex items-center justify-center" onClick={() => setConfirmModal({ open: false, channel: '' })}>
          <div className="absolute inset-0 bg-black/50"/>
          <div className="relative bg-white rounded-2xl w-[85vw] max-w-xs p-6 text-center shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center"
              style={{ background: channelColor[confirmModal.channel] || '#6B7280' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
            </div>
            <div className="text-base font-semibold text-gray-800 mb-2">
              分享到{channelLabel[confirmModal.channel] || confirmModal.channel}
            </div>
            <div className="text-sm text-gray-500 leading-relaxed mb-5">
              文案已复制，请在弹出的{channelLabel[confirmModal.channel] || confirmModal.channel}中选择好友并粘贴发送
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmModal({ open: false, channel: '' })}
                className="flex-1 h-11 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors">
                取消
              </button>
              <button onClick={handleConfirmOk}
                className="flex-1 h-11 rounded-xl text-white text-sm font-semibold transition-colors active:scale-[0.97]"
                style={{ background: channelColor[confirmModal.channel] || '#6B7280' }}>
                确定
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Toast 提示 */}
      {toast && createPortal(
        <div className="fixed top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[999999] pointer-events-none">
          <div className="bg-black/80 backdrop-blur rounded-xl px-6 py-4 text-center">
            <svg className="w-7 h-7 text-green-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
            </svg>
            <div className="text-white text-sm whitespace-pre-line text-center leading-relaxed">{toast}</div>
          </div>
        </div>,
        document.body
      )}

      <style>{`
        @keyframes slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .animate-slide-up { animation: slide-up 0.25s ease-out; }
      `}</style>
    </>
  );
}
