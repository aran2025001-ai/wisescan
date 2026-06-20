-- 添加 business_reports 表缺失的列
ALTER TABLE business_reports 
ADD COLUMN IF NOT EXISTS project_name TEXT,
ADD COLUMN IF NOT EXISTS rule_text TEXT,
ADD COLUMN IF NOT EXISTS report_data JSONB,
ADD COLUMN IF NOT EXISTS pattern_type TEXT;

-- 添加注释
COMMENT ON COLUMN business_reports.project_name IS '项目名称';
COMMENT ON COLUMN business_reports.rule_text IS '规则文本';
COMMENT ON COLUMN business_reports.report_data IS 'AI 生成的报告数据（JSON）';
COMMENT ON COLUMN business_reports.pattern_type IS '模式类型（如：级差返佣、矩阵制等）';

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_business_reports_user_address ON business_reports(user_address);
CREATE INDEX IF NOT EXISTS idx_business_reports_created_at ON business_reports(created_at DESC);
