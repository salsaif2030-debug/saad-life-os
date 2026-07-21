-- ============================================================
--  نظام سعد السيف — Life OS
--  شغّل هذا الملف كاملاً في: Supabase ← SQL Editor ← New query ← Run
--  يُنشئ جدول الحالة، ويقفل الوصول بحيث لا يرى أحد بيانات غيره.
-- ============================================================

-- 1) جدول الحالة: مستند JSON واحد لكل مستخدم (كل النظام بداخله)
create table if not exists public.life_state (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index if not exists life_state_owner_key on public.life_state(owner);

-- 2) تفعيل الحماية على مستوى الصف (RLS) — إلزامي
alter table public.life_state enable row level security;

drop policy if exists "own_select" on public.life_state;
drop policy if exists "own_insert" on public.life_state;
drop policy if exists "own_update" on public.life_state;
drop policy if exists "own_delete" on public.life_state;

create policy "own_select" on public.life_state
  for select using (auth.uid() = owner);

create policy "own_insert" on public.life_state
  for insert with check (auth.uid() = owner);

create policy "own_update" on public.life_state
  for update using (auth.uid() = owner) with check (auth.uid() = owner);

create policy "own_delete" on public.life_state
  for delete using (auth.uid() = owner);

-- 3) تحديث updated_at تلقائياً
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists life_state_touch on public.life_state;
create trigger life_state_touch before update on public.life_state
  for each row execute function public.touch_updated_at();

-- ============================================================
-- 4) (اختياري) المرفقات — صور التحاليل، ملفات، مرفقات السجلّات
--    أنشئ Bucket خاصاً باسم life-files من: Storage ← New bucket
--    ثم شغّل السياسات التالية:
-- ============================================================
-- insert into storage.buckets (id, name, public) values ('life-files','life-files', false)
--   on conflict (id) do nothing;
--
-- drop policy if exists "own_files_all" on storage.objects;
-- create policy "own_files_all" on storage.objects
--   for all
--   using  (bucket_id = 'life-files' and owner = auth.uid())
--   with check (bucket_id = 'life-files' and owner = auth.uid());

-- ============================================================
--  ملاحظة أمنية
--  المفتاح publishable ظاهرٌ في الكود — وهذا طبيعي وآمن ما دامت RLS
--  مفعّلة أعلاه، فهي التي تمنع أي شخص من قراءة بيانات غيره.
--  لا تضع مفتاح service_role في كود الواجهة أبداً.
-- ============================================================
