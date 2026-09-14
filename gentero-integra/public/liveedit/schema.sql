-- ===========================================================================
-- liveedit: таблицы для правки блоков и истории версий. Редакция 2.
--
-- Отличие от первой редакции: право записи проверяет сервер, а не браузер.
-- Читать может кто угодно по anon-ключу (текст всё равно зашифрован), писать и
-- удалять - только вошедший через Supabase Auth. Раньше политики стояли
-- using(true) на всё, а это значит, что любой аноним, знающий адрес проекта
-- (он публичен в annotate-init.js), мог одним запросом стереть и патчи, и всю
-- историю версий.
--
-- Выполнить в SQL editor проекта Supabase. Скрипт идемпотентный, старые
-- политики снимаются явно.
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

-- политики первой редакции, если они уже созданы
drop policy if exists "blocks read"   on doc_blocks;
drop policy if exists "blocks write"  on doc_blocks;
drop policy if exists "blocks update" on doc_blocks;
drop policy if exists "blocks delete" on doc_blocks;
drop policy if exists "vers read"     on doc_versions;
drop policy if exists "vers write"    on doc_versions;
drop policy if exists "vers delete"   on doc_versions;

-- чтение анонимное: зритель документа должен видеть правки
create policy "blocks read" on doc_blocks for select using (true);
create policy "vers read"   on doc_versions for select using (true);

-- запись только для вошедшего пользователя
create policy "blocks write"  on doc_blocks for insert to authenticated with check (true);
create policy "blocks update" on doc_blocks for update to authenticated using (true);
create policy "blocks delete" on doc_blocks for delete to authenticated using (true);
create policy "vers write"    on doc_versions for insert to authenticated with check (true);
create policy "vers delete"   on doc_versions for delete to authenticated using (true);

-- ===========================================================================
-- Пользователь-редактор заводится один раз руками:
-- Authentication -> Users -> Add user -> Create new user, email и пароль,
-- галка Auto Confirm User. Регистрацию посторонних выключить там же:
-- Authentication -> Providers -> Email -> Allow new users to sign up = off.
-- ===========================================================================
