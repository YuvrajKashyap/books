alter table books.titles add column queue_position integer not null default 0;
update books.titles set queue_position=position;
create index titles_queue_sequence on books.titles(owner_id,focus,status,queue_position);
