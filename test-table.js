// 测试 business_reports 表的结构和功能
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://vzzjirfhcfzelvlwauln.supabase.co'
const supabaseKey = 'sb_publishable_c0tvGF0RuDYPmuGSaG29MA_gmNa864L'

const supabase = createClient(supabaseUrl, supabaseKey)

async function testTable() {
  console.log('🧪 开始测试 business_reports 表...\n')
  
  // 测试1: 检查表是否可以访问
  console.log('1️⃣ 测试: 检查表是否可访问...')
  const { data: testData, error: testError } = await supabase
    .from('business_reports')
    .select('*')
    .limit(0)
  
  if (testError) {
    console.error('❌ 表访问失败:', testError.message)
    return
  }
  console.log('✅ 表可访问\n')
  
  // 测试2: 尝试插入一条测试数据（使用所有可能的列名）
  console.log('2️⃣ 测试: 尝试插入测试数据...')
  const testRecord = {
    user_address: '0x1234567890abcdef1234567890abcdef12345678',
    project_name: '测试项目',
    rule_text: '测试规则文本',
    report_data: {
      pattern_type: '测试类型',
      plain_explanation: '测试说明'
    },
    pattern_type: '测试类型',
    created_at: new Date().toISOString()
  }
  
  const { data: inserted, error: insertError } = await supabase
    .from('business_reports')
    .insert(testRecord)
    .select()
  
  if (insertError) {
    console.error('❌ 插入失败:', insertError.message)
    console.error('   错误详情:', insertError)
    
    // 尝试不同的列组合
    console.log('\n3️⃣ 尝试: 只插入基本列...')
    const { data: inserted2, error: insertError2 } = await supabase
      .from('business_reports')
      .insert({
        user_address: '0x1234567890abcdef1234567890abcdef12345678',
        created_at: new Date().toISOString()
      })
      .select()
    
    if (insertError2) {
      console.error('❌ 基本插入也失败:', insertError2.message)
    } else {
      console.log('✅ 基本插入成功! 表只有基本列')
      console.log('   需要运行迁移脚本添加缺失的列')
      console.log('   请前往 Supabase Dashboard > SQL Editor 运行:')
      console.log('   migrations/001_create_business_reports.sql')
    }
  } else {
    console.log('✅ 插入成功!')
    console.log('   插入的数据:', inserted)
    
    // 测试3: 读取刚才插入的数据
    console.log('\n4️⃣ 测试: 读取刚插入的数据...')
    const { data: fetched, error: fetchError } = await supabase
      .from('business_reports')
      .select('*')
      .eq('id', inserted[0].id)
      .single()
    
    if (fetchError) {
      console.error('❌ 读取失败:', fetchError.message)
    } else {
      console.log('✅ 读取成功!')
      console.log('   数据:', fetched)
    }
    
    // 测试4: 删除测试数据
    console.log('\n5️⃣ 测试: 清理测试数据...')
    const { error: deleteError } = await supabase
      .from('business_reports')
      .delete()
      .eq('id', inserted[0].id)
    
    if (deleteError) {
      console.error('❌ 删除失败:', deleteError.message)
    } else {
      console.log('✅ 测试数据已清理\n')
    }
  }
  
  console.log('🎉 测试完成!')
}

testTable()
