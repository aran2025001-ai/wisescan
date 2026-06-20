-- 005_create_evidence_tables.sql
-- 用户贡献证据验证机制
-- 用途：用户提交项目证据 → 多用户交叉验证 → ≥3人确认后采纳为评估依据
-- 关联：project_cache_id → project_facts.id（我们的项目事实缓存表）

-- 证据提交表
CREATE TABLE IF NOT EXISTS public.evidence_submissions (
  id SERIAL PRIMARY KEY,
  project_cache_id INTEGER REFERENCES public.project_facts(id) ON DELETE CASCADE,
  contributor_address TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('screenshot', 'text', 'link')),
  content TEXT NOT NULL,
  evidence_hash TEXT,
  evidence_category TEXT,  -- 'mode_change' | 'withdraw_issue' | 'team_info' | 'central_control' | 'other'
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'verified', 'rejected')),
  verification_count INTEGER DEFAULT 0,
  negative_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_cache_id, evidence_hash)
);

-- 证据验证记录表
CREATE TABLE IF NOT EXISTS public.evidence_verifications (
  id SERIAL PRIMARY KEY,
  evidence_id INTEGER REFERENCES public.evidence_submissions(id) ON DELETE CASCADE,
  verifier_address TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('approve', 'reject')),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(evidence_id, verifier_address)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_evidence_submissions_project ON public.evidence_submissions(project_cache_id);
CREATE INDEX IF NOT EXISTS idx_evidence_submissions_status ON public.evidence_submissions(status);
CREATE INDEX IF NOT EXISTS idx_evidence_submissions_hash ON public.evidence_submissions(evidence_hash);
CREATE INDEX IF NOT EXISTS idx_evidence_verifications_evidence ON public.evidence_verifications(evidence_id);
CREATE INDEX IF NOT EXISTS idx_evidence_verifications_address ON public.evidence_verifications(verifier_address);

-- RLS 策略
ALTER TABLE public.evidence_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon full access on evidence_submissions"
  ON public.evidence_submissions
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon full access on evidence_verifications"
  ON public.evidence_verifications
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- 自动更新 updated_at 触发器
CREATE OR REPLACE FUNCTION public.update_evidence_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_evidence_submissions_updated_at
  BEFORE UPDATE ON public.evidence_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_evidence_updated_at();
