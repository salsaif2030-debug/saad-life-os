-- ============================================================
--  مرصاد على Supabase — يُشغَّل مرّة واحدة في SQL Editor
--
--  مرصاد كُتب أصلاً على Firestore، وهو مخزن مستندات لا جداول.
--  فبدل تفكيك بنيته إلى جداول، نحفظ كل مستند صفّاً واحداً:
--  المسار مفتاحه، والمحتوى jsonb — ويترجم supabase-bridge.js
--  نداءات Firestore إلى هذا الجدول.
--
--  الحماية: كل صفّ لصاحبه وحده (auth.uid() = owner).
--  المشاركة بين الحسابات معطّلة في هذه النسخة عمداً.
-- ============================================================

create table if not exists public.mirsad_docs (
  path       text primary key,                 -- 'users/<uid>/projects/<id>'
  parent     text not null,                    -- 'users/<uid>/projects' — للاستعلام عن المجموعة
  owner      uuid not null references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mirsad_docs_parent_idx on public.mirsad_docs (parent);
create index if not exists mirsad_docs_owner_idx  on public.mirsad_docs (owner);

alter table public.mirsad_docs enable row level security;

drop policy if exists mirsad_select_own on public.mirsad_docs;
drop policy if exists mirsad_insert_own on public.mirsad_docs;
drop policy if exists mirsad_update_own on public.mirsad_docs;
drop policy if exists mirsad_delete_own on public.mirsad_docs;

create policy mirsad_select_own on public.mirsad_docs
  for select using (auth.uid() = owner);
create policy mirsad_insert_own on public.mirsad_docs
  for insert with check (auth.uid() = owner);
create policy mirsad_update_own on public.mirsad_docs
  for update using (auth.uid() = owner) with check (auth.uid() = owner);
create policy mirsad_delete_own on public.mirsad_docs
  for delete using (auth.uid() = owner);

-- التحديث اللحظي (onSnapshot) يحتاج الجدول في نشرة الوقت الحقيقي
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mirsad_docs'
  ) then
    alter publication supabase_realtime add table public.mirsad_docs;
  end if;
end $$;

-- ملفات مرصاد (إن استُعملت لاحقاً) — دلو خاص، كل مستخدم في مجلد باسم معرّفه
insert into storage.buckets (id, name, public)
values ('mirsad', 'mirsad', false)
on conflict (id) do nothing;

drop policy if exists mirsad_files_own on storage.objects;
create policy mirsad_files_own on storage.objects
  for all
  using  (bucket_id = 'mirsad' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'mirsad' and (storage.foldername(name))[1] = auth.uid()::text);
