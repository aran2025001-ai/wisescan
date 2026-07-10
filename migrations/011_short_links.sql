-- ============================================================
-- 短链接表（分享海报用）
-- ============================================================

CREATE TABLE IF NOT EXISTS short_links (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(12) NOT NULL UNIQUE,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  access_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_short_links_code ON short_links(code);

ALTER TABLE short_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "short_links_select_public" ON short_links;
DROP POLICY IF EXISTS "short_links_insert_service" ON short_links;

CREATE POLICY "允许所有人读取短链接" ON short_links
  FOR SELECT USING (true);

CREATE POLICY "允许所有人写入短链接" ON short_links
  FOR INSERT WITH CHECK (true);
