/*
# Restrict file storage to admin email only

## Overview
Previously, RLS policies on `file_records` and the `logbook-files` storage bucket
allowed ANY authenticated user full access. Now policies check the user's email
via `auth.jwt() ->> 'email'` and only allow the designated admin email.

## Security Changes
- `file_records` table: all 4 CRUD policies now require `auth.jwt() ->> 'email' = 'jeriko1846@yandex.ru'`
- `storage.objects` (logbook-files bucket): all 4 CRUD policies now require the same email check
- Any other authenticated user who somehow signs up will get zero access
*/

-- ===================== file_records: admin-only by email =====================
DROP POLICY IF EXISTS "auth_select_file_records" ON file_records;
CREATE POLICY "auth_select_file_records" ON file_records FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'email' = 'jeriko1846@yandex.ru');

DROP POLICY IF EXISTS "auth_insert_file_records" ON file_records;
CREATE POLICY "auth_insert_file_records" ON file_records FOR INSERT
  TO authenticated
  WITH CHECK (auth.jwt() ->> 'email' = 'jeriko1846@yandex.ru');

DROP POLICY IF EXISTS "auth_update_file_records" ON file_records;
CREATE POLICY "auth_update_file_records" ON file_records FOR UPDATE
  TO authenticated
  USING (auth.jwt() ->> 'email' = 'jeriko1846@yandex.ru')
  WITH CHECK (auth.jwt() ->> 'email' = 'jeriko1846@yandex.ru');

DROP POLICY IF EXISTS "auth_delete_file_records" ON file_records;
CREATE POLICY "auth_delete_file_records" ON file_records FOR DELETE
  TO authenticated
  USING (auth.jwt() ->> 'email' = 'jeriko1846@yandex.ru');

-- ===================== storage.objects: admin-only by email =====================
DROP POLICY IF EXISTS "auth_read_storage" ON storage.objects;
CREATE POLICY "auth_read_storage" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'logbook-files' AND auth.jwt() ->> 'email' = 'jeriko1846@yandex.ru');

DROP POLICY IF EXISTS "auth_insert_storage" ON storage.objects;
CREATE POLICY "auth_insert_storage" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'logbook-files' AND auth.jwt() ->> 'email' = 'jeriko1846@yandex.ru');

DROP POLICY IF EXISTS "auth_update_storage" ON storage.objects;
CREATE POLICY "auth_update_storage" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'logbook-files' AND auth.jwt() ->> 'email' = 'jeriko1846@yandex.ru')
  WITH CHECK (bucket_id = 'logbook-files' AND auth.jwt() ->> 'email' = 'jeriko1846@yandex.ru');

DROP POLICY IF EXISTS "auth_delete_storage" ON storage.objects;
CREATE POLICY "auth_delete_storage" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'logbook-files' AND auth.jwt() ->> 'email' = 'jeriko1846@yandex.ru');
