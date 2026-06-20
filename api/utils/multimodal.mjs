/**
 * multimodal.mjs — 多模态图片分析
 * 使用 OpenRouter GPT-4o 视觉模型分析图片内容
 * 降级策略：分析失败时返回空字符串，不中断主流程
 */

import fetch from 'node-fetch';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * 分析图片内容（通过公开 URL）
 * @param {string} imageUrl - 图片的公开 URL（Supabase Storage 公开 URL）
 * @returns {Promise<string>} 中文图片描述，失败返回空字符串
 */
export async function analyzeImage(imageUrl) {
  if (!OPENROUTER_API_KEY) {
    console.warn('[Multimodal] OPENROUTER_API_KEY 未配置，跳过图片分析');
    return '';
  }
  if (!imageUrl || typeof imageUrl !== 'string') {
    console.warn('[Multimodal] imageUrl 无效，跳过图片分析');
    return '';
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s 超时

    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://wisescan.app',  // OpenRouter 需要
        'X-Title': 'WiseScan Multimodal',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o',  // 支持视觉，OpenRouter 可用
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `请详细描述这张图片的内容，提取所有可读文字和关键视觉信息。
- 如果是项目公告/群聊截图：提取所有文字内容、时间、关键事件
- 如果是模式图/层级图：描述结构、层级关系、收益机制
- 如果是官网/白皮书截图：提取核心业务描述
请用中文输出，结构清晰，不少于50字。`,
              },
              {
                type: 'image_url',
                image_url: { url: imageUrl },
              },
            ],
          },
        ],
        max_tokens: 800,
        temperature: 0.2,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error(`[Multimodal] OpenRouter API 错误 ${response.status}:`, errText);
      return '';
    }

    const data = await response.json();
    const description = data.choices?.[0]?.message?.content?.trim();

    if (!description) {
      console.warn('[Multimodal] OpenRouter 返回空描述');
      return '';
    }

    console.log(`[Multimodal] 图片分析成功 (${description.length}字):`, description.slice(0, 60) + '...');
    return description;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('[Multimodal] 图片分析超时（15s）');
    } else {
      console.error('[Multimodal] 图片分析失败:', error.message);
    }
    return '';  // 降级：返回空描述，不中断流程
  }
}

/**
 * 分析本地 base64 图片（当 URL 不可公开访问时使用）
 * @param {string} base64Data - base64 编码的图片数据（不含 data:image/... 前缀）
 * @param {string} mimeType - 图片 MIME 类型，默认 image/png
 * @returns {Promise<string>}
 */
export async function analyzeImageBase64(base64Data, mimeType = 'image/png') {
  if (!OPENROUTER_API_KEY) return '';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://wisescan.app',
        'X-Title': 'WiseScan Multimodal',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `请详细描述这张图片的内容，提取所有可读文字和关键视觉信息。请用中文输出，结构清晰，不少于50字。`,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Data}`,
                },
              },
            ],
          },
        ],
        max_tokens: 800,
        temperature: 0.2,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) return '';
    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || '';
  } catch (error) {
    console.error('[Multimodal] base64 图片分析失败:', error.message);
    return '';
  }
}
