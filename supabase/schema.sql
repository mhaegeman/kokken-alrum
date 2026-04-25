-- ═══════════════════════════════════════════════════════════════
-- Køkken alrum — initial schema, seed data, and RLS
-- Paste this entire file into Supabase SQL Editor and run.
-- Safe to re-run: everything is idempotent.
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. profiles ───────────────────────────────────────────────
-- One row per auth.users row. Holds display name + which avatar (palm tree
-- or rose). Inserted automatically on signup via the trigger below.
--
-- Email is nullable so guest (anonymous) users can have a profile too.
-- is_guest distinguishes between full members (Max, Karo) and link-invited
-- guests; RLS rules below treat the two differently.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  display_name text not null default '',
  tone text not null default 'forest' check (tone in ('forest','rose')),
  avatar text not null default 'palm' check (avatar in ('palm','rose')),
  is_guest boolean not null default false,
  created_at timestamptz not null default now()
);

-- Forward-compat: relax/add columns when upgrading an older schema.
alter table public.profiles alter column email drop not null;
alter table public.profiles add column if not exists is_guest boolean not null default false;

-- Auto-create a profile when a new auth user is created. Anonymous
-- (guest) users have no email — they get a placeholder display name
-- and is_guest = true; they pick a real name when they accept the
-- invite (see public.accept_guest_invite below).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := new.email;
  v_is_anon boolean := coalesce(new.is_anonymous, false);
  v_display text;
  v_tone text;
  v_avatar text;
  v_is_guest boolean;
begin
  if v_is_anon or v_email is null then
    v_display := 'Guest';
    v_tone := 'forest';
    v_avatar := 'palm';
    v_is_guest := true;
  else
    case lower(v_email)
      when 'maximehaegeman@gmail.com' then
        v_display := 'Max'; v_tone := 'forest'; v_avatar := 'palm';
      when 'karoline.j.geiker@gmail.com' then
        v_display := 'Karo'; v_tone := 'rose'; v_avatar := 'rose';
      else
        v_display := split_part(v_email, '@', 1);
        v_tone := 'forest';
        v_avatar := 'palm';
    end case;
    v_is_guest := false;
  end if;

  insert into public.profiles (id, email, display_name, tone, avatar, is_guest)
  values (new.id, v_email, v_display, v_tone, v_avatar, v_is_guest)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper: true when the current request is from a guest (anonymous) user.
-- Used in RLS policies to lock guests out of write actions on shared data
-- (tasks, budget, topics) while still letting them post comments + uploads.
create or replace function public.current_user_is_guest()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_guest from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

-- ─── 2. phases (lookup, project-wide) ──────────────────────────
create table if not exists public.phases (
  id integer primary key,
  name text not null,
  color text not null,
  sort_order integer not null default 0
);

-- ─── 3. budget_categories (lookup, project-wide) ───────────────
create table if not exists public.budget_categories (
  id text primary key,
  name text not null,
  sort_order integer not null default 0
);

-- ─── 4. project_settings (single row) ──────────────────────────
create table if not exists public.project_settings (
  id integer primary key default 1 check (id = 1),
  start_date date not null default '2026-05-01',
  currency text not null default 'DKK',
  total_budget_target numeric not null default 180000,
  updated_at timestamptz not null default now()
);

