/*
# Create file storage for sync and backup files

## Overview
Creates a Supabase Storage bucket and a metadata table to support file
synchronization between PC and mobile devices, as well as creating and
restoring backup copies of Logbook data.

## Storage Bucket
- `logbook-files` — public-read bucket for storing sync and backup files
  uploaded by the Logbook desktop/mobile apps.

## New Table: file_records
Tracks metadata for every file stored in the `logbook-files` bucket.
- `id` (uuid, primary key)
- `file_name` (text) — original file name as uploaded
- `storage_path` (text) — path within the bucket (unique)
- `file_type` (text) — category: 'sync' or 'backup'
- `file_size` (bigint) — size in bytes
- `mime_type` (text) — MIME type
- `description` (text, nullable) — optional user-provided description
- `device_id` (text, nullable) — identifier of the device that uploaded the file
- `created_at` (timestamptz) — upload timestamp
- `updated_at` (timestamptz) — last modification timestamp

## Security
- Storage bucket policies: anon + authenticated can read, upload, update,
  and delete objects. This is a single-tenant public app with no sign-in.
- RLS enabled on `file_records` with full CRUD for `anon, authenticated`.
  Data is intentionally shared/public.

## Notes
1. The bucket is created with `public: true` so files can be read via
   a simple URL without an access token.
2. `storage_path` has a UNIQUE constraint to prevent collisions.
3. `updated_at` auto-updates on every row modification via a trigger.
4. File size and MIME type are recorded for display in the UI.
*/

-- ===================== STORAGE BUCKET =====================
INSERT INTO storage.buckets (id, name, public)
VALUES ('logbook-files', 'logbook-files', true)
ON CONFLICT (id) DO NOTHING;

-- ===================== STORAGE POLICIES =====================
-- Allow anon + authenticated to read objects
DROP POLICY IF EXISTS "anon_read_storage" ON storage.objects;
CREATE POLICY "anon_read_storage" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'logbook-files');

-- Allow anon + authenticated to upload objects
DROP POLICY IF EXISTS "anon_insert_storage" ON storage.objects;
CREATE POLICY "anon_insert_storage" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'logbook-files');

-- Allow anon + authenticated to update objects
DROP POLICY IF EXISTS "anon_update_storage" ON storage.objects;
CREATE POLICY "anon_update_storage" ON storage.objects
  FOR UPDATE TO anon, authenticated
  USING (bucket_id = 'logbook-files')
  WITH CHECK (bucket_id = 'logbook-files');

-- Allow anon + authenticated to delete objects
DROP POLICY IF EXISTS "anon_delete_storage" ON storage.objects;
CREATE POLICY "anon_delete_storage" ON storage.objects
  FOR DELETE TO anon, authenticated
  USING (bucket_id = 'logbook-files');

-- ===================== FILE RECORDS TABLE =====================
CREATE TABLE IF NOT EXISTS file_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  file_type text NOT NULL DEFAULT 'backup' CHECK (file_type IN ('sync', 'backup')),
  file_size bigint NOT NULL DEFAULT 0,
  mime_type text NOT NULL DEFAULT 'application/octet-stream',
  description text,
  device_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE file_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_file_records" ON file_records;
CREATE POLICY "anon_select_file_records" ON file_records FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_file_records" ON file_records;
CREATE POLICY "anon_insert_file_records" ON file_records FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_file_records" ON file_records;
CREATE POLICY "anon_update_file_records" ON file_records FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_file_records" ON file_records;
CREATE POLICY "anon_delete_file_records" ON file_records FOR DELETE
  TO anon, authenticated USING (true);

-- ===================== UPDATED_AT TRIGGER =====================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS file_records_updated_at ON file_records;
CREATE TRIGGER file_records_updated_at
  BEFORE UPDATE ON file_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ===================== INDEX =====================
CREATE INDEX IF NOT EXISTS idx_file_records_type ON file_records (file_type);
CREATE INDEX IF NOT EXISTS idx_file_records_created ON file_records (created_at DESC);
