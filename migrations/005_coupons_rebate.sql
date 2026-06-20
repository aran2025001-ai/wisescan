-- 005_coupons_rebate.sql
-- 邀请返佣 + 代金券系统（极简版）
-- 注意：表是空的，安全重建

-- 1. 重建 invitations 表
DROP TABLE IF EXISTS invitations CASCADE;
CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter TEXT NOT NULL,                    -- 邀请人钱包地址
  invitee TEXT NOT NULL,                    -- 被邀请人钱包地址
  invite_code TEXT UNIQUE NOT NULL,         -- 邀请码
  status TEXT DEFAULT 'pending',            -- pending | connected | paid
  connected_at TIMESTAMP,                   -- 被邀请人连接钱包时间
  paid_at TIMESTAMP,                        -- 被邀请人首次付费时间
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(invitee)
);

-- 2. 新建 coupons 表
CREATE TABLE IF NOT EXISTS coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_address TEXT NOT NULL,                -- 持有者钱包地址
  amount DECIMAL(10,2) DEFAULT 2.99,        -- 面额
  type TEXT DEFAULT 'invite',               -- 只有 invite 一种类型
  status TEXT DEFAULT 'active',             -- active | used | expired
  expires_at TIMESTAMP,                     -- 30天后过期
  used_at TIMESTAMP,                        -- 使用时间
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. 简化 withdrawals 表
DROP TABLE IF EXISTS withdrawals CASCADE;
CREATE TABLE withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_address TEXT NOT NULL,                -- 提现人钱包地址
  amount DECIMAL(10,2) NOT NULL,            -- 提现金额
  address TEXT NOT NULL,                     -- 提现收款地址
  status TEXT DEFAULT 'pending',            -- pending | completed | rejected
  created_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP
);

-- 4. 删除不再需要的 users 表
DROP TABLE IF EXISTS users CASCADE;
