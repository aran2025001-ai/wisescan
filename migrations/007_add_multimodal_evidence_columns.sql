-- 007_add_multimodal_evidence_columns.sql
-- 多模态证据支持：图片上传 + AI 分析描述
-- 依赖：005_create_evidence_tables.sql（evidence_submissions 基础表）

-- 1. 扩展 content_type 允许的类型
ALTER TABLE public.evidence_submissions
  DROP CONSTRAINT IF EXISTS evidence_submissions_content_type_check;
ALTER TABLE public.evidence_submissions
  ADD CONSTRAINT evidence_submissions_content_type_check
  CHECK (content_type IN ('screenshot', 'text', 'link', 'pattern_image'));

-- 2. 新增字段
ALTER TABLE public.evidence_submissions
  ADD COLUMN IF NOT EXISTS project_name TEXT,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS image_description TEXT,
  ADD COLUMN IF NOT EXISTS source_type TEXT CHECK (source_type IN ('form', 'evidence_button'));

-- 3. 索引（加速按来源查询）
CREATE INDEX IF NOT EXISTS idx_evidence_submissions_source
  ON public.evidence_submissions(source_type);

COMMENT ON COLUMN public.evidence_submissions.image_url IS '图片在 Supabase Storage 中的公开 URL';
COMMENT ON COLUMN public.evidence_submissions.image_description IS 'OpenRouter 多模态分析生成的中文图片描述（由 GPT-4V 生成）';
COMMENT ON COLUMN public.evidence_submissions.source_type IS '证据来源入口：form=项目安全评估表单，evidence_button=补充证据弹窗';
COMMENT ON COLUMN public.evidence_submissions.project_name IS '项目名称快照，避免联表查询';
