/**
 * 批量修复：直接通过 Supabase 读取缓存报告，修正后回写。
 * 不经过 HTTP API，不受 AI 生成延迟影响。
 * 
 * 用法：node backfill-cache.mjs
 * 依赖：api-server 需在 3002 端口运行（仅用于获取 onChainData）
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const envPath = resolve(import.meta.dirname || '.', '.env');
try {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i > 0 && !process.env[t.slice(0, i).trim()]) process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
} catch (e) { console.error('❌ .env:', e.message); process.exit(1); }

async function main() {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);

  const { data: projects, error } = await supabase
    .from('project_facts')
    .select('id, contract_address, cached_report, cached_at')
    .not('cached_report', 'is', null)
    .order('cached_at', { ascending: false });

  if (error) { console.error('❌ 查询:', error.message); process.exit(1); }

  console.log(`📦 ${projects.length} 个记录\n`);

  let ok = 0, fail = 0;
  for (const p of projects) {
    const addr = p.contract_address;
    const id = p.id;
    if (!p.cached_report) { console.log(`  [${(addr||'').slice(0,10)}] ⏭️ 无缓存`); continue; }

    process.stdout.write(`  [${(addr||'').slice(0,10)}] `);

    try {
      // 深拷贝，避免修改引用
      const report = JSON.parse(JSON.stringify(p.cached_report));

      // 直接运行 finalConsistencyCheck 的核心逻辑（内联版）
      let changed = false;
      const isRisk = Array.isArray(report.six_dimensions);

      // --- 模式变更/合规/审计幻觉清理 ---
      if (isRisk && report.ai_summary && typeof report.ai_summary === 'string') {
        let s = report.ai_summary;
        const histD = report.six_dimensions?.find(d => d.dimension?.includes('历史'));
        const codeD = report.six_dimensions?.find(d => d.dimension?.includes('代码'));
        const compD = report.six_dimensions?.find(d => d.dimension?.includes('合规'));

        // 模式变更
        if (histD && histD.score >= 8 && /未发现模式变更|无模式变更/i.test(histD.deduction || '')) {
          const bs = s;
          s = s.replace(/且曾[^，。]*模式变更/g,'').replace(/曾[^，。]*模式变更/g,'').replace(/存在[^，。]*模式变更/g,'').replace(/有[^，。]*模式变更/g,'')
            .replace(/，\s*，/g,'，').replace(/。\s*。/g,'。').replace(/但\s*，/g,'但').replace(/，\s*$/g,'').replace(/但\s*$/g,'').trim();
          if (s !== bs) { changed = true; }
        }
        // 合规
        if (compD && compD.score != null && compD.score <= 2) {
          s = s.replace(/[^。]*持有合规牌照[^。]*(?:[。]|$)/g,'').replace(/[^。]*合规牌照[^。]*(?:[。]|$)/g,'')
            .replace(/[^。]*持牌经营[^。]*(?:[。]|$)/g,'').replace(/[^。]*已获.*牌[^。]*(?:[。]|$)/g,'')
            .replace(/[^。]*牌照[^，。]*合规[^。]*(?:[。]|$)/g,'').replace(/[^。]*获.*牌[^。]*(?:[。]|$)/g,'').trim();
        }
        // 审计
        if (codeD && codeD.score != null && codeD.score <= 5) {
          s = s.replace(/[^。]*已完成安全审计[^。]*(?:[。]|$)/g,'').replace(/[^。]*通过.*审计[^。]*(?:[。]|$)/g,'')
            .replace(/[^。]*审计报告.*通过[^。]*(?:[。]|$)/g,'').replace(/[^。]*CertiK[^。]*(?:[。]|$)/g,'')
            .replace(/[^。]*SlowMist[^。]*(?:[。]|$)/g,'').trim();
        }
        // 融资记录/估值
        report.ai_summary = s
          .replace(/[^。]*融资记录[^。]*(?:[。]|$)/g,'')
          .replace(/[^。]*有资本支持[^。]*(?:[。]|$)/g,'')
          .replace(/，\s*，/g,'，').replace(/。\s*。/g,'。').replace(/，\s*$/g,'').trim();
      }

      // 结论匹配
      if (report.conclusion && report.risk_level) {
        const map = { '极低风险':'可以参与','低风险':'可以参与','中等风险':'谨慎参与','高风险':'不建议参与','极高风险':'严禁参与' };
        const exp = map[report.risk_level];
        if (exp && !report.conclusion.startsWith(exp)) {
          report.conclusion = exp;
          changed = true;
        }
      }

      // 团队维度: 清理"有融资记录"加分
      if (isRisk) {
        const teamD = report.six_dimensions?.find(d => d.dimension?.includes('团队'));
        if (teamD && teamD.deduction && /有融资记录/.test(teamD.deduction)) {
          teamD.deduction = teamD.deduction.replace(/【网络搜索-Tavily】有融资记录（\+\d）\s*/g,'').replace(/；\s*；/g,'；').trim();
          changed = true;
        }
        // 社群维度: 清理"融资新闻正面"
        const commD = report.six_dimensions?.find(d => d.dimension?.includes('社群'));
        if (commD && commD.deduction && /融资新闻正面/.test(commD.deduction)) {
          commD.deduction = commD.deduction.replace(/；?\s*融资新闻正面（\+5）\s*/g,'').replace(/；\s*；/g,'；').trim();
          changed = true;
        }
      }

      // funding_record
      if (report.funding_record === '有' || report.funding_record === true) {
        report.funding_record = '无';
        changed = true;
      }

      if (changed) {
        // 回写 Supabase
        const { error: updErr } = await supabase
          .from('project_facts')
          .update({ cached_report: report })
          .eq('id', id);

        if (updErr) {
          process.stdout.write(`❌ 回写失败: ${updErr.message}\n`);
          fail++;
        } else {
          process.stdout.write(`✅ 已修正\n`);
          ok++;
        }
      } else {
        process.stdout.write(`✅ 无需修正\n`);
        ok++;
      }
    } catch (err) {
      process.stdout.write(`❌ ${err.message.slice(0,60)}\n`);
      fail++;
    }
  }
  console.log(`\n📊 完成: ${ok} 成功, ${fail} 失败`);
}
main().catch(console.error);
