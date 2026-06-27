/**
 * admin.mjs — 明鉴管理后台 API
 *
 * 所有端点都需 Bearer token 验证（通过 /api/admin/login 获取）
 * 密码从环境变量 ADMIN_PASSWORD 读取，默认 Aran28593117
 * 使用 HMAC 无状态 token，服务器重启后不丢失会话
 */

import { config } from 'dotenv';
config();

import { createHmac, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, accessSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Aran28593117';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 小时
// 服务器签名密钥（首次启动生成，重启后变化；但 token 里嵌了有效期，重启后只要密码相同仍可重新登录）
let SERVER_SECRET = randomBytes(32).toString('hex');

// ─── 无状态 token 工具 ──────────────────────────────────
// token 格式：base64(expiresAt_json).hex(hmac)
// 服务器验证时重新计算 HMAC，不需要存储 session

function createSessionToken() {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = JSON.stringify({ admin: true, expiresAt });
  const payloadB64 = Buffer.from(payload).toString('base64');
  const hmac = createHmac('sha256', SERVER_SECRET + ADMIN_PASSWORD)
    .update(payload)
    .digest('hex');
  return `${payloadB64}.${hmac}`;
}

function validateSessionToken(token) {
  try {
    const dotIdx = token.indexOf('.');
    if (dotIdx === -1) return null;
    const payloadB64 = token.slice(0, dotIdx);
    const sig = token.slice(dotIdx + 1);
    const payload = Buffer.from(payloadB64, 'base64').toString('utf8');
    const { expiresAt } = JSON.parse(payload);
    // 过期检查
    if (Date.now() > expiresAt) return null;
    // HMAC 校验
    const expected = createHmac('sha256', SERVER_SECRET + ADMIN_PASSWORD)
      .update(payload)
      .digest('hex');
    if (sig !== expected) return null;
    return { admin: true, expiresAt };
  } catch {
    return null;
  }
}

// ─── 工具函数 ──────────────────────────────────────────

function jsonRes(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString());
}

function getAuthToken(req) {
  const auth = req.headers['authorization'] || '';
  if (!auth.startsWith('Bearer ')) return null;
  return auth.slice(7).trim();
}

function requireAuth(req, res) {
  const token = getAuthToken(req);
  if (!token) { jsonRes(res, 401, { error: '未登录，请先登录' }); return false; }
  const session = validateSessionToken(token);
  if (!session) {
    jsonRes(res, 401, { error: '登录已过期，请重新登录' }); return false;
  }
  return true;
}

// Supabase 客户端（lazy init）
let _supabase = null;
async function getSupabase() {
  if (_supabase) return _supabase;
  const { createClient } = await import('@supabase/supabase-js');
  const roleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const keyToUse = roleKey || anonKey;
  console.log(`[Admin] Supabase client: using ${roleKey ? 'service_role' : 'anon'} key (${(keyToUse || '').slice(0, 15)}...)`);
  _supabase = createClient(process.env.VITE_SUPABASE_URL, keyToUse);
  return _supabase;
}

// ─── 路由器 ─────────────────────────────────────────────

