-- 明鉴 WiseScan - Supabase 建表语句
-- 在 Supabase SQL Editor 中执行: https://bohwaajzyuxammawluob.supabase.co

CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  contract_address TEXT UNIQUE,
  chain TEXT,
  first_assessed TIMESTAMP DEFAULT NOW(),
  last_assessed TIMESTAMP DEFAULT NOW(),
  assessment_count INT DEFAULT 1,
  info_completeness INT
);

-- 后续可补充的表（暂不创建）
-- users, risk_reports, business_reports, evidences, payments
