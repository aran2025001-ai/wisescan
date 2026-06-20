-- 明鉴 WiseScan — risk_reports 表建表
-- 请在 Supabase Dashboard → SQL Editor 中执行此脚本
-- 项目URL: https://vzzjirfhcfzelvlwauln.supabase.com

CREATE TABLE IF NOT EXISTS risk_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_address TEXT NOT NULL DEFAULT 'anonymous',
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  report_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_score INTEGER,
  risk_level TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 策略（开发阶段开放）
ALTER TABLE risk_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for anon" ON risk_reports
  FOR ALL TO anon
  USING (true)
  WITH CHECK (true);