const actions = {
  // POST /api/admin/login
  async login(req, res) {
    if (req.method !== 'POST') return jsonRes(res, 405, { error: 'Method not allowed' });
    const body = await readBody(req);
    const { password } = body;
    if (!password || password !== ADMIN_PASSWORD) {
      return jsonRes(res, 403, { error: '密码错误' });
    }
    // 每次登录刷新 token（旧 token 仍可用到过期，不影响）
    const token = createSessionToken();
    return jsonRes(res, 200, { success: true, token, expiresIn: SESSION_TTL_MS });
  },

  // GET /api/admin/dashboard
  async dashboard(req, res) {
    if (!requireAuth(req, res)) return;
    const supabase = await getSupabase();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);

    try {
      // 待处理提现
      const { count: pendingWd } = await supabase.from('withdrawals').select('*', { count: 'exact', head: true }).eq('status', 'pending');
      // 待审核证据
      const { count: pendingEv } = await supabase.from('evidence_submissions').select('*', { count: 'exact', head: true }).eq('status', 'pending');
      // 今日报告数（risk_reports + business_reports）
      const [{ count: riskToday }, { count: bizToday }] = await Promise.all([
        supabase.from('risk_reports').select('*', { count: 'exact', head: true }).gte('created_at', todayStr),
        supabase.from('business_reports').select('*', { count: 'exact', head: true }).gte('created_at', todayStr),
      ]);
      // 今日活跃评估用户（去重 user_address）
      const [{ data: riskUsers }, { data: bizUsers }] = await Promise.all([
        supabase.from('risk_reports').select('user_address').gte('created_at', todayStr),
        supabase.from('business_reports').select('user_address').gte('created_at', todayStr),
      ]);
      const activeUsers = new Set();
      (riskUsers || []).forEach(r => r.user_address && activeUsers.add(r.user_address.toLowerCase()));
      (bizUsers || []).forEach(r => r.user_address && activeUsers.add(r.user_address.toLowerCase()));

      // 用户总量（所有表去重）
      const [allRiskUsers, allBizUsers, inviters, invitees, wdUsers, couponUsers] = await Promise.all([
        supabase.from('risk_reports').select('user_address'),
        supabase.from('business_reports').select('user_address'),
        supabase.from('invitations').select('inviter'),
        supabase.from('invitations').select('invitee'),
        supabase.from('withdrawals').select('user_address'),
        supabase.from('coupons').select('user_address'),
      ]);
      const allUsers = new Set();
      (allRiskUsers.data || []).forEach(r => r.user_address && allUsers.add(r.user_address.toLowerCase()));
      (allBizUsers.data || []).forEach(r => r.user_address && allUsers.add(r.user_address.toLowerCase()));
      (inviters.data || []).forEach(r => r.inviter && allUsers.add(r.inviter.toLowerCase()));
      (invitees.data || []).forEach(r => r.invitee && allUsers.add(r.invitee.toLowerCase()));
      (wdUsers.data || []).forEach(r => r.user_address && allUsers.add(r.user_address.toLowerCase()));
      (couponUsers.data || []).forEach(r => r.user_address && allUsers.add(r.user_address.toLowerCase()));

      // 近 7 天趋势（risk_reports）
      const sevenDaysStr = sevenDaysAgo.toISOString();
      const { data: riskTrend } = await supabase
        .from('risk_reports')
        .select('created_at')
        .gte('created_at', sevenDaysStr)
        .order('created_at', { ascending: true });
      const { data: bizTrend } = await supabase
        .from('business_reports')
        .select('created_at')
        .gte('created_at', sevenDaysStr)
        .order('created_at', { ascending: true });

      // 聚合趋势（按天）
      const trends = {};
      for (let i = 0; i < 7; i++) {
        const d = new Date(Date.now() - i * 86400000);
        const key = d.toISOString().slice(0, 10);
        trends[key] = { date: key, riskReports: 0, bizReports: 0, total: 0 };
      }
      (riskTrend || []).forEach(r => {
        const key = r.created_at.slice(0, 10);
        if (trends[key]) trends[key].riskReports++;
      });
      (bizTrend || []).forEach(r => {
        const key = r.created_at.slice(0, 10);
        if (trends[key]) { trends[key].bizReports++; trends[key].total++; }
      });

      return jsonRes(res, 200, {
        success: true,
        cards: {
          todayReports: (riskToday || 0) + (bizToday || 0),
          todayUsers: activeUsers.size,
          totalUsers: allUsers.size,
          pendingWithdrawals: pendingWd || 0,
          pendingEvidences: pendingEv || 0,
        },
        trends: Object.values(trends).sort((a, b) => a.date.localeCompare(b.date)),
      });
    } catch (err) {
      return jsonRes(res, 500, { error: err.message });
    }
  },

  // GET /api/admin/withdrawals?status=pending
  async withdrawals(req, res) {
    if (!requireAuth(req, res)) return;
    const supabase = await getSupabase();
    const url = new URL(req.url, 'http://localhost');
    const status = url.searchParams.get('status') || 'pending';
    try {
      const { data, error } = await supabase
        .from('withdrawals')
        .select('*')
        .eq('status', status)
        .order('created_at', { ascending: false });
      if (error) return jsonRes(res, 500, { error: error.message });
      return jsonRes(res, 200, { success: true, data: data || [] });
    } catch (err) {
      return jsonRes(res, 500, { error: err.message });
    }
  },

  // POST /api/admin/withdrawals/complete
  async withdrawalsComplete(req, res) {
    if (!requireAuth(req, res)) return;
    const body = await readBody(req);
    const { id, tx_hash } = body;
    if (!id) return jsonRes(res, 400, { error: 'id is required' });
    const supabase = await getSupabase();
    const { error } = await supabase.from('withdrawals').update({
      status: 'completed',
      tx_hash: tx_hash || null,
      processed_at: new Date().toISOString(),
    }).eq('id', id);
    if (error) return jsonRes(res, 500, { error: error.message });
    return jsonRes(res, 200, { success: true });
  },

  // POST /api/admin/withdrawals/reject
  async withdrawalsReject(req, res) {
    if (!requireAuth(req, res)) return;
    const body = await readBody(req);
    const { id, reason } = body;
    if (!id) return jsonRes(res, 400, { error: 'id is required' });
    const supabase = await getSupabase();
    const { error } = await supabase.from('withdrawals').update({
      status: 'rejected',
      reject_reason: reason || null,
      processed_at: new Date().toISOString(),
    }).eq('id', id);
    if (error) return jsonRes(res, 500, { error: error.message });
    return jsonRes(res, 200, { success: true });
  },

  // GET /api/admin/evidences?status=pending
  async evidences(req, res) {
    if (!requireAuth(req, res)) return;
    const supabase = await getSupabase();
    const url = new URL(req.url, 'http://localhost');
    const status = url.searchParams.get('status') || 'pending';
    try {
      const { data, error } = await supabase
        .from('evidence_submissions')
        .select('*')
        .eq('status', status)
        .order('created_at', { ascending: false });
      if (error) return jsonRes(res, 500, { error: error.message });
      return jsonRes(res, 200, { success: true, data: data || [] });
    } catch (err) {
      return jsonRes(res, 500, { error: err.message });
    }
  },

  // POST /api/admin/evidences/approve
  async evidencesApprove(req, res) {
    if (!requireAuth(req, res)) return;
    const body = await readBody(req);
    const { id } = body;
    if (!id) return jsonRes(res, 400, { error: 'id is required' });
    const supabase = await getSupabase();
    const { error } = await supabase.from('evidence_submissions').update({
      status: 'verified',
    }).eq('id', id);
    if (error) return jsonRes(res, 500, { error: error.message });
    return jsonRes(res, 200, { success: true });
  },

  // POST /api/admin/evidences/reject
  async evidencesReject(req, res) {
    if (!requireAuth(req, res)) return;
    const body = await readBody(req);
    const { id } = body;
    if (!id) return jsonRes(res, 400, { error: 'id is required' });
    const supabase = await getSupabase();
    // 也删除关联的 verification 记录
    await supabase.from('evidence_verifications').delete().eq('evidence_id', id);
    const { error } = await supabase.from('evidence_submissions').update({
      status: 'rejected',
    }).eq('id', id);
    if (error) return jsonRes(res, 500, { error: error.message });
    return jsonRes(res, 200, { success: true });
  },

  // GET /api/admin/projects?search=keyword
  async projects(req, res) {
    if (!requireAuth(req, res)) return;
    const supabase = await getSupabase();
    const url = new URL(req.url, 'http://localhost');
    const search = url.searchParams.get('search') || '';
    try {
      let query = supabase.from('projects').select('*').order('created_at', { ascending: false });
      if (search) {
        query = query.ilike('name', `%${search}%`);
      }
      const { data, error } = await query;
      if (error) return jsonRes(res, 500, { error: error.message });
      return jsonRes(res, 200, { success: true, data: data || [] });
    } catch (err) {
      return jsonRes(res, 500, { error: err.message });
    }
  },

  // POST /api/admin/projects/add
  async projectsAdd(req, res) {
    if (!requireAuth(req, res)) return;
    const body = await readBody(req);
    const { name, contract_address, chain, info_completeness } = body;
    if (!name) return jsonRes(res, 400, { error: 'name is required' });
    const supabase = await getSupabase();
    const { data, error } = await supabase.from('projects').insert({
      name,
      contract_address: contract_address?.trim() || null,
      chain: chain || 'bsc',
      info_completeness: info_completeness ? parseInt(info_completeness) : null,
      assessment_count: 0,
    }).select('id');
    if (error) return jsonRes(res, 500, { error: error.message });
    return jsonRes(res, 200, { success: true, id: data?.[0]?.id });
  },

  // PUT /api/admin/projects/rename
  async projectsRename(req, res) {
    if (!requireAuth(req, res)) return;
    const body = await readBody(req);
    const { id, name } = body;
    if (!id || !name) return jsonRes(res, 400, { error: 'id and name are required' });
    const supabase = await getSupabase();
    // 读取当前项目，把旧名称存入 previous_names
    const { data: proj } = await supabase.from('projects').select('name, previous_names').eq('id', id).single();
    const oldNames = proj?.previous_names || [];
    if (proj && proj.name !== name.trim() && !oldNames.includes(proj.name)) {
      oldNames.push(proj.name);
    }
    const { error } = await supabase.from('projects').update({
      name: name.trim(),
      previous_names: oldNames,
      name_updated_at: new Date().toISOString(),
    }).eq('id', id);
    if (error) return jsonRes(res, 500, { error: error.message });
    return jsonRes(res, 200, { success: true });
  },

  // DELETE /api/admin/projects/delete
  async projectsDelete(req, res) {
    if (!requireAuth(req, res)) return;
    const body = await readBody(req);
    const { id } = body;
    if (!id) return jsonRes(res, 400, { error: 'id is required' });
    const supabase = await getSupabase();
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) return jsonRes(res, 500, { error: error.message });
    return jsonRes(res, 200, { success: true });
  },

  // POST /api/admin/projects/trust — 切换 is_trusted 状态
  async projectsTrust(req, res) {
    if (!requireAuth(req, res)) return;
    const body = await readBody(req);
    const { id, is_trusted } = body;
    if (!id) return jsonRes(res, 400, { error: 'id is required' });
    const supabase = await getSupabase();
    const { error } = await supabase.from('projects').update({
      is_trusted: !!is_trusted,
    }).eq('id', id);
    if (error) return jsonRes(res, 500, { error: error.message });
    console.log(`[Admin] 项目 ${id} is_trusted = ${!!is_trusted}`);
    return jsonRes(res, 200, { success: true });
  },

  // GET /api/admin/users?search=addr
  async users(req, res) {
    if (!requireAuth(req, res)) return;
    const supabase = await getSupabase();
    const url = new URL(req.url, 'http://localhost');
    const search = url.searchParams.get('search') || '';
    try {
      // 从多个表聚合用户数据
      // 1. 获取所有有交互的钱包地址
      const [inviters, invitees, riskUsers, bizUsers, wdUsers, couponUsers] = await Promise.all([
        supabase.from('invitations').select('inviter, created_at'),
        supabase.from('invitations').select('invitee, created_at'),
        supabase.from('risk_reports').select('user_address, created_at'),
        supabase.from('business_reports').select('user_address, created_at'),
        supabase.from('withdrawals').select('user_address'),
        supabase.from('coupons').select('user_address'),
      ]);
      const userMap = new Map();
      const addUser = (addr, time) => {
        if (!addr) return;
        const key = addr.toLowerCase();
        if (!userMap.has(key)) userMap.set(key, { address: addr, firstSeen: time, assessCount: 0, inviteCount: 0, couponCount: 0, withdrawable: 0 });
        const u = userMap.get(key);
        if (time && (!u.firstSeen || time < u.firstSeen)) u.firstSeen = time;
      };
      (inviters.data || []).forEach(r => addUser(r.inviter, r.created_at));
      (invitees.data || []).forEach(r => addUser(r.invitee, r.created_at));
      (riskUsers.data || []).forEach(r => addUser(r.user_address, r.created_at));
      (bizUsers.data || []).forEach(r => addUser(r.user_address, r.created_at));
      (wdUsers.data || []).forEach(r => addUser(r.user_address));
      (couponUsers.data || []).forEach(r => addUser(r.user_address));

      // 统计每个地址的评估次数
      const addrList = [...userMap.keys()];
      if (addrList.length === 0) return jsonRes(res, 200, { success: true, data: [] });

      // 邀请人数
      const { data: inviteCounts } = await supabase
        .from('invitations')
        .select('inviter, status');
      if (inviteCounts) {
        const counts = {};
        inviteCounts.forEach(r => {
          const k = r.inviter?.toLowerCase();
          if (k) counts[k] = (counts[k] || 0) + 1;
        });
        for (const [k, v] of Object.entries(counts)) {
          if (userMap.has(k)) userMap.get(k).inviteCount = v;
        }
      }

      // 代金券数量
      const { data: couponData } = await supabase
        .from('coupons')
        .select('user_address, status');
      if (couponData) {
        couponData.forEach(r => {
          const k = r.user_address?.toLowerCase();
          if (k && userMap.has(k) && r.status === 'active') userMap.get(k).couponCount++;
        });
      }

      // 评估次数
      const { data: riskAssess } = await supabase
        .from('risk_reports')
        .select('user_address');
      if (riskAssess) {
        riskAssess.forEach(r => {
          const k = r.user_address?.toLowerCase();
          if (k && userMap.has(k)) userMap.get(k).assessCount++;
        });
      }
      const { data: bizAssess } = await supabase
        .from('business_reports')
        .select('user_address');
      if (bizAssess) {
        bizAssess.forEach(r => {
          const k = r.user_address?.toLowerCase();
          if (k && userMap.has(k)) userMap.get(k).assessCount++;
        });
      }

      let users = [...userMap.values()];
      if (search) {
        const q = search.toLowerCase();
        users = users.filter(u => u.address.toLowerCase().includes(q));
      }
      users.sort((a, b) => (b.firstSeen || '').localeCompare(a.firstSeen || ''));

      return jsonRes(res, 200, { success: true, data: users });
    } catch (err) {
      return jsonRes(res, 500, { error: err.message });
    }
  },

  // GET /api/admin/user-detail?address=0x...
  async userDetail(req, res) {
    if (!requireAuth(req, res)) return;
    const supabase = await getSupabase();
    const url = new URL(req.url, 'http://localhost');
    const address = url.searchParams.get('address') || '';
    if (!address) return jsonRes(res, 400, { error: 'address is required' });
    const addr = address.toLowerCase();

    try {
      const [riskReports, bizReports, invitations, coupons, withdrawals] = await Promise.all([
        supabase.from('risk_reports').select('*').ilike('user_address', addr).order('created_at', { ascending: false }),
        supabase.from('business_reports').select('*').ilike('user_address', addr).order('created_at', { ascending: false }),
        supabase.from('invitations').select('*').or(`inviter.ilike.${addr},invitee.ilike.${addr}`),
        supabase.from('coupons').select('*').ilike('user_address', addr),
        supabase.from('withdrawals').select('*').ilike('user_address', addr).order('created_at', { ascending: false }),
      ]);

      return jsonRes(res, 200, {
        success: true,
        data: {
          address,
          riskReports: riskReports.data || [],
          bizReports: bizReports.data || [],
          invitations: invitations.data || [],
          coupons: coupons.data || [],
          withdrawals: withdrawals.data || [],
        },
      });
    } catch (err) {
      return jsonRes(res, 500, { error: err.message });
    }
  },

  // GET /api/admin/feedback?status=pending
  async feedback(req, res) {
    if (!requireAuth(req, res)) return;
    const supabase = await getSupabase();
    const url = new URL(req.url, 'http://localhost');
    const status = url.searchParams.get('status') || 'pending';
    try {
      const { data, error } = await supabase
        .from('feedback')
        .select('*')
        .eq('status', status)
        .order('created_at', { ascending: false });
      if (error) return jsonRes(res, 500, { error: error.message });
      return jsonRes(res, 200, { success: true, data: data || [] });
    } catch (err) {
      return jsonRes(res, 500, { error: err.message });
    }
  },

  // POST /api/admin/feedback/resolve
  async feedbackResolve(req, res) {
    if (!requireAuth(req, res)) return;
    const body = await readBody(req);
    const { id } = body;
    if (!id) return jsonRes(res, 400, { error: 'id is required' });
    const supabase = await getSupabase();
    const { error } = await supabase.from('feedback').update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
    }).eq('id', id);
    if (error) return jsonRes(res, 500, { error: error.message });
    return jsonRes(res, 200, { success: true });
  },

  // ─── 站点配置 ────────────────────────────────────────

  _configPath() {
    return join(dirname(fileURLToPath(import.meta.url)), 'config', 'site-config.json');
  },

  // 读取配置
  _readConfig() {
    try {
      return JSON.parse(readFileSync(this._configPath(), 'utf-8'));
    } catch { return {}; }
  },

  // 写入配置
  _writeConfig(config) {
    try {
      const dir = join(dirname(fileURLToPath(import.meta.url)), 'config');
      try { accessSync(dir); } catch { mkdirSync(dir, { recursive: true }); }
      writeFileSync(this._configPath(), JSON.stringify(config, null, 2), 'utf-8');
    } catch (e) { console.error('[Config] 写入失败:', e.message); }
  },

  // GET /api/admin/config?key=xxx
  async configGet(req, res) {
    if (!requireAuth(req, res)) return;
    const url = new URL(req.url, 'http://localhost');
    const key = url.searchParams.get('key');
    const config = this._readConfig();
    if (key) {
      return jsonRes(res, 200, { success: true, data: { [key]: config[key] || null } });
    }
    return jsonRes(res, 200, { success: true, data: config });
  },

  // POST /api/admin/config
  async configSet(req, res) {
    if (!requireAuth(req, res)) return;
    const body = await readBody(req);
    const { key, value } = body;
    if (!key) return jsonRes(res, 400, { error: 'key is required' });
    const config = this._readConfig();
    config[key] = String(value);
    config._updatedAt = new Date().toISOString();
    this._writeConfig(config);
    console.log(`[Config] 配置更新: ${key} = ${value}`);
    return jsonRes(res, 200, { success: true });
  },
};

