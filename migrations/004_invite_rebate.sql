-- 邀请关系表
CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_address TEXT NOT NULL,
  invitee_address TEXT,
  invite_code TEXT NOT NULL,
  status TEXT DEFAULT 'pending',  -- pending | completed
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  UNIQUE(invitee_address),
  UNIQUE(invite_code)
);

-- 提现申请表
CREATE TABLE IF NOT EXISTS withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_address TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  withdraw_address TEXT,
  status TEXT DEFAULT 'pending',  -- pending | processing | completed | rejected
  created_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP,
  tx_hash TEXT
);

-- 用户返佣表
CREATE TABLE IF NOT EXISTS users (
  wallet_address TEXT PRIMARY KEY,
  total_commission DECIMAL(10,2) DEFAULT 0,
  available_balance DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
