/**
 * share-poster-image.ts
 *
 * 把海报 DOM 节点截图成 PNG，上传到 Supabase Storage，返回同域相对路径。
 * 用于微信/QQ/WhatsApp/Telegram 等社交渠道分享时，让短链最终指向一张图片。
 *
 * 关键处理：
 * - 截图前临时移除 CSS transform（避免 html2canvas 受 scale 影响导致截图错位/截断）
 * - 截图后恢复 transform
 * - 返回 `/posters/filename.png` 同域相对路径（避免微信跳转时弹出"将要访问"确认）
 */

import html2canvas from 'html2canvas';

export interface CaptureOptions {
  /** html2canvas 缩放倍数，默认 3（375px 海报 → 1125px，接近 1080×1920） */
  scale?: number;
}

/** Supabase Storage 对象存储桶的公开访问前缀 */
const SUPABASE_STORAGE_BASE = 'https://vzzjirfhcfzelvlwauln.supabase.co/storage/v1/object/public/share-posters/';

/**
 * 将 Supabase 完整 URL 转为同域代理路径
 * https://xxx.supabase.co/.../share-posters/demo.png → /api/posters/demo.png
 */
function toRelativePath(supabaseUrl: string): string {
  if (supabaseUrl.startsWith(SUPABASE_STORAGE_BASE)) {
    const filename = supabaseUrl.slice(SUPABASE_STORAGE_BASE.length);
    return `/api/posters/${filename}`;
  }
  // 如果已经是 /api/posters/ 或 /posters/ 开头，统一转为 /api/posters/
  if (supabaseUrl.startsWith('/posters/')) {
    return `/api/posters${supabaseUrl.slice(8)}`;
  }
  // 兜底：如果不是 Supabase URL，原样返回
  return supabaseUrl;
}

/**
 * 将 DOM 元素截图并上传，返回同域图片访问路径（如 /posters/xxx.png）
 * @param element 要截图的海报根节点（注意：如果元素有 CSS transform，会自动临时移除再恢复）
 * @param options 截图配置
 */
export async function capturePosterToImageUrl(
  element: HTMLElement,
  options: CaptureOptions = {}
): Promise<string> {
  const { scale = 4 } = options;

  // ── 1. 临时移除 CSS transform，避免 html2canvas 受 scale 影响 ──
  const originalTransform = element.style.transform;
  const originalTransformOrigin = element.style.transformOrigin;
  if (originalTransform && originalTransform !== 'none') {
    element.style.transform = 'none';
    element.style.transformOrigin = '';
  }

  let canvas: HTMLCanvasElement;
  try {
    canvas = await html2canvas(element, {
      scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#FFFFFF',
      logging: false,
      imageTimeout: 15000,
    });
  } finally {
    // ── 2. 恢复 transform ──
    if (originalTransform && originalTransform !== 'none') {
      element.style.transform = originalTransform;
      element.style.transformOrigin = originalTransformOrigin;
    }
  }

  const dataUrl = canvas.toDataURL('image/jpeg', 0.88);

  // ── 3. 上传到 Supabase Storage ──
  const res = await fetch('/api/upload-share-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: dataUrl }),
  });

  const result = await res.json().catch(() => ({}));
  if (!res.ok || !result.imageUrl) {
    throw new Error(result.error || result.detail || '海报图片上传失败');
  }

  // ── 4. 返回同域相对路径 ──
  return toRelativePath(result.imageUrl as string);
}

/**
 * 等待图片加载完成（用于 html2canvas 截图前确保背景图已加载）
 * @param imgElement 图片元素
 */
export function waitForImageLoad(imgElement: HTMLImageElement): Promise<void> {
  return new Promise((resolve) => {
    if (!imgElement) return resolve();
    if (imgElement.complete) return resolve();
    imgElement.onload = () => resolve();
    imgElement.onerror = () => resolve();
    setTimeout(resolve, 3000);
  });
}