-- ─── 5. tasks ──────────────────────────────────────────────────
create table if not exists public.tasks (
  id integer primary key,
  phase_id integer not null references public.phases(id),
  title text not null,
  priority text not null default 'medium' check (priority in ('high','medium','low')),
  status text not null default 'not_started' check (status in ('not_started','in_progress','blocked','done')),
  duration integer not null default 0,
  deps integer[] not null default '{}',
  start_date date,
  end_date date,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Forward-compat: add description column if upgrading an older schema.
alter table public.tasks add column if not exists description text not null default '';

-- Keep an auto-incrementing sequence so inserts from the client can use it.
create sequence if not exists public.tasks_id_seq owned by public.tasks.id;
alter table public.tasks alter column id set default nextval('public.tasks_id_seq');

-- ─── 6. comments ───────────────────────────────────────────────
create table if not exists public.comments (
  id bigserial primary key,
  task_id integer not null references public.tasks(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists comments_task_id_idx on public.comments(task_id);

-- ─── 6b. attachments (files or external links, per task or budget item) ──
-- The FK to budget_items + the XOR check are added after section 7 below,
-- since budget_items is created later in this file.
create table if not exists public.attachments (
  id bigserial primary key,
  task_id integer references public.tasks(id) on delete cascade,
  kind text not null check (kind in ('file','link')),
  storage_path text,
  url text,
  filename text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists attachments_task_id_idx on public.attachments(task_id);

-- ─── 7. budget_items ───────────────────────────────────────────
create table if not exists public.budget_items (
  id integer primary key,
  category_id text not null references public.budget_categories(id),
  name text not null,
  estimate numeric not null default 0,
  actual numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create sequence if not exists public.budget_items_id_seq owned by public.budget_items.id;
alter table public.budget_items alter column id set default nextval('public.budget_items_id_seq');

-- ─── 7b. attachments → budget_items link + XOR check ───────────
-- Now that budget_items exists, add the FK column + the constraint that
-- enforces "an attachment has exactly one parent (task or budget item)".
alter table public.attachments alter column task_id drop not null;
alter table public.attachments add column if not exists budget_item_id integer references public.budget_items(id) on delete cascade;

alter table public.attachments drop constraint if exists attachments_payload_check;
-- The final XOR (task vs budget vs note_message) is installed in section
-- 8a once note_messages exists. We can't add the 2-way version here
-- because re-running on a DB that already has note_message attachments
-- would reject those existing rows.

create index if not exists attachments_budget_item_id_idx on public.attachments(budget_item_id);

-- ─── 8. notes_topics + note_messages ───────────────────────────
-- Shared discussion threads, one topic per subject (e.g. "Fridge choice").

create table if not exists public.notes_topics (
  id bigserial primary key,
  title text not null,
  created_by uuid references public.profiles(id) on delete set null,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.note_messages (
  id bigserial primary key,
  topic_id bigint not null references public.notes_topics(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists note_messages_topic_id_idx on public.note_messages(topic_id);

-- ─── 8a. attachments → note_messages link ──────────────────────
-- Now that note_messages exists, allow attachments to point at one.
-- Updates the XOR check so an attachment has exactly one parent
-- among (task_id, budget_item_id, note_message_id).
alter table public.attachments add column if not exists note_message_id bigint references public.note_messages(id) on delete cascade;

alter table public.attachments drop constraint if exists attachments_payload_check;
alter table public.attachments add constraint attachments_payload_check check (
  (
    (task_id is not null)::int
    + (budget_item_id is not null)::int
    + (note_message_id is not null)::int
    = 1
  )
  and ((kind = 'file' and storage_path is not null) or (kind = 'link' and url is not null))
);

create index if not exists attachments_note_message_id_idx on public.attachments(note_message_id);

-- ─── 8b. mentions ──────────────────────────────────────────────
-- One row per (mentioned user, source row). Source can be a task
-- comment OR a note message. Created automatically by triggers
-- below — the client never inserts here directly.

create table if not exists public.mentions (
  id bigserial primary key,
  source_kind text not null check (source_kind in ('comment','note_message')),
  source_id bigint not null,
  task_id integer references public.tasks(id) on delete cascade,
  topic_id bigint references public.notes_topics(id) on delete cascade,
  mentioned_user_id uuid not null references public.profiles(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  seen_at timestamptz,
  unique (source_kind, source_id, mentioned_user_id)
);

create index if not exists mentions_unread_idx
  on public.mentions(mentioned_user_id) where seen_at is null;

-- ─── 8b1. contacts ─────────────────────────────────────────────
-- Address book for the project: people and companies we'll be calling
-- and working with (architect, plumber, electrician, vendors, friends
-- helping out…). They have no auth account; they're just records we
-- can look up and reference from comments, notes, etc. via @-mentions.

create table if not exists public.contacts (
  id bigserial primary key,
  name text not null,
  role text not null default '',
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  notes text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contacts_name_idx on public.contacts(lower(name));

-- ─── 8c. guest_invites ─────────────────────────────────────────
-- Tokens generated by Max/Karo so they can share a read-mostly view of
-- the project with a friend / family member / contractor. The link
-- looks like  https://…/?invite=<token>  — opening it lets the guest
-- choose a display name, sign in anonymously, and see (but not modify)
-- the project. They can still post comments + upload documents.

create table if not exists public.guest_invites (
  id bigserial primary key,
  token uuid not null unique default gen_random_uuid(),
  label text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz
);

create index if not exists guest_invites_token_idx on public.guest_invites(token);

-- ─── 9. updated_at trigger helper ──────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists tasks_updated_at on public.tasks;
create trigger tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

drop trigger if exists budget_items_updated_at on public.budget_items;
create trigger budget_items_updated_at
  before update on public.budget_items
  for each row execute function public.set_updated_at();

drop trigger if exists project_settings_updated_at on public.project_settings;
create trigger project_settings_updated_at
  before update on public.project_settings
  for each row execute function public.set_updated_at();

drop trigger if exists notes_topics_updated_at on public.notes_topics;
create trigger notes_topics_updated_at
  before update on public.notes_topics
  for each row execute function public.set_updated_at();

drop trigger if exists contacts_updated_at on public.contacts;
create trigger contacts_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();

-- ═══════════════════════════════════════════════════════════════
-- Mention parsing — when a comment or note_message is inserted, scan
-- the body for @display_name tokens and write rows into public.mentions
-- for each matched user (excluding the author). Runs as security
-- definer so it bypasses RLS for the inserts.
-- ═══════════════════════════════════════════════════════════════

create or replace function public.parse_mentions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source_kind text;
  v_task_id integer;
  v_topic_id bigint;
  v_body text;
  v_author uuid;
  m_user record;
begin
  if TG_TABLE_NAME = 'comments' then
    v_source_kind := 'comment';
    v_body := NEW.body;
    v_task_id := NEW.task_id;
    v_topic_id := null;
    v_author := NEW.author_id;
  elsif TG_TABLE_NAME = 'note_messages' then
    v_source_kind := 'note_message';
    v_body := NEW.body;
    v_task_id := null;
    v_topic_id := NEW.topic_id;
    v_author := NEW.author_id;
  else
    return NEW;
  end if;

  -- For each profile (other than the author), if the body contains
  -- @<their display_name> as a discrete token (case-insensitive,
  -- followed by word boundary), write a mention. Display names here
  -- are simple identifiers (no regex meta-chars), so direct interp
  -- is safe.
  for m_user in
    select p.id, p.display_name
    from public.profiles p
    where p.id is distinct from v_author
  loop
    if v_body ~* ('@' || m_user.display_name || '\M')
    then
      insert into public.mentions
        (source_kind, source_id, task_id, topic_id, mentioned_user_id, created_by)
      values
        (v_source_kind, NEW.id, v_task_id, v_topic_id, m_user.id, v_author)
      on conflict (source_kind, source_id, mentioned_user_id) do nothing;
    end if;
  end loop;

  return NEW;
end;
$$;

drop trigger if exists comments_parse_mentions on public.comments;
create trigger comments_parse_mentions
  after insert on public.comments
  for each row execute function public.parse_mentions();

drop trigger if exists note_messages_parse_mentions on public.note_messages;
create trigger note_messages_parse_mentions
  after insert on public.note_messages
  for each row execute function public.parse_mentions();

-- ═══════════════════════════════════════════════════════════════
-- Guest-invite RPCs. Clients call these via supabase.rpc(...).
-- Marked SECURITY DEFINER so they can verify the token and update the
-- caller's profile row even when RLS would otherwise block it; each
-- function does its own authorization check at the top.
-- ═══════════════════════════════════════════════════════════════

-- Create a new invite token. Only full members (Max/Karo) may call this.
create or replace function public.create_guest_invite(
  p_label text default '',
  p_expires_at timestamptz default null
)
returns public.guest_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.guest_invites;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if public.current_user_is_guest() then
    raise exception 'Guests cannot create invites';
  end if;

  insert into public.guest_invites (label, created_by, expires_at)
  values (coalesce(p_label, ''), v_uid, p_expires_at)
  returning * into v_row;

  return v_row;
end;
$$;

-- Revoke an invite. Only the creator (or any full member) may call this.
create or replace function public.revoke_guest_invite(p_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if public.current_user_is_guest() then
    raise exception 'Guests cannot revoke invites';
  end if;

  update public.guest_invites
     set revoked_at = now()
   where id = p_id and revoked_at is null;
end;
$$;

-- Look up an invite by token without exposing the full table to anon
-- users. Returns a minimal row when the token is valid + not revoked +
-- not expired; raises otherwise. Callable from any role so the guest
-- landing page can validate before asking the user for their name.
create or replace function public.peek_guest_invite(p_token uuid)
returns table (
  id bigint,
  label text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select gi.id, gi.label, gi.expires_at
      from public.guest_invites gi
     where gi.token = p_token
       and gi.revoked_at is null
       and (gi.expires_at is null or gi.expires_at > now())
     limit 1;
end;
$$;

-- Accept an invite: called *after* the guest has signed in
-- anonymously. Validates the token and writes the chosen display
-- name into their profile. Idempotent — re-running with the same
-- token + name is a no-op.
create or replace function public.accept_guest_invite(
  p_token uuid,
  p_display_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := nullif(btrim(p_display_name), '');
  v_invite public.guest_invites;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if v_name is null or length(v_name) > 60 then
    raise exception 'Please enter a name (max 60 characters).';
  end if;

  select * into v_invite
    from public.guest_invites
   where token = p_token
     and revoked_at is null
     and (expires_at is null or expires_at > now())
   limit 1;

  if not found then
    raise exception 'This invite link is no longer valid.';
  end if;

  -- Mark the caller's profile as a guest with the chosen name. The
  -- handle_new_user trigger has already created the row when they
  -- signed in anonymously, so this is an UPDATE rather than INSERT.
  update public.profiles
     set display_name = v_name,
         is_guest = true
   where id = v_uid;
end;
$$;

-- ═══════════════════════════════════════════════════════════════
-- Seed data (matches the old src/state/initial.ts exactly)
-- Uses ON CONFLICT so re-runs are no-ops.
-- ═══════════════════════════════════════════════════════════════

insert into public.project_settings (id, start_date, currency, total_budget_target)
values (1, '2026-05-01', 'DKK', 180000)
on conflict (id) do nothing;

insert into public.phases (id, name, color, sort_order) values
  (1, 'Planning & design',  '#D6A7A1', 1),
  (2, 'Approvals & quotes', '#8CA58B', 2),
  (3, 'Execution',          '#3F5E4E', 3),
  (4, 'Kids room',          '#C59A52', 4)
on conflict (id) do update set name = excluded.name, color = excluded.color;

insert into public.budget_categories (id, name, sort_order) values
  ('design',     'Design & approvals',      1),
  ('plumbing',   'Plumbing',                2),
  ('electric',   'Electrical',              3),
  ('cabinets',   'Cabinets & countertops',  4),
  ('appliances', 'Appliances',              5),
  ('demolition', 'Demolition & disposal',   6),
  ('labor',      'Labor',                   7),
  ('kids',       'Kids room',               8),
  ('misc',       'Misc & contingency',      9)
on conflict (id) do update set name = excluded.name;

insert into public.tasks (id, phase_id, title, priority, status, duration, deps) values
  (1,  1, 'Agree on a layout',                                            'high',   'not_started',  7, '{}'),
  (2,  1, 'Review by family architect & get technical drawings',          'high',   'not_started', 14, '{1}'),
  (3,  2, 'Plumber estimate (VVS of residence)',                           'high',   'not_started', 10, '{2}'),
  (4,  2, 'Electrician estimate',                                          'high',   'not_started', 10, '{2}'),
  (5,  2, 'Kitchen builder friend: reuse vs buy vs build',                 'high',   'not_started', 10, '{2}'),
  (6,  2, 'Make total budget',                                             'high',   'not_started',  5, '{3,4,5}'),
  (7,  2, 'Get board approval (residence)',                                'high',   'not_started', 21, '{2,6}'),
  (8,  2, 'Get kommune approval',                                          'high',   'not_started', 30, '{7}'),
  (9,  3, 'Old kitchen removal',                                           'medium', 'not_started',  3, '{8}'),
  (10, 3, 'Inspect floor & walls of old kitchen',                          'medium', 'not_started',  2, '{9}'),
  (11, 3, 'Plumbing and electrical work',                                  'high',   'not_started',  7, '{9}'),
  (12, 3, 'New kitchen installation',                                      'high',   'not_started', 10, '{11}'),
  (13, 4, 'Make kids room',                                                'medium', 'not_started', 14, '{10,12}')
on conflict (id) do nothing;

-- Bump sequence past seeded IDs so client-side inserts don't collide.
select setval('public.tasks_id_seq',
              greatest((select coalesce(max(id), 0) from public.tasks), 13));

insert into public.budget_items (id, category_id, name, estimate, actual) values
  (1,  'design',     'Architect drawings',                       0,     0),
  (2,  'design',     'Kommune application fees',              1000,     0),
  (3,  'plumbing',   'VVS work (rerouting + new)',           25000,     0),
  (4,  'electric',   'Electrical work (new circuits, sockets)', 18000, 0),
  (5,  'cabinets',   'New cabinets + countertop',            45000,     0),
  (6,  'appliances', 'Oven, hob, extractor',                 15000,     0),
  (7,  'appliances', 'Dishwasher',                            6000,     0),
  (8,  'appliances', 'Fridge/freezer',                        8000,     0),
  (9,  'demolition', 'Old kitchen removal + waste',           5000,     0),
  (10, 'labor',      'Kitchen builder friend',               20000,     0),
  (11, 'kids',       'Flooring / wall repair',               10000,     0),
  (12, 'kids',       'Paint, fixtures, lighting',             5000,     0),
  (13, 'misc',       'Contingency (~10%)',                   15000,     0)
on conflict (id) do nothing;

select setval('public.budget_items_id_seq',
              greatest((select coalesce(max(id), 0) from public.budget_items), 13));

-- ═══════════════════════════════════════════════════════════════
-- RLS — only authenticated users (Max + Karo) can read/write.
-- Sign-ups are disabled in the Auth settings, so there can only ever
-- be two auth users; no need for an extra allowlist table.
-- ═══════════════════════════════════════════════════════════════

alter table public.profiles          enable row level security;
alter table public.phases             enable row level security;
alter table public.budget_categories  enable row level security;
alter table public.project_settings   enable row level security;
alter table public.tasks              enable row level security;
alter table public.comments           enable row level security;
alter table public.budget_items       enable row level security;
alter table public.attachments        enable row level security;
alter table public.notes_topics       enable row level security;
alter table public.note_messages      enable row level security;
alter table public.mentions           enable row level security;
alter table public.guest_invites      enable row level security;
alter table public.contacts           enable row level security;

-- profiles: anyone logged in (including guests) can read both profiles;
-- you can only edit your own (and a guest cannot promote themselves to
-- a full member — the is_guest column is enforced via RLS check).
drop policy if exists "profiles_read" on public.profiles;
create policy "profiles_read" on public.profiles for select
  to authenticated using (true);
drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update" on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    -- A guest can edit their own row but cannot flip is_guest to false.
    and (is_guest = true or not public.current_user_is_guest())
  );

-- phases / budget_categories / project_settings / tasks / budget_items:
-- everyone authed can READ. Only full members (not guests) can CRUD.
-- This is what gives guests their read-only view of the project.
do $$
declare t text;
begin
  foreach t in array array['phases','budget_categories','project_settings','tasks','budget_items']
  loop
    execute format('drop policy if exists "%1$s_all"          on public.%1$I', t);
    execute format('drop policy if exists "%1$s_read"         on public.%1$I', t);
    execute format('drop policy if exists "%1$s_write_member" on public.%1$I', t);

    execute format(
      'create policy "%1$s_read" on public.%1$I for select to authenticated using (true)',
      t
    );
    execute format(
      'create policy "%1$s_write_member" on public.%1$I for all to authenticated '
      || 'using (not public.current_user_is_guest()) '
      || 'with check (not public.current_user_is_guest())',
      t
    );
  end loop;
end $$;

-- comments: anyone authed can read; can insert only as themselves; can update/delete only their own.
drop policy if exists "comments_read"   on public.comments;
drop policy if exists "comments_insert" on public.comments;
drop policy if exists "comments_update" on public.comments;
drop policy if exists "comments_delete" on public.comments;

create policy "comments_read"   on public.comments for select
  to authenticated using (true);
create policy "comments_insert" on public.comments for insert
  to authenticated with check (author_id = auth.uid());
create policy "comments_update" on public.comments for update
  to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "comments_delete" on public.comments for delete
  to authenticated using (author_id = auth.uid());

-- attachments: anyone authed can read; can insert/update/delete only their own.
drop policy if exists "attachments_read"   on public.attachments;
drop policy if exists "attachments_insert" on public.attachments;
drop policy if exists "attachments_update" on public.attachments;
drop policy if exists "attachments_delete" on public.attachments;

create policy "attachments_read"   on public.attachments for select
  to authenticated using (true);
create policy "attachments_insert" on public.attachments for insert
  to authenticated with check (uploaded_by = auth.uid());
create policy "attachments_update" on public.attachments for update
  to authenticated using (uploaded_by = auth.uid()) with check (uploaded_by = auth.uid());
create policy "attachments_delete" on public.attachments for delete
  to authenticated using (uploaded_by = auth.uid());

-- notes_topics: everyone authed can read. Only full members can create
-- new topics, rename or delete their own. (Guests can still chat in
-- existing topics via note_messages below.)
drop policy if exists "notes_topics_read"   on public.notes_topics;
drop policy if exists "notes_topics_insert" on public.notes_topics;
drop policy if exists "notes_topics_update" on public.notes_topics;
drop policy if exists "notes_topics_delete" on public.notes_topics;

create policy "notes_topics_read"   on public.notes_topics for select
  to authenticated using (true);
create policy "notes_topics_insert" on public.notes_topics for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and not public.current_user_is_guest()
  );
create policy "notes_topics_update" on public.notes_topics for update
  to authenticated
  using (created_by = auth.uid() and not public.current_user_is_guest())
  with check (created_by = auth.uid() and not public.current_user_is_guest());
create policy "notes_topics_delete" on public.notes_topics for delete
  to authenticated
  using (created_by = auth.uid() and not public.current_user_is_guest());

-- note_messages: anyone authed can read; can insert only as themselves;
-- can update/delete only your own.
drop policy if exists "note_messages_read"   on public.note_messages;
drop policy if exists "note_messages_insert" on public.note_messages;
drop policy if exists "note_messages_update" on public.note_messages;
drop policy if exists "note_messages_delete" on public.note_messages;

create policy "note_messages_read"   on public.note_messages for select
  to authenticated using (true);
create policy "note_messages_insert" on public.note_messages for insert
  to authenticated with check (author_id = auth.uid());
create policy "note_messages_update" on public.note_messages for update
  to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "note_messages_delete" on public.note_messages for delete
  to authenticated using (author_id = auth.uid());

-- mentions: only the mentioned user sees + can update (mark seen) /
-- delete their own. Inserts only happen via the trigger above
-- (security definer), so no insert policy is needed.
drop policy if exists "mentions_read"   on public.mentions;
drop policy if exists "mentions_update" on public.mentions;
drop policy if exists "mentions_delete" on public.mentions;

create policy "mentions_read"   on public.mentions for select
  to authenticated using (mentioned_user_id = auth.uid());
create policy "mentions_update" on public.mentions for update
  to authenticated using (mentioned_user_id = auth.uid())
  with check (mentioned_user_id = auth.uid());
create policy "mentions_delete" on public.mentions for delete
  to authenticated using (mentioned_user_id = auth.uid());

-- contacts: anyone authed (incl. guests) can read so they can see and
-- @-mention the address book. Only full members can create / edit /
-- delete. Same shape as tasks/budget_items.
drop policy if exists "contacts_read"         on public.contacts;
drop policy if exists "contacts_write_member" on public.contacts;

create policy "contacts_read" on public.contacts for select
  to authenticated using (true);
create policy "contacts_write_member" on public.contacts for all
  to authenticated
  using (not public.current_user_is_guest())
  with check (not public.current_user_is_guest());

-- guest_invites: only full members can list / manage them. Guests
-- never see the invite table; they accept via the SECURITY DEFINER
-- RPCs above (peek_guest_invite + accept_guest_invite). Inserts and
-- updates also go via RPCs, so no insert/update policy is needed.
drop policy if exists "guest_invites_read"   on public.guest_invites;
drop policy if exists "guest_invites_delete" on public.guest_invites;

create policy "guest_invites_read" on public.guest_invites for select
  to authenticated
  using (not public.current_user_is_guest());
create policy "guest_invites_delete" on public.guest_invites for delete
  to authenticated
  using (
    not public.current_user_is_guest()
    and (created_by = auth.uid() or created_by is null)
  );

-- ═══════════════════════════════════════════════════════════════
-- Storage — a private bucket for task attachments + policies so
-- authenticated users can read / upload / delete objects in it.
-- ═══════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

drop policy if exists "attachments_bucket_read"   on storage.objects;
drop policy if exists "attachments_bucket_insert" on storage.objects;
drop policy if exists "attachments_bucket_update" on storage.objects;
drop policy if exists "attachments_bucket_delete" on storage.objects;

create policy "attachments_bucket_read"   on storage.objects for select
  to authenticated using (bucket_id = 'attachments');
create policy "attachments_bucket_insert" on storage.objects for insert
  to authenticated with check (bucket_id = 'attachments');
create policy "attachments_bucket_update" on storage.objects for update
  to authenticated using (bucket_id = 'attachments');
create policy "attachments_bucket_delete" on storage.objects for delete
  to authenticated using (bucket_id = 'attachments');

-- ═══════════════════════════════════════════════════════════════
-- Grants — on some Supabase projects the default table/sequence
-- grants on schema public aren't in place, so the authenticated
-- role gets "permission denied for table" errors even with RLS
-- policies allowing the row. These statements make the schema
-- work on any project; re-running them is a no-op.
-- ═══════════════════════════════════════════════════════════════

grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;
grant all on all routines in schema public to anon, authenticated;

alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant all on routines to anon, authenticated;

-- ═══════════════════════════════════════════════════════════════
-- Realtime — let both clients see each other's changes live.
-- (Adding a table twice errors; the DO-block makes this idempotent.)
-- ═══════════════════════════════════════════════════════════════

do $$
declare t text;
begin
  foreach t in array array['tasks','comments','budget_items','project_settings','attachments','notes_topics','note_messages','mentions','guest_invites','contacts']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then
      -- already in publication; fine
      null;
    end;
  end loop;
end $$;
