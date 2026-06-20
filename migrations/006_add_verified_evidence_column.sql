-- 006_add_verified_evidence_column.sql
-- 社区已验证证据纳入项目事实缓存（只增不减）

ALTER TABLE public.project_facts
  ADD COLUMN IF NOT EXISTS verified_evidence JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.project_facts.verified_evidence IS '社区≥3人验证通过的证据列表，格式: [{category, content, verification_count, verified_at}]';
