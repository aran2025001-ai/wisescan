-- 添加 aliases 字段到 projects 表
-- 执行时间：2026-06-14
-- 用途：存储项目的所有别名（如 "MY", "Metya", "MET", "MY Group"）

ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS aliases JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS ai_normalized_name TEXT;

-- 添加索引（提高模糊搜索性能）
CREATE INDEX IF NOT EXISTS idx_projects_aliases ON projects USING GIN (aliases);
CREATE INDEX IF NOT EXISTS idx_projects_ai_name ON projects(ai_normalized_name);

-- 添加注释
COMMENT ON COLUMN projects.aliases IS '项目别名列表，格式：["Metya", "MET", "MY Group"]';
COMMENT ON COLUMN projects.ai_normalized_name IS 'AI 标准化的项目名称';

-- 验证表结构
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'projects'
ORDER BY ordinal_position;
