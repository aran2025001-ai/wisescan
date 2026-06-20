-- 004_create_project_facts.sql
-- 项目事实缓存表（Project Ledger Tier 2）
-- 用途：存储每个合约地址的已确认客观事实，只增不减
-- 执行方式：Supabase Dashboard → SQL Editor → 粘贴运行

create table if not exists public.project_facts (
  id serial primary key,
  project_name text,
  contract_address text unique not null,
  
  -- 事实（只增不减）
  mode_change_count integer default 0,
  mode_change_articles text[],
  withdraw_issue_count integer default 0,
  withdraw_issue_evidence text[],
  funding_rounds text[],
  audits text[],
  
  -- 动态数据（覆盖式更新）
  top10_holding_percent decimal,
  top10_holding_at timestamp with time zone,
  legal_entities text[],
  
  -- 布尔标志
  has_license boolean default false,
  has_audit boolean default false,
  has_funding boolean default false,
  
  -- 可信度
  confidence_score decimal default 0.0,
  is_confirmed boolean default false,
  total_searches integer default 0,
  
  -- Tier 1 报告缓存
  cached_report jsonb,
  cached_at timestamp with time zone,
  
  -- 元数据
  last_searched_at timestamp with time zone default now(),
  detected_chain text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 索引
create index if not exists idx_project_facts_contract_address on public.project_facts(contract_address);
create index if not exists idx_project_facts_project_name on public.project_facts(project_name);
create index if not exists idx_project_facts_last_searched on public.project_facts(last_searched_at);

-- RLS 策略：anon 可读写（与 projects/risk_reports 表策略一致）
alter table public.project_facts enable row level security;
create policy "Allow anon full access on project_facts"
  on public.project_facts
  for all
  to anon
  using (true)
  with check (true);

-- 自动更新 updated_at
create or replace function public.update_project_facts_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_project_facts_updated_at
  before update on public.project_facts
  for each row
  execute function public.update_project_facts_updated_at();
