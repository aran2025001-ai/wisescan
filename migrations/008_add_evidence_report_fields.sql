-- ===== 阶段三：证据融入报告生成 — 数据库变更 =====
-- 日期：2026-06-17
-- 用途：支持报告中追溯引用的证据，以及证据被引用状态追踪

-- 1. risk_reports 表：新增 evidence_ids 字段（JSONB，存储被引用证据的 ID 列表）
ALTER TABLE public.risk_reports
  ADD COLUMN IF NOT EXISTS evidence_ids JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.risk_reports.evidence_ids IS '生成报告时引用的证据 ID 列表，用于追溯证据来源';

-- 2. evidence_submissions 表：新增 used_in_report 字段
ALTER TABLE public.evidence_submissions
  ADD COLUMN IF NOT EXISTS used_in_report BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.evidence_submissions.used_in_report IS '该证据是否已被某份报告引用';

-- 3. 索引
CREATE INDEX IF NOT EXISTS idx_evidence_submissions_used
  ON public.evidence_submissions(used_in_report)
  WHERE used_in_report = true;

-- 4. evidence_submissions 表 status 字段已有 partial 支持（来自 005/006 迁移）
--    确认 status CHECK 约束包含 partial
DO $$
BEGIN
  -- 如果约束存在且不包含 partial，则替换
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'evidence_submissions_status_check' 
    AND contype = 'c'
  ) THEN
    ALTER TABLE public.evidence_submissions
      DROP CONSTRAINT IF EXISTS evidence_submissions_status_check;
  END IF;
  
  ALTER TABLE public.evidence_submissions
    ADD CONSTRAINT evidence_submissions_status_check
    CHECK (status IN ('pending', 'partial', 'verified', 'rejected'));
EXCEPTION WHEN duplicate_object THEN
  -- 约束已存在，跳过
  NULL;
END $$;
