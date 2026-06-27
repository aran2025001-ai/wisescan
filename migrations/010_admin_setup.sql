-- 010_admin_setup.sql
-- 管理后台所需数据库补充
-- 执行：Supabase Dashboard → SQL Editor → 粘贴运行

-- ============================================================
-- 1. 新建反馈表（feedback）
-- ============================================================
CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_address TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'resolved')),
  category TEXT DEFAULT 'general',
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon all on feedback"
  ON public.feedback FOR ALL TO anon USING (true) WITH CHECK (true);

-- ============================================================
-- 2. withdrawals 补充字段（tx_hash + reject_reason）
-- ============================================================
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS tx_hash TEXT;
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS reject_reason TEXT;

-- ============================================================
-- 3. 索引
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_feedback_status ON public.feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_user ON public.feedback(user_address);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON public.withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON public.withdrawals(user_address);

-- ============================================================
-- 4. 修复 projects 表 RLS 策略（确保 anon 可 UPDATE）
-- ============================================================
DROP POLICY IF EXISTS "Allow all for anon" ON public.projects;
CREATE POLICY "Allow all for anon" ON public.projects
  FOR ALL TO anon
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 5. 验证
-- ============================================================
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('feedback', 'withdrawals')
ORDER BY table_name, ordinal_position;
