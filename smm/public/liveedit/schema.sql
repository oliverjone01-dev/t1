-- ===========================================================================
-- liveedit: таблицы для правки блоков и истории версий.
-- Выполнить один раз в SQL editor проекта Supabase.
-- Одна пара таблиц на все проекты, документы разделяются полем doc_key.
--
-- Тело (payload, snapshot) может быть зашифровано на стороне браузера. Тогда
-- сервер видит base64 и ничего о содержимом не знает: поиск и diff считаются
-- в браузере после расшифровки. Для несекретных проектов crypt = false и
-- внутри лежит обычный HTML/JSON.
-- ===========================================================================

create table if not exists doc_blocks (
  doc_key    text        not null,
  block_id   text        not null,
  payload    text        not null,
  crypt      boolean     not null default true,
  author     text,
  updated_at timestamptz not null default now(),
  primary key (doc_key, block_id)
);

create index if not exists doc_blocks_doc on doc_blocks (doc_key);

create table if not exists doc_versions (
  id         bigserial   primary key,
  doc_key    text        not null,
  label      text,
  snapshot   text        not null,
  crypt      boolean     not null default true,
  author     text,
  created_at timestamptz not null default now()
);

create index if not exists doc_versions_doc on doc_versions (doc_key, created_at desc);

alter table doc_blocks   enable row level security;
alter table doc_versions enable row level security;

-- Внутренний инструмент по ссылке: anon-ключ публичен по дизайну, поэтому
-- защита содержимого лежит на шифровании, а не на политиках. Если позже
-- переедешь на Supabase Auth, поменяй using (true) на (auth.uid() is not null).
create policy "blocks read"   on doc_blocks   for select using (true);
create policy "blocks write"  on doc_blocks   for insert with check (true);
create policy "blocks update" on doc_blocks   for update using (true);
create policy "blocks delete" on doc_blocks   for delete using (true);

create policy "vers read"     on doc_versions for select using (true);
create policy "vers write"    on doc_versions for insert with check (true);
create policy "vers delete"   on doc_versions for delete using (true);
