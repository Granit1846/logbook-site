/*
# Lock down file storage to admin-only and app-server access

## Overview
Reverses the public/anon access policies on the `logbook-files` storage bucket
and `file_records` table. The bucket becomes private (no public URL access).
File records are only readable/writable by authenticated users (the site
admin). Desktop and mobile apps upload/download through an edge function that
uses the service role key, bypassing RLS entirely.

## Changes

### Storage bucket `logbook-files`
- Set `public = false` — files can no longer be read via public URLs.
- Remove all `anon` storage policies (read, insert, update, delete).
- Keep `authenticated` storage policies so the logged-in admin can
  download files directly from the admin panel.

### Table `file_records`
- Remove all `anon` policies (select, insert, update, delete).
- Keep `authenticated`-only policies so the admin can list, create,
  update, and delete records after signing in.

### Edge function (deployed separately)
- Uses the service role key to upload/download/delete files in the bucket
  and insert/delete rows in `file_records`, bypassing RLS.
- Apps call the edge function instead of accessing Storage directly.

## Security
- `anon` role: NO access to `logbook-files` bucket or `file_records` table.
- `authenticated` role: full CRUD on both (the site admin after login).
- Service role (edge function only): bypasses RLS for app uploads/downloads.

## Notes
1. The bucket is now private — no public URLs.
2. The public website no longer shows the file storage section.
3. An admin login screen is added to the site for managing files.
4. Desktop/mobile apps use the edge function endpoint, not Storage directly.
*/

-- ===================== MAKE BUCKET PRIVATE =====================
UPDATE storage.buckets
SET public = false
WHERE id = 'logbook-files';

-- ===================== REMOVE ANON STORAGE POLICIES =====================
DROP POLICY IF EXISTS "anon_read_storage" ON storage.objects;
DROP POLICY IF EXISTS "anon_insert_storage" ON storage.objects;
DROP POLICY IF EXISTS "anon_update_storage" ON storage.objects;
DROP POLICY IF EXISTS "anon_delete_storage" ON storage.objects;

-- Keep authenticated storage policies for admin panel access
DROP POLICY IF EXISTS "auth_read_storage" ON storage.objects;
CREATE POLICY "auth_read_storage" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'logbook-files');

DROP POLICY IF EXISTS "auth_insert_storage" ON storage.objects;
CREATE POLICY "auth_insert_storage" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'logbook-files');

DROP POLICY IF EXISTS "auth_update_storage" ON storage.objects;
CREATE POLICY "auth_update_storage" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'logbook-files')
  WITH CHECK (bucket_id = 'logbook-files');

DROP POLICY IF EXISTS "auth_delete_storage" ON storage.objects;
CREATE POLICY "auth_delete_storage" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'logbook-files');

-- ===================== REMOVE ANON FILE_RECORDS POLICIES =====================
DROP POLICY IF EXISTS "anon_select_file_records" ON file_records;
DROP POLICY IF EXISTS "anon_insert_file_records" ON file_records;
DROP POLICY IF EXISTS "anon_update_file_records" ON file_records;
DROP POLICY IF EXISTS "anon_delete_file_records" ON file_records;

-- Keep authenticated-only policies for admin panel access
DROP POLICY IF EXISTS "auth_select_file_records" ON file_records;
CREATE POLICY "auth_select_file_records" ON file_records FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_file_records" ON file_records;
CREATE POLICY "auth_insert_file_records" ON file_records FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_file_records" ON file_records;
CREATE POLICY "auth_update_file_records" ON file_records FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_file_records" ON file_records;
CREATE POLICY "auth_delete_file_records" ON file_records FOR DELETE
  TO authenticated USING (true);
