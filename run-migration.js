// 运行 SQL 迁移脚本 - 使用 Supabase pg 端点
import fetch from 'node-fetch'

const supabaseUrl = 'https://vzzjirfhcfzelvlwauln.supabase.co'
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_0ZQRTSELECTED0D06PsBzHxM5PKLOS'  // 需要从用户获取

const sql = `
ALTER TABLE business_reports 
ADD COLUMN IF NOT EXISTS project_name TEXT,
ADD COLUMN IF NOT EXISTS rule_text TEXT,
ADD COLUMN IF NOT EXISTS report_data JSONB,
ADD COLUMN IF NOT EXISTS pattern_type TEXT;

CREATE INDEX IF NOT EXISTS idx_business_reports_user_address ON business_reports(user_address);
CREATE INDEX IF NOT EXISTS idx_business_reports_created_at ON business_reports(created_at DESC);
`

async function runMigration() {
  console.log('正在运行迁移脚本...')
  
  try {
    const response = await fetch(`${supabaseUrl}/pg/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'ApiKey': supabaseServiceKey
      },
      body: JSON.stringify({ query: sql })
    })
    
    console.log('响应状态:', response.status)
    const result = await response.text()
    console.log('响应内容:', result)
    
    if (response.ok) {
      console.log('✓ 迁移成功！')
    } else {
      console.error('✗ 迁移失败:', result)
    }
  } catch (error) {
    console.error('错误:', error.message)
  }
}

runMigration()
