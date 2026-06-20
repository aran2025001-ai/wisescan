-- 明鉴 WiseScan — projects 表完整建表 + RLS 策略
-- 请在 Supabase Dashboard → SQL Editor 中执行此脚本
-- ⚠️ 注意：当前 Supabase 项目的表结构可能与此不同，以实际表结构为准

-- 先删旧表重建
DROP TABLE IF EXISTS projects CASCADE;

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contract_address TEXT UNIQUE,
  logo_url TEXT,
  website TEXT,
  twitter TEXT,
  telegram TEXT,
  eval_count INT DEFAULT 0,
  last_eval_time TIMESTAMPTZ,
  keyword_cloud TEXT,
  info_completeness_percent INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  chain TEXT,
  assessment_count INT DEFAULT 0,
  info_completeness INT DEFAULT 0
);

-- 🔓 RLS 策略（开发阶段开放 anon 角色读写权限）
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for anon" ON projects
  FOR ALL TO anon
  USING (true)
  WITH CHECK (true);
