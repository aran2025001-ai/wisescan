/**
 * AI 项目名称标准化 API
 * POST /api/normalize-project-name
 * Body: { name: string }
 * 
 * 调用 DeepSeek API 分析用户输入的项目名称
 * 返回：标准名称、别名列表、置信度
 */

import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const deepseekKey = process.env.VITE_DEEPSEEK_API_KEY;
  if (!deepseekKey) {
    return res.status(500).json({ error: 'Missing DEEPSEEK_API_KEY' });
  }

  const { name } = req.body || {};
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }

  const trimmedName = name.trim();
  const now = Date.now();

  try {
    // 调用 DeepSeek API（低温度 + 限制 token，快速响应）
    const dsRes = await fetch('https://api.deepseek.com/chat/v1', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${deepseekKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: `你是"明鉴"平台的AI助手，专门负责标准化Web3项目名称。
            
你的任务：
1. 分析用户输入的项目名称
2. 识别这是哪个Web3项目（DeFi、GameFi、SocialFi、公链等）
3. 返回该项目的标准化名称（使用最广为人知的名称）
4. 列出所有常见别名（包括：代币符号、旧名称、英文全称、中文名等）

输出格式（严格JSON）：
{
  "standard_name": "标准化项目名称（如：MY）",
  "aliases": ["所有已知别名（如：Metya, MET, MY Group）"],
  "project_type": "项目类型（如：Web3社交平台）",
  "confidence": 0.95,  // 置信度 0-1
  "reason": "判断依据（简短说明）"
}

注意：
- 如果用户输的是代币符号（如：MY），要识别对应的项目全称
- 如果项目名称有多个常用名，选择最广为人知的那个
- 置信度 < 0.5 表示无法识别，可能是新项目或输入错误
- 只输出JSON，不要其他文字`,
          },
          {
            role: 'user',
            content: `用户输入了项目名称："${trimmedName}"。\n请分析并返回标准化名称。`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,  // 低温度，稳定输出
        max_tokens: 500,   // 限制token，省钱
      }),
    });

    if (!dsRes.ok) {
      const errText = await dsRes.text();
      console.warn('⚠️  DeepSeek API 调用失败:', errText);
      // 降级：返回原始名称
      return res.status(200).json({
        success: true,
        data: {
          standard_name: trimmedName,
          aliases: [],
          project_type: '未知',
          confidence: 0.3,
          reason: 'AI 调用失败，使用原始名称',
        },
      });
    }

    const dsJson = await dsRes.json();
    const content = dsJson.choices?.[0]?.message?.content || '{}';

    let aiResult;
    try {
      aiResult = JSON.parse(content);
    } catch (parseErr) {
      console.warn('⚠️  AI 返回JSON解析失败:', content);
      aiResult = {
        standard_name: trimmedName,
        aliases: [],
        confidence: 0.3,
        reason: 'AI 返回格式错误',
      };
    }

    // 查询 Supabase 是否已存在该项目（按标准化名称或别名模糊匹配）
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
    let existingProject = null;

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      // 先按标准化名称精确匹配
      const { data: byName } = await supabase
        .from('projects')
        .select('*')
        .eq('name', aiResult.standard_name)
        .maybeSingle();

      if (byName) {
        existingProject = byName;
      } else {
        // 再按别名模糊匹配（检查 aliases 字段是否包含输入的名称）
        const { data: byAlias } = await supabase
          .from('projects')
          .select('*')
          .filter('aliases', 'cs', `["${trimmedName}"]`)
          .maybeSingle();

        if (byAlias) {
          existingProject = byAlias;
        }
      }
    }

    const response = {
      success: true,
      data: {
        original_name: trimmedName,
        standard_name: aiResult.standard_name || trimmedName,
        aliases: aiResult.aliases || [],
        project_type: aiResult.project_type || '未知',
        confidence: aiResult.confidence || 0.5,
        reason: aiResult.reason || '',
        existing_project_id: existingProject?.id || null,
        existing_project_name: existingProject?.name || null,
      },
      timing: `${Date.now() - now}ms`,
    };

    console.log(`✅ AI 标准化完成: "${trimmedName}" → "${response.data.standard_name}" (置信度: ${response.data.confidence})`);
    return res.status(200).json(response);
  } catch (err: any) {
    console.error('❌ AI 标准化失败:', err.message);
    // 降级：返回原始名称
    return res.status(200).json({
      success: true,
      data: {
        original_name: trimmedName,
        standard_name: trimmedName,
        aliases: [],
        confidence: 0.3,
        reason: `AI 调用异常: ${err.message}`,
      },
    });
  }
}
