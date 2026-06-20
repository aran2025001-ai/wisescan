/**
 * 项目库数据访问层
 *
 * 当前阶段：localStorage 模拟云端行为
 * 切换 Supabase 时：替换本文件中的实现即可，外部调用方无需改动。
 */

// ── 类型（对应 Supabase projects 表） ──

export interface PreviousName {
  name: string
  updated_at: string
}

export interface ProjectRecord {
  id: string
  name: string
  contractAddress: string
  riskLevel: number // 1-良好 2-中等 3-需谨慎
  assessmentCount: number
  lastEvaluatedAt: string // ISO 8601
  hasReport: boolean // 是否有过付费评估报告
  createdAt: string // ISO 8601
  previousNames?: PreviousName[] // 曾用名
}

// ── 种子数据（首次使用时填充，Supabase 接入后删除） ──

const SEED_PROJECTS: ProjectRecord[] = [
  { id: "proj_seed_1", name: "Uniswap V3", contractAddress: "0x1111111254fb6c44bac0bed2854e76f90643097d", riskLevel: 1, assessmentCount: 24, lastEvaluatedAt: "2026-06-08T12:00:00.000Z", hasReport: false, createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "proj_seed_2", name: "OpenSea", contractAddress: "0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0", riskLevel: 2, assessmentCount: 18, lastEvaluatedAt: "2026-06-07T12:00:00.000Z", hasReport: false, createdAt: "2026-01-02T00:00:00.000Z" },
  { id: "proj_seed_3", name: "Aave Protocol", contractAddress: "0xbc6da0fe9ad7e36c3130ee5145995e756ed970d9", riskLevel: 1, assessmentCount: 32, lastEvaluatedAt: "2026-06-09T12:00:00.000Z", hasReport: false, createdAt: "2026-01-03T00:00:00.000Z" },
  { id: "proj_seed_4", name: "Curve Finance", contractAddress: "0xd533a949740bb3306d119cc777fa900ba034cd52", riskLevel: 2, assessmentCount: 15, lastEvaluatedAt: "2026-06-06T12:00:00.000Z", hasReport: false, createdAt: "2026-01-04T00:00:00.000Z" },
  { id: "proj_seed_5", name: "MakerDAO", contractAddress: "0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2", riskLevel: 3, assessmentCount: 12, lastEvaluatedAt: "2026-06-05T12:00:00.000Z", hasReport: false, createdAt: "2026-01-05T00:00:00.000Z" },
  { id: "proj_seed_6", name: "Compound", contractAddress: "0xc00e94cb662c3520282e6f5717214fead7fec68", riskLevel: 1, assessmentCount: 28, lastEvaluatedAt: "2026-06-08T12:00:00.000Z", hasReport: false, createdAt: "2026-01-06T00:00:00.000Z" },
  { id: "proj_seed_7", name: "Lido Finance", contractAddress: "0x5a98fcbea516cf06857215779fd812ca3bef1b32", riskLevel: 2, assessmentCount: 21, lastEvaluatedAt: "2026-06-07T12:00:00.000Z", hasReport: false, createdAt: "2026-01-07T00:00:00.000Z" },
  { id: "proj_seed_8", name: "Yearn Finance", contractAddress: "0x0bc529c00c6401aef6d220be8c6ea1667f6ad93e", riskLevel: 3, assessmentCount: 10, lastEvaluatedAt: "2026-06-04T12:00:00.000Z", hasReport: false, createdAt: "2026-01-08T00:00:00.000Z" },
  { id: "proj_seed_9", name: "Chainlink Oracle", contractAddress: "0x514910771af9ca656af840dff83e8264ecf986ca", riskLevel: 1, assessmentCount: 45, lastEvaluatedAt: "2026-06-10T12:00:00.000Z", hasReport: false, createdAt: "2026-01-09T00:00:00.000Z" },
]

// ── localStorage key ──

const STORAGE_KEY = "wisescan_project_library"

// ── 内部工具 ──

function ensureSeed(): void {
  const existing = loadAll()
  if (existing.length === 0) {
    saveAll(SEED_PROJECTS)
  }
}

function loadAll(): ProjectRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveAll(projects: ProjectRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))
}

// ▸ 生成简短 ID（Supabase 接入后由数据库生成 uuid）
function generateId(): string {
  return `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

// ── 公开 API ──

/** 获取全部项目 */
export function getAllProjects(): ProjectRecord[] {
  ensureSeed()
  return loadAll()
}

/** 按合约地址查找（用于去重） */
export function getProjectByAddress(address: string): ProjectRecord | undefined {
  const lower = address.toLowerCase()
  return loadAll().find((p) => p.contractAddress.toLowerCase() === lower)
}

/**
 * 保存 / 更新项目
 * - 新项目 → 新增
 * - 已有项目 → 更新 assessmentCount / lastEvaluatedAt / hasReport
 */
export function upsertProject(project: {
  name: string
  contractAddress: string
  riskLevel?: number
  hasReport?: boolean
}): ProjectRecord {
  const projects = loadAll()
  const lowerAddr = project.contractAddress.toLowerCase()
  const existingIndex = projects.findIndex(
    (p) => p.contractAddress.toLowerCase() === lowerAddr
  )

  const now = new Date().toISOString()

  if (existingIndex >= 0) {
    // 更新已有项目
    const existing = projects[existingIndex]
    const updated: ProjectRecord = {
      ...existing,
      name: project.name || existing.name,
      riskLevel: project.riskLevel ?? existing.riskLevel,
      assessmentCount: existing.assessmentCount + 1,
      lastEvaluatedAt: now,
      hasReport: project.hasReport ?? existing.hasReport,
    }
    projects[existingIndex] = updated
    saveAll(projects)
    return updated
  } else {
    // 新增
    const newProject: ProjectRecord = {
      id: generateId(),
      name: project.name,
      contractAddress: project.contractAddress,
      riskLevel: project.riskLevel ?? 1,
      assessmentCount: 1,
      lastEvaluatedAt: now,
      hasReport: project.hasReport ?? false,
      createdAt: now,
    }
    projects.push(newProject)
    saveAll(projects)
    return newProject
  }
}

/** 搜索项目（前端模糊匹配，Supabase 接入后改为后端搜索） */
export function searchProjects(
  query: string,
  projects?: ProjectRecord[]
): ProjectRecord[] {
  const all = projects ?? loadAll()
  const q = query.toLowerCase()
  if (!q) return all
  return all.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.contractAddress.toLowerCase().includes(q)
  )
}

/** 删除项目（管理用） */
export function deleteProject(id: string): void {
  const projects = loadAll().filter((p) => p.id !== id)
  saveAll(projects)
}
