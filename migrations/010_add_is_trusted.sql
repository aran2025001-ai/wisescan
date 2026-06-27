-- 为 projects 表增加 is_trusted 字段
-- 标记为 true 的项目不触发自动崩盘检测（如 ETH、Uniswap 等主流可信项目）
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_trusted BOOLEAN DEFAULT FALSE;

-- 同时为 project_facts 表也增加（缓存路径同样需要）
ALTER TABLE project_facts ADD COLUMN IF NOT EXISTS is_trusted BOOLEAN DEFAULT FALSE;
