export const SCHEMA_VERSION = 1;

export const SCHEMA = `
create table if not exists settings(key text primary key, value jsonb not null);

create table if not exists students(
  roll_no text primary key, name text not null, email text not null,
  dept text, section text, created_at timestamptz not null default now());

create table if not exists staff(
  email text primary key, role text not null check (role in ('admin','jury')), name text,
  created_at timestamptz not null default now());

create table if not exists otps(
  id bigserial primary key, identifier text not null, code_hash text not null,
  expires_at timestamptz not null, attempts int not null default 0, used boolean not null default false,
  created_at timestamptz not null default now());
create index if not exists otps_ident on otps(identifier, created_at desc);

create table if not exists rate_limits(
  key text not null, bucket bigint not null, count int not null default 0, exp bigint not null,
  primary key(key, bucket));

create table if not exists teams(
  id uuid primary key default gen_random_uuid(), name text not null,
  leader_roll text not null unique references students(roll_no),
  custom jsonb, custom_status text, custom_review jsonb,
  created_at timestamptz not null default now());
create unique index if not exists teams_name_lower on teams(lower(name));

create table if not exists team_members(
  roll_no text primary key references students(roll_no),
  team_id uuid not null references teams(id) on delete cascade,
  joined_at timestamptz not null default now());
create index if not exists tm_team on team_members(team_id);

create table if not exists topics(
  id int primary key, title text not null unique, category text not null,
  claimed_by uuid unique references teams(id) on delete set null);

create table if not exists files(
  id uuid primary key default gen_random_uuid(), team_id uuid not null references teams(id) on delete cascade,
  phase int not null check (phase in (1,2,3)), kind text not null check (kind in ('pdf','image')),
  blob_path text not null, filename text not null, size int not null, sha256 text not null,
  declared boolean not null default false, uploaded_by text not null,
  created_at timestamptz not null default now());
create index if not exists files_lookup on files(team_id, phase, kind, created_at desc);

create table if not exists evaluations(
  team_id uuid not null references teams(id) on delete cascade, phase int not null,
  file_id uuid references files(id), status text not null default 'pending',
  scores jsonb, total numeric, summary text, flags jsonb not null default '[]',
  model text, rubric_version text, attempts int not null default 0,
  override_total numeric, override_note text, reeval_requested boolean not null default false,
  error text, updated_at timestamptz not null default now(),
  primary key(team_id, phase));
create index if not exists eval_status on evaluations(phase, status);

create table if not exists jury_marks(
  team_id uuid not null references teams(id) on delete cascade, juror text not null,
  scores jsonb not null, total numeric not null, updated_at timestamptz not null default now(),
  primary key(team_id, juror));

create table if not exists audit_log(
  id bigserial primary key, at timestamptz not null default now(), actor text, action text, detail jsonb);
`;
