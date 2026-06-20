-- ============================================================
-- 明鉴 WiseScan — 阶段一 Supabase 手动操作清单
-- 请在 Supabase Dashboard 中逐步执行
-- ============================================================

-- ── 步骤 1：执行迁移 007（添加多模态字段）─────────────────
-- 在 Dashboard → SQL Editor 中粘贴并执行 migrations/007_add_multimodal_evidence_columns.sql

-- ── 步骤 2：创建 Storage Bucket ─────────────────────────────
-- 请在 Dashboard → Storage → New bucket 中手动创建：
--
--  Bucket name : evidence-images
--  Public bucket : ✅ 勾选（允许公开读取图片）
--  File size limit : 5MB
--  Allowed MIME types : image/png, image/jpeg, image/webp

-- ── 步骤 3：设置 Storage RLS 策略（粘贴到 SQL Editor）────

-- 3.1 允许匿名用户上传（insert）
CREATE POLICY IF NOT EXISTS "Allow anon upload to evidence-images"
  ON storage.objects
  FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'evidence-images');

-- 3.2 允许匿名用户读取（select）
CREATE POLICY IF NOT EXISTS "Allow anon read from evidence-images"
  ON storage.objects
  FOR SELECT
  TO anon
  USING (bucket_id = 'evidence-images');

-- 3.3 允许匿名用户更新自己上传的文件（可选，用于覆盖）
CREATE POLICY IF NOT EXISTS "Allow anon update in evidence-images"
  ON storage.objects
  FOR UPDATE
  TO anon
  USING (bucket_id = 'evidence-images')
  WITH CHECK (bucket_id = 'evidence-images');

-- 启用 Storage RLS（如果未启用）
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- ── 步骤 4：验证 ──────────────────────────────────────────
-- 执行以下查询确认表结构正确：
--
--  SELECT column_name, data_type
--  FROM information_schema.columns
--  WHERE table_name = 'evidence_submissions'
--  ORDER BY ordinal_position;
--
-- 应看到：image_url, image_description, source_type, project_name 四个新字段

-- 执行以下查询确认 bucket 已创建：
--
--  SELECT id, name, public FROM storage.buckets WHERE name = 'evidence-images';
--
-- 应返回 1 行，public = true
