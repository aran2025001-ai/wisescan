// 一次性脚本：清除金蝉协议 0x408b4f09... 的缓存
// 当前表结构：只有 cached_report（无 cached_report_url），所以只清这一个字段
// 用法：node clear-jincan-cache.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';

// 加载 .env（项目根目录）
if (existsSync('.env')) {
  const envContent = readFileSync('.env', 'utf-8');
  for (const line of envContent.split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.+?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const KEY = '0x408b4f09f9fd4b3d3a5ad6d31a368d719a668888';

async function main() {
  console.log('🔍 查询 Supabase 现有记录...');
  const { data: before, error: qErr } = await supabase
    .from('project_facts')
    .select('contract_address, project_name, cached_report, cached_at, last_searched_at')
    .eq('contract_address', KEY)
    .maybeSingle();

  if (qErr) {
    console.error('查询失败:', qErr.message);
    process.exit(1);
  }
  if (!before) {
    console.log('📭 Supabase 中无此 key 的记录');
    return;
  }

  console.log('找到记录:', {
    project_name: before.project_name,
    has_cached_report: !!before.cached_report,
    cached_report_size: before.cached_report ? JSON.stringify(before.cached_report).length : 0,
    cached_at: before.cached_at,
    last_searched_at: before.last_searched_at,
  });

  // 清掉旧 cached_report 字段（保持幂等）
  const { error: uErr } = await supabase
    .from('project_facts')
    .update({
      cached_report: null,
      cached_at: null,
    })
    .eq('contract_address', KEY);

  if (uErr) {
    console.error('清除失败:', uErr.message);
    process.exit(1);
  }

  console.log('✅ Supabase 缓存已清除');

  // 验证
  const { data: after } = await supabase
    .from('project_facts')
    .select('cached_report, cached_at, last_searched_at')
    .eq('contract_address', KEY)
    .maybeSingle();

  console.log('清除后状态:', {
    has_cached_report: !!after?.cached_report,
    cached_at: after?.cached_at,
    last_searched_at_保留: after?.last_searched_at,  // 这个保留，不影响下次检索逻辑
  });
  console.log('🎉 完成！下次再搜金蝉协议会重新走完整流程');
}

main().catch(e => {
  console.error('异常:', e);
  process.exit(1);
});
