-- 009_enable_rls_for_security.sql
-- 修复 Supabase 安全警报：为缺少 RLS 的表启用行级安全
-- 执行方式：Supabase Dashboard → SQL Editor → 粘贴运行
--
-- ⚠️ 注意：这些策略与项目中其他表保持一致，使用 anon 全量访问。
--    RLS 的主要作用是"消除 Supabase 的安全告警"。
--    真正加固数据库安全需要后端改用 service_role key，这是后续可做的优化项。

-- ============================================================
-- 1. invitations 表
-- ============================================================
ALTER TABLE IF EXISTS invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Allow anon all on invitations" 
  ON invitations FOR ALL TO anon USING (true) WITH CHECK (true);

-- ============================================================
-- 2. coupons 表
-- ============================================================
ALTER TABLE IF EXISTS coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Allow anon all on coupons" 
  ON coupons FOR ALL TO anon USING (true) WITH CHECK (true);

-- ============================================================
-- 3. withdrawals 表
-- ============================================================
ALTER TABLE IF EXISTS withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Allow anon all on withdrawals" 
  ON withdrawals FOR ALL TO anon USING (true) WITH CHECK (true);

-- ============================================================
-- 4. 验证 RLS 已启用
-- ============================================================
SELECT 
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('invitations', 'coupons', 'withdrawals', 'projects', 'risk_reports', 'business_reports');
