import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { FileRecord, FileType } from '@/lib/types';

const BUCKET = 'logbook-files';

export interface UploadOptions {
  file: File;
  fileType: FileType;
  description?: string;
  deviceId?: string;
}

export function useFileStorage() {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: queryErr } = await supabase
      .from('file_records')
      .select('*')
      .order('created_at', { ascending: false });

    if (queryErr) {
      setError(queryErr.message);
    } else {
      setFiles(data as FileRecord[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const uploadFile = useCallback(
    async ({ file, fileType, description, deviceId }: UploadOptions) => {
      setUploading(true);
      setError(null);

      try {
        const timestamp = Date.now();
        const storagePath = `${fileType}/${timestamp}-${file.name}`;

        const { error: uploadErr } = await supabase.storage
          .from(BUCKET)
          .upload(storagePath, file, { upsert: false });

        if (uploadErr) throw uploadErr;

        const { data, error: insertErr } = await supabase
          .from('file_records')
          .insert({
            file_name: file.name,
            storage_path: storagePath,
            file_type: fileType,
            file_size: file.size,
            mime_type: file.type || 'application/octet-stream',
            description: description ?? null,
            device_id: deviceId ?? null,
          })
          .select()
          .single();

        if (insertErr) throw insertErr;

        setFiles((prev) => [data as FileRecord, ...prev]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки файла');
      } finally {
        setUploading(false);
      }
    },
    [],
  );

  const downloadFile = useCallback(async (record: FileRecord) => {
    const { data, error: dlErr } = await supabase.storage
      .from(BUCKET)
      .download(record.storage_path);

    if (dlErr) throw dlErr;

    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = record.file_name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const deleteFile = useCallback(async (record: FileRecord) => {
    const { error: storageErr } = await supabase.storage
      .from(BUCKET)
      .remove([record.storage_path]);

    if (storageErr) throw storageErr;

    const { error: dbErr } = await supabase
      .from('file_records')
      .delete()
      .eq('id', record.id);

    if (dbErr) throw dbErr;

    setFiles((prev) => prev.filter((f) => f.id !== record.id));
  }, []);

  return {
    files,
    loading,
    error,
    uploading,
    uploadFile,
    downloadFile,
    deleteFile,
    refresh: fetchFiles,
  };
}
