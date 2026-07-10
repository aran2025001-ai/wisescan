-- 创建 payments 表（链上 USDT 支付记录）
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tx_hash TEXT UNIQUE NOT NULL,
  user_address TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  expected_amount DECIMAL(10,2),
  report_type TEXT NOT NULL CHECK (report_type IN ('risk', 'business')),
  project_id UUID,
  coupon_id UUID,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'refunded')),
  confirmed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引（提升查询性能）
CREATE INDEX IF NOT EXISTS idx_payments_user_address ON payments(user_address);
CREATE INDEX IF NOT EXISTS idx_payments_tx_hash ON payments(tx_hash);
CREATE INDEX IF NOT EXISTS idx_payments_project ON payments(project_id, report_type);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
