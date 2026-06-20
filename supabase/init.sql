-- 明鉴 WiseScan 数据库初始化 SQL
-- 执行方式：Supabase Dashboard → SQL Editor → 粘贴运行

-- 1. projects（项目库主表）
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text,
  contract_address text,
  logo_url text,
  website text,
  twitter text,
  telegram text,
  eval_count int default 0,
  last_eval_time timestamp with time zone,
  keyword_cloud text[],
  info_completeness_percent int check (info_completeness_percent between 0 and 100),
  created_at timestamp with time zone default now()
);

-- 2. evaluation_reports（安全评估报告）
create table if not exists public.evaluation_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id),
  user_address text,
  report_json jsonb not null,
  total_score int check (total_score between 0 and 100),
  risk_level text,
  six_dim_scores jsonb,
  is_latest boolean default true,
  created_at timestamp with time zone default now()
);

-- 3. business_reports（精算报告）
create table if not exists public.business_reports (
  id uuid primary key default gen_random_uuid(),
  user_address text,
  input_text text,
  parsed_rules jsonb,
  report_json jsonb,
  created_at timestamp with time zone default now()
);

-- 4. user_contributions（众包贡献）
create table if not exists public.user_contributions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id),
  contributor_address text,
  content_type text check (content_type in ('screenshot','text','link')),
  content_url text,
  verified_count int default 0,
  status text default 'pending' check (status in ('pending','approved','rejected')),
  reward_amount decimal default 0,
  created_at timestamp with time zone default now()
);

-- 5. invitations（邀请关系）
create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  inviter_address text,
  invitee_address text,
  invite_code text,
  paid_amount decimal,
  commission decimal,
  status text default 'pending' check (status in ('pending','paid')),
  created_at timestamp with time zone default now()
);

-- 6. vouchers（代金券）
create table if not exists public.vouchers (
  id uuid primary key default gen_random_uuid(),
  user_address text,
  amount decimal,
  expires_at timestamp with time zone,
  used boolean default false,
  source text,
  created_at timestamp with time zone default now()
);

-- 7. withdrawals（提现申请）
create table if not exists public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_address text,
  amount decimal,
  address text,
  status text default 'pending' check (status in ('pending','completed','rejected')),
  created_at timestamp with time zone default now(),
  processed_at timestamp with time zone
);

-- 启用 RLS（行级安全）
alter table public.evaluation_reports enable row level security;
alter table public.business_reports enable row level security;
alter table public.vouchers enable row level security;
alter table public.withdrawals enable row level security;

-- 用户只能查自己的报告（RLS 策略，依赖 Supabase Auth 的 JWT）
-- 注意：MVP 阶段可先不启用 RLS，等接入 Auth 后再配置
-- create policy "Users can view own evaluation reports"
--   on public.evaluation_reports for select
--   using (user_address = current_setting('request.jwt.claims.address', true)::text);

-- 索引优化
create index if not exists idx_evaluation_reports_user_address on public.evaluation_reports(user_address);
create index if not exists idx_evaluation_reports_project_id on public.evaluation_reports(project_id);
create index if not exists idx_business_reports_user_address on public.business_reports(user_address);
create index if not exists idx_invitations_inviter on public.invitations(inviter_address);
create index if not exists idx_withdrawals_status on public.withdrawals(status);

-- 完成提示
select 'WiseScan 数据库初始化完成！共创建 7 张表。' as result;
