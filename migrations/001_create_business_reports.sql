-- 商业模式拆解报告表 - 完整迁移脚本
-- 运行此脚本在 Supabase Dashboard 的 SQL Editor 中

-- 1. 如果表不存在，创建它
CREATE TABLE IF NOT EXISTS business_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_address TEXT NOT NULL,
  project_name TEXT,
  rule_text TEXT,
  report_data JSONB,
  pattern_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 如果表已存在但缺少列，添加它们
ALTER TABLE business_reports 
ADD COLUMN IF NOT EXISTS project_name TEXT,
ADD COLUMN IF NOT EXISTS rule_text TEXT,
ADD COLUMN IF NOT EXISTS report_data JSONB,
ADD COLUMN IF NOT EXISTS pattern_type TEXT;

-- 3. 添加索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_business_reports_user_address ON business_reports(user_address);
CREATE INDEX IF NOT EXISTS idx_business_reports_created_at ON business_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_business_reports_pattern_type ON business_reports(pattern_type);

-- 4. 启用行级安全（RLS）
ALTER TABLE business_reports ENABLE ROW LEVEL SECURITY;

-- 5. 创建 RLS 策略：用户只能查看自己的报告
-- 注意：需要先创建 auth.users 表和 business_reports 的关联
-- 简化版本：允许所有认证用户读取（开发阶段）
CREATE POLICY IF NOT EXISTS "Users can view own reports" 
  ON business_reports FOR SELECT 
  USING (auth.role() = 'authenticated');

-- 6. 允许插入
CREATE POLICY IF NOT EXISTS "Users can insert reports" 
  ON business_reports FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

-- 7. 验证表结构
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'business_reports'
ORDER BY ordinal_position;

-- 8. 验证索引
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'business_reports';
