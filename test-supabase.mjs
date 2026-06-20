import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://vzzjirfhcfzelvlwauln.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_c0tvGF0RuDYPmuGSaG29MA_gmNa864L'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function test() {
  console.log('🧪 测试 Supabase 连接...')

  // 测试查询 projects 表
  const { data, error, status } = await supabase
    .from('projects')
    .select('*')
    .limit(1)

  if (error) {
    console.error('❌ 连接失败:', error.message)
    console.error('   代码:', error.code)
    process.exit(1)
  }

  console.log('✅ Supabase 连接成功！')
  console.log('   状态码:', status)
  console.log('   当前 projects 表记录数:', data?.length ?? 0)

  // 测试查询 evaluation_reports
  const { data: reports, error: reportErr } = await supabase
    .from('evaluation_reports')
    .select('*')
    .limit(1)

  if (reportErr) {
    console.error('❌ evaluation_reports 查询失败:', reportErr.message)
    process.exit(1)
  }

  console.log('✅ evaluation_reports 表可正常访问')
  console.log('   当前报告数:', reports?.length ?? 0)
  console.log('\n🎉 所有测试通过！Supabase 配置正确。')
}

test().catch((err) => {
  console.error('❌ 未捕获错误:', err.message)
  process.exit(1)
})
