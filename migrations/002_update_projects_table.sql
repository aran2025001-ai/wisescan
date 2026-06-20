-- 添加曾用名字段到 projects 表
-- 执行时间：2026-06-14

-- 添加 previous_names 字段（JSONB 数组，存储历史名称）
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS previous_names JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS name_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 添加索引（提高查询性能）
CREATE INDEX IF NOT EXISTS idx_projects_contract_address ON projects(contract_address);
CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);

-- 添加注释
COMMENT ON COLUMN projects.previous_names IS '曾用名列表，格式：[{\"name\": \"Metya\", \"updated_at\": \"2026-01-01\"}]';
COMMENT ON COLUMN projects.name_updated_at IS '项目名称最后更新时间';

-- 验证表结构
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'projects'
ORDER BY ordinal_position;