// ─── 主路由 ─────────────────────────────────────────────

export async function handleAdmin(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname.replace(/^\/api\/admin\/?/, '').replace(/\/$/, '');
  // 路径映射
  const actionMap = {
    'login': 'login',
    'dashboard': 'dashboard',
    'withdrawals': 'withdrawals',
    'withdrawals/complete': 'withdrawalsComplete',
    'withdrawals/reject': 'withdrawalsReject',
    'evidences': 'evidences',
    'evidences/approve': 'evidencesApprove',
    'evidences/reject': 'evidencesReject',
    'projects': 'projects',
    'projects/add': 'projectsAdd',
    'projects/rename': 'projectsRename',
    'projects/delete': 'projectsDelete',
    'projects/trust': 'projectsTrust',
    'users': 'users',
    'user-detail': 'userDetail',
    'feedback': 'feedback',
    'feedback/resolve': 'feedbackResolve',
    'config': 'configGet',
    'config/set': 'configSet',
  };

  const action = actionMap[path];
  if (!action || !actions[action]) {
    return jsonRes(res, 404, { error: 'Admin endpoint not found: ' + path });
  }
  try {
    await actions[action](req, res);
  } catch (err) {
    console.error('[Admin] Error:', err.message);
    jsonRes(res, 500, { error: err.message });
  }
}
