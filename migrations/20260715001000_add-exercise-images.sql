alter table public.exercises
  add column if not exists image_url text;

comment on column public.exercises.image_url is
  'Public or signed URL for the canonical exercise illustration.';
