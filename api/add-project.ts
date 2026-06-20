/**
 * Backend API: Add/update project in Supabase projects table
 * POST /api/add-project
 * Body: { name (required), contract_address?, chain? }
 *
 * 去重逻辑：同一 contract_address 只 update（assessment_count+1），不重复插入
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

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Missing Supabase credentials' });
  }

  const { name, contract_address, chain, aliases } = req.body || {};
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const trimmedName = name.trim();
  const trimmedAddr = contract_address?.trim() || null;
  const trimmedChain = chain?.trim() || 'BSC';
  const inputAliases = Array.isArray(aliases) ? aliases : [];
  const now = new Date().toISOString();

  try {
    // 去重：按 contract_address 查已有记录
    if (trimmedAddr) {
      const { data: existing, error: lookupErr } = await supabase
        .from('projects')
        .select('*')
        .eq('contract_address', trimmedAddr)
        .maybeSingle();

      if (lookupErr) {
        return res.status(500).json({ error: lookupErr.message, hint: 'LOOKUP failed' });
      }

      if (existing) {
        // 已存在：更新评估次数，合并别名
        const updateData: any = {
          last_eval_time: now,
          assessment_count: (existing.assessment_count || 0) + 1,
        };

        // 合并别名（去重）
        const existingAliases = existing.aliases || [];
        const mergedAliases = [...new Set([...existingAliases, ...inputAliases, trimmedName])];
        if (mergedAliases.length > existingAliases.length || !existing.aliases) {
          updateData.aliases = mergedAliases;
        }

        // 检查名称是否变更
        const nameChanged = existing.name !== trimmedName;
        if (nameChanged) {
          // 名称变更：记录曾用名，更新当前名称
          const previousNames = existing.previous_names || [];
          previousNames.push({
            name: existing.name,
            updated_at: existing.name_updated_at || existing.last_eval_time || now,
          });
          updateData.name = trimmedName;
          updateData.previous_names = previousNames;
          updateData.name_updated_at = now;
          console.log(`📝 项目名称变更: "${existing.name}" → "${trimmedName}"`);
        }

        const { error: updateErr } = await supabase
          .from('projects')
          .update(updateData)
          .eq('id', existing.id);

        if (updateErr) {
          return res.status(500).json({
            error: updateErr.message,
            hint: 'UPDATE failed. 请确认已在 Supabase SQL Editor 中执行 migrations/002_update_projects_table.sql 和 003_add_aliases_to_projects.sql',
          });
        }
        return res.status(200).json({
          success: true,
          data: { ...existing, ...updateData },
          action: 'updated',
          nameChanged,
          aliasesUpdated: mergedAliases.length > existingAliases.length,
        });
      }
    }

    // 新增记录
    const { data: inserted, error: insertErr } = await supabase
      .from('projects')
      .insert({
        name: trimmedName,
        contract_address: trimmedAddr,
        chain: trimmedChain,
        last_eval_time: now,
        assessment_count: 1,
        previous_names: [], // 初始化为空数组
        aliases: inputAliases,  // 保存别名
      })
      .select()
      .single();

    if (insertErr) {
      return res.status(500).json({
        error: insertErr.message,
        hint: 'INSERT failed. 请确认已在 Supabase SQL Editor 中执行 scripts/setup-projects-table.sql',
      });
    }
    return res.status(201).json({ success: true, data: inserted, action: 'created' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
