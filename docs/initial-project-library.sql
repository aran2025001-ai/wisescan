-- ============================================================
-- 明鉴 WiseScan — 初始项目库（第1批，2026-06-27）
-- 
-- ⚠️ 使用说明：
-- 1. 先去 Supabase Dashboard → Table Editor → projects 表
-- 2. 执行以下查询确认新项目不会重复
-- 3. 然后逐段执行 INSERT
-- 4. 合约地址说明：
--    - ✅ IEGT：BscScan 核实，代币名 IEGT，合约已验证
--    - ✅ Pump.fun：Solscan 核实，Pump.fun 核心合约
--    - ⚠️ 其他项目：暂无100%确认的合约地址，待补充
-- ============================================================

-- 第0步：检查是否已存在（避免重复录入）
SELECT '=== 检查现有项目中是否有重复 ===' as info;
SELECT id, name, contract_address, chain FROM projects
WHERE name IN (
  'IEGT', 'SyncDex Finance', 'ZKasino', '奥拉丁 (Origin/LGNS)',
  'HumanizedAi (HMZ)', 'SHIDO', 'Friend.tech', 'LIBRA', 'SIREN',
  'HAWK', 'VerilyHK', 'Blocto', 'Pump.fun',
  'CBEX', '拉菲协议', 'Mantra (OM)', 'SUI/NEAR OTC骗局'
);

-- ============================================================
-- 第1批：有100%确认合约地址的项目
-- ============================================================

-- IEGT
-- 合约地址：0x8D07f605926837Ea0F9E1e24DbA0Fb348cb3E97D
-- BscScan 核实：代币名 IEGT (IEGT)，Max Supply 5,000,000
-- 来源：慢雾披露的隐蔽Rug Pull
INSERT INTO projects (name, contract_address, chain, info_completeness, assessment_count, created_at)
SELECT 'IEGT', '0x8D07f605926837Ea0F9E1e24DbA0Fb348cb3E97D', 'bsc', 100, 0, now()
WHERE NOT EXISTS (SELECT 1 FROM projects WHERE name = 'IEGT');

-- Pump.fun
-- 合约地址：6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P (Solana)
-- Solscan 核实：Pump.fun 核心合约
-- 来源：Solana Meme币发行平台
INSERT INTO projects (name, contract_address, chain, info_completeness, assessment_count, created_at)
SELECT 'Pump.fun', '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P', 'solana', 100, 0, now()
WHERE NOT EXISTS (SELECT 1 FROM projects WHERE name = 'Pump.fun');

-- ============================================================
-- 第2批：暂无合约地址（走无地址模式评估）
-- 合约地址为 NULL，扫描时自动触发无合约地址模式
-- ============================================================

-- SyncDex Finance（zkSync Era Rug Pull）
-- 注意：zkSync Era 链不在当前支持链列表中，暂不填合约地址
-- @@TODO: 核实完整代币合约地址
INSERT INTO projects (name, contract_address, chain, info_completeness, assessment_count, created_at)
SELECT 'SyncDex Finance', NULL, 'ethereum', 50, 0, now()
WHERE NOT EXISTS (SELECT 1 FROM projects WHERE name = 'SyncDex Finance');

-- ZKasino
-- @@TODO: 核实存款合约地址（2024年4月，10,515 ETH 的桥接资金）
INSERT INTO projects (name, contract_address, chain, info_completeness, assessment_count, created_at)
SELECT 'ZKasino', NULL, 'ethereum', 50, 0, now()
WHERE NOT EXISTS (SELECT 1 FROM projects WHERE name = 'ZKasino');

-- 奥拉丁 (Origin/LGNS) — BSC 百亿庞氏
-- 核心套现地址：0x9c3...（不完整，待核实）
INSERT INTO projects (name, contract_address, chain, info_completeness, assessment_count, created_at)
SELECT '奥拉丁 (Origin/LGNS)', NULL, 'bsc', 50, 0, now()
WHERE NOT EXISTS (SELECT 1 FROM projects WHERE name = '奥拉丁 (Origin/LGNS)');

