create extension if not exists pgcrypto;

create table if not exists schools (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null,
  name text not null,
  address text not null,
  created_at timestamptz not null default now()
);

create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references schools(id) on delete cascade,
  name text not null,
  teacher_name text not null,
  room text not null,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now()
);

create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references classes(id) on delete cascade,
  full_name text not null,
  phone text not null,
  status text not null default 'active' check (status in ('active', 'at-risk', 'inactive')),
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references classes(id) on delete cascade,
  name text not null,
  student_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references classes(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  date date not null,
  status text not null check (status in ('present', 'late', 'absent', 'excused')),
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists rewards (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references classes(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  type text not null check (type in ('points', 'badge', 'certificate')),
  title text not null,
  points integer not null check (points >= -500 and points <= 500),
  created_at timestamptz not null default now()
);

create table if not exists assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references classes(id) on delete cascade,
  title text not null,
  description text not null,
  due_date date not null,
  status text not null default 'todo' check (status in ('todo', 'review', 'done')),
  created_at timestamptz not null default now()
);

create table if not exists assessments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references classes(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  title text not null,
  score numeric(4,1) not null check (score >= 0 and score <= 10),
  date date not null,
  created_at timestamptz not null default now()
);

create table if not exists sync_queue (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  operation_type text not null check (operation_type in ('create', 'update', 'delete')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'synced', 'failed')),
  retry_count integer not null default 0,
  last_attempted_at timestamptz,
  next_retry_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now()
);

create index if not exists idx_classes_school_id on classes(school_id);
create index if not exists idx_students_class_id on students(class_id);
create index if not exists idx_groups_class_id on groups(class_id);
create index if not exists idx_attendance_student_id on attendance(student_id);
create index if not exists idx_rewards_student_id on rewards(student_id);
create index if not exists idx_assessments_student_id on assessments(student_id);
create index if not exists idx_sync_queue_status on sync_queue(status);

alter table schools enable row level security;
alter table classes enable row level security;
alter table students enable row level security;
alter table groups enable row level security;
alter table attendance enable row level security;
alter table rewards enable row level security;
alter table assignments enable row level security;
alter table assessments enable row level security;
alter table sync_queue enable row level security;

drop policy if exists "schools_read_all" on schools;
create policy "schools_read_all"
  on schools for select
  using (true);

drop policy if exists "classes_read_all" on classes;
create policy "classes_read_all"
  on classes for select
  using (true);

drop policy if exists "students_read_all" on students;
create policy "students_read_all"
  on students for select
  using (true);

drop policy if exists "groups_read_all" on groups;
create policy "groups_read_all"
  on groups for select
  using (true);

drop policy if exists "attendance_read_all" on attendance;
create policy "attendance_read_all"
  on attendance for select
  using (true);

drop policy if exists "rewards_read_all" on rewards;
create policy "rewards_read_all"
  on rewards for select
  using (true);

drop policy if exists "assignments_read_all" on assignments;
create policy "assignments_read_all"
  on assignments for select
  using (true);

drop policy if exists "assessments_read_all" on assessments;
create policy "assessments_read_all"
  on assessments for select
  using (true);

drop policy if exists "sync_queue_read_all" on sync_queue;
create policy "sync_queue_read_all"
  on sync_queue for select
  using (true);

drop policy if exists "schools_write_authenticated" on schools;
create policy "schools_write_authenticated"
  on schools for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "classes_write_authenticated" on classes;
create policy "classes_write_authenticated"
  on classes for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "students_write_authenticated" on students;
create policy "students_write_authenticated"
  on students for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "groups_write_authenticated" on groups;
create policy "groups_write_authenticated"
  on groups for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "attendance_write_authenticated" on attendance;
create policy "attendance_write_authenticated"
  on attendance for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "rewards_write_authenticated" on rewards;
create policy "rewards_write_authenticated"
  on rewards for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "assignments_write_authenticated" on assignments;
create policy "assignments_write_authenticated"
  on assignments for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "assessments_write_authenticated" on assessments;
create policy "assessments_write_authenticated"
  on assessments for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "sync_queue_write_authenticated" on sync_queue;
create policy "sync_queue_write_authenticated"
  on sync_queue for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
