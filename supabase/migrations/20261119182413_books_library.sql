create schema books;
create role books_runtime login nosuperuser nocreatedb nocreaterole nobypassrls;
revoke all on schema books from public;
grant usage on schema books to books_runtime;
create type books.focus as enum ('Identity + Discipline','Wealth + Execution','Behavior + Mental Models','Misc.');
create type books.status as enum ('Reading','To Read','Completed');
create table books.library (
 owner_id uuid primary key references auth.users(id),
 rotation smallint not null default 0 check(rotation between 0 and 2),
 revision integer not null default 1,
 views jsonb not null default '[]'
);
create table books.titles (
 owner_id uuid not null references books.library, id text not null, title text not null check(length(trim(title))>0),
 author text not null default '', status books.status not null, focus books.focus not null,
 format text not null default '', notes text not null default '', progress smallint check(progress between 0 and 100),
 rating numeric check(rating between 1 and 5), finished date, cover text not null default '', source text not null default '',
 position integer not null, history jsonb not null default '[]', primary key(owner_id,id)
);
create index titles_queue on books.titles(owner_id,focus,status,position);
create table books.archive(owner_id uuid primary key references books.library, original jsonb not null);
alter table books.library enable row level security;
alter table books.titles enable row level security;
alter table books.archive enable row level security;
create policy own_library on books.library to books_runtime using(owner_id=nullif(current_setting('books.owner',true),'')::uuid) with check(owner_id=nullif(current_setting('books.owner',true),'')::uuid);
create policy own_titles on books.titles to books_runtime using(owner_id=nullif(current_setting('books.owner',true),'')::uuid) with check(owner_id=nullif(current_setting('books.owner',true),'')::uuid);
create policy own_archive on books.archive for select to books_runtime using(owner_id=nullif(current_setting('books.owner',true),'')::uuid);
grant select,update(rotation,revision,views) on books.library to books_runtime;
grant select,insert,update,delete on books.titles to books_runtime;
grant select on books.archive to books_runtime;