-- HumanizedAi (HMZ) — 疑似退出骗局
INSERT INTO projects (name, contract_address, chain, info_completeness, assessment_count, created_at)
SELECT 'HumanizedAi (HMZ)', NULL, 'bsc', 30, 0, now()
WHERE NOT EXISTS (SELECT 1 FROM projects WHERE name = 'HumanizedAi (HMZ)');

-- SHIDO — 质押合约被攻击
INSERT INTO projects (name, contract_address, chain, info_completeness, assessment_count, created_at)
SELECT 'SHIDO', NULL, 'ethereum', 30, 0, now()
WHERE NOT EXISTS (SELECT 1 FROM projects WHERE name = 'SHIDO');

-- Friend.tech — SocialFi 软Rug
INSERT INTO projects (name, contract_address, chain, info_completeness, assessment_count, created_at)
SELECT 'Friend.tech', NULL, 'ethereum', 50, 0, now()
WHERE NOT EXISTS (SELECT 1 FROM projects WHERE name = 'Friend.tech');

-- LIBRA — 阿根廷总统发推Meme币（Solana）
INSERT INTO projects (name, contract_address, chain, info_completeness, assessment_count, created_at)
SELECT 'LIBRA', NULL, 'solana', 30, 0, now()
WHERE NOT EXISTS (SELECT 1 FROM projects WHERE name = 'LIBRA');

-- SIREN — BNB Chain AI代理控盘
INSERT INTO projects (name, contract_address, chain, info_completeness, assessment_count, created_at)
SELECT 'SIREN', NULL, 'bsc', 30, 0, now()
WHERE NOT EXISTS (SELECT 1 FROM projects WHERE name = 'SIREN');

-- HAWK — Solana 名人Meme币
INSERT INTO projects (name, contract_address, chain, info_completeness, assessment_count, created_at)
SELECT 'HAWK', NULL, 'solana', 30, 0, now()
WHERE NOT EXISTS (SELECT 1 FROM projects WHERE name = 'HAWK');

-- VerilyHK — TRON 假冒健康平台
INSERT INTO projects (name, contract_address, chain, info_completeness, assessment_count, created_at)
SELECT 'VerilyHK', NULL, 'tron', 30, 0, now()
WHERE NOT EXISTS (SELECT 1 FROM projects WHERE name = 'VerilyHK');

-- Blocto — Flow生态钱包，已停止运营
INSERT INTO projects (name, contract_address, chain, info_completeness, assessment_count, created_at)
SELECT 'Blocto', NULL, 'ethereum', 30, 0, now()
WHERE NOT EXISTS (SELECT 1 FROM projects WHERE name = 'Blocto');

-- CBEX — 中心化交易所，无合约地址
INSERT INTO projects (name, contract_address, chain, info_completeness, assessment_count, created_at)
SELECT 'CBEX', NULL, NULL, 20, 0, now()
WHERE NOT EXISTS (SELECT 1 FROM projects WHERE name = 'CBEX');

-- 拉菲协议 — 年化7786%崩盘
INSERT INTO projects (name, contract_address, chain, info_completeness, assessment_count, created_at)
SELECT '拉菲协议', NULL, NULL, 20, 0, now()
WHERE NOT EXISTS (SELECT 1 FROM projects WHERE name = '拉菲协议');

-- Mantra (OM) — 15分钟蒸发55亿美元
INSERT INTO projects (name, contract_address, chain, info_completeness, assessment_count, created_at)
SELECT 'Mantra (OM)', NULL, 'ethereum', 30, 0, now()
WHERE NOT EXISTS (SELECT 1 FROM projects WHERE name = 'Mantra (OM)');

-- SUI/NEAR OTC骗局
INSERT INTO projects (name, contract_address, chain, info_completeness, assessment_count, created_at)
SELECT 'SUI/NEAR OTC骗局', NULL, NULL, 20, 0, now()
WHERE NOT EXISTS (SELECT 1 FROM projects WHERE name = 'SUI/NEAR OTC骗局');

-- ============================================================
-- 第3步：检查录入结果
-- ============================================================
SELECT '=== 录入完成，检查结果 ===' as info;
SELECT id, name, COALESCE(contract_address, '(无地址)') as contract_address, chain, created_at
FROM projects
WHERE created_at >= now() - interval '10 minutes'
ORDER BY created_at DESC;
