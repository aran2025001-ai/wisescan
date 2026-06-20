// Supabase 建表 + 连通性测试脚本
// 用法: npx tsx scripts/setup-supabase.ts
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 缺少 Supabase 环境变量！请检查 .env.local');
  process.exit(1);
}

console.log('📡 Supabase URL:', supabaseUrl);
console.log('🔑 Key preview:', supabaseKey.slice(0, 25) + '...');

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // Step 1: Test connectivity
  console.log('\n⏳ 测试连通性...');
  const { data: health, error: healthErr } = await supabase.from('projects').select('count').limit(1);
  
  if (healthErr) {
    if (healthErr.message.includes('does not exist') || healthErr.code === '42P01') {
      console.log('ℹ️  projects 表尚不存在，需要创建');
    } else {
      console.error('❌ 连通性测试失败:', healthErr.message);
      console.error('   详细信息:', JSON.stringify(healthErr, null, 2));
      // Don't exit - maybe the table just doesn't exist
    }
  } else {
    console.log('✅ Supabase 连通正常');
    console.log('   projects 表已存在，跳过建表');
    // Show existing data
    const { data: rows } = await supabase.from('projects').select('*').limit(5);
    console.log('   当前数据:', rows?.length ?? 0, '条');
    return;
  }

  // Step 2: Try creating the table via SQL
  console.log('\n⏳ 尝试使用 REST API 创建 projects 表...');
  console.log('   ⚠️  anon key 通常没有 DDL 权限');

  // Try a direct insert to test if table exists / can be created
  const { error: insertErr } = await supabase.from('projects').insert({
    name: '_test_setup',
    chain: 'test',
  }).select();

  if (insertErr) {
    console.error('❌ 创建表失败（可能需要 service_role key）');
    console.error('   错误:', insertErr.message);
    console.log('\n📋 请使用 Supabase Dashboard SQL Editor 执行以下建表语句：');
    console.log('   https://bohwaajzyuxammawluob.supabase.co → SQL Editor');
    console.log('');
    console.log('```sql');
    console.log(`CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  contract_address TEXT UNIQUE,
  chain TEXT,
  first_assessed TIMESTAMP DEFAULT NOW(),
  last_assessed TIMESTAMP DEFAULT NOW(),
  assessment_count INT DEFAULT 1,
  info_completeness INT
);`);
    console.log('```');
  } else {
    console.log('✅ projects 表创建/连接成功！');
    // Clean up test data
    await supabase.from('projects').delete().eq('name', '_test_setup');
  }
}

main().catch(console.error);
