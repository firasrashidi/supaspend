-- Create storage bucket for receipt uploads
-- Run this in the Supabase SQL Editor

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false);

-- RLS policies for receipts bucket
-- Users can upload receipts to their own folder (user_id/filename)
create policy "Users can upload own receipts"
  on storage.objects for insert
  with check (
    bucket_id = 'receipts' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can view their own receipts
create policy "Users can view own receipts"
  on storage.objects for select
  using (
    bucket_id = 'receipts' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can delete their own receipts
create policy "Users can delete own receipts"
  on storage.objects for delete
  using (
    bucket_id = 'receipts' and
    auth.uid()::text = (storage.foldername(name))[1]
  );
