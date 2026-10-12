import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Upload,
  Download,
  Trash2,
  RotateCcw,
  HardDrive,
  Clock,
  Loader2,
  RefreshCw,
  Cloud,
  Archive,
  FileWarning,
} from 'lucide-react';
import { useFileStorage } from '@/hooks/useFileStorage';
import type { FileRecord, FileType } from '@/lib/types';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminFileStorage() {
  const { files, loading, error, uploading, uploadFile, downloadFile, deleteFile, refresh } =
    useFileStorage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileType, setFileType] = useState<FileType>('backup');
  const [description, setDescription] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const syncFiles = files.filter((f) => f.file_type === 'sync');
  const backupFiles = files.filter((f) => f.file_type === 'backup');

  const handleUpload = async (file: File) => {
    setActionError(null);
    await uploadFile({ file, fileType, description: description || undefined });
    setDescription('');
  };

  const onInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) await handleUpload(f);
    e.target.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void handleUpload(f);
  };

  const handleDownload = async (record: FileRecord) => {
    setActionError(null);
    setBusyId(record.id);
    try {
      await downloadFile(record);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Ошибка скачивания');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (record: FileRecord) => {
    setActionError(null);
    setBusyId(record.id);
    try {
      await deleteFile(record);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Ошибка удаления');
    } finally {
      setBusyId(null);
    }
  };

  const handleRestore = async (record: FileRecord) => {
    setActionError(null);
    setBusyId(record.id);
    try {
      await downloadFile(record);
      setActionError(
        `Файл «${record.file_name}» загружен. Откройте его в Logbook для восстановления данных.`,
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Ошибка восстановления');
    } finally {
      setBusyId(null);
    }
  };

  const renderFileCard = (record: FileRecord) => (
    <motion.div
      key={record.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="p-4 bg-white dark:bg-[#2D2D2D] rounded-lg border border-gray-200 dark:border-gray-700
        hover:shadow-md transition-shadow duration-200"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
              record.file_type === 'sync'
                ? 'bg-accent-50 dark:bg-accent-800/30'
                : 'bg-warm-100 dark:bg-warm-900/30'
            }`}
          >
            {record.file_type === 'sync' ? (
              <Cloud className="w-5 h-5 text-accent" />
            ) : (
              <Archive className="w-5 h-5 text-warm-600 dark:text-warm-500" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{record.file_name}</p>
            {record.description && (
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {record.description}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mb-3">
        <span className="flex items-center gap-1">
          <HardDrive className="w-3.5 h-3.5" />
          {formatSize(record.file_size)}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          {formatDate(record.created_at)}
        </span>
        {record.device_id && (
          <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700">
            {record.device_id}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => handleDownload(record)}
          disabled={busyId === record.id}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
            bg-accent text-white rounded-md hover:bg-accent-600
            transition-colors duration-200 disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5" />
          Скачать
        </button>
        {record.file_type === 'backup' && (
          <button
            onClick={() => handleRestore(record)}
            disabled={busyId === record.id}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
            bg-warm-500 text-white rounded-md hover:bg-warm-600
            transition-colors duration-200 disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Восстановить
          </button>
        )}
        <button
          onClick={() => handleDelete(record)}
          disabled={busyId === record.id}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
            text-red-600 dark:text-red-400 rounded-md
            hover:bg-red-50 dark:hover:bg-red-900/20
            transition-colors duration-200 disabled:opacity-50"
        >
          {busyId === record.id ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Trash2 className="w-3.5 h-3.5" />
          )}
          Удалить
        </button>
      </div>
    </motion.div>
  );

  return (
    <div>
      {/* Upload area */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`cursor-pointer rounded-lg border-2 border-dashed p-6 text-center
          transition-colors duration-200 ${
            dragOver
              ? 'border-accent bg-accent-50 dark:bg-accent-800/20'
              : 'border-gray-300 dark:border-gray-600 hover:border-accent'
          }`}
      >
        <input ref={fileInputRef} type="file" className="hidden" onChange={onInputChange} />
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-full flex items-center justify-center bg-accent-50 dark:bg-accent-800/30">
            {uploading ? (
              <Loader2 className="w-6 h-6 text-accent animate-spin" />
            ) : (
              <Upload className="w-6 h-6 text-accent" />
            )}
          </div>
          <p className="text-sm font-semibold">
            {uploading ? 'Загрузка...' : 'Перетащите файл или нажмите для выбора'}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Тип файла
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => setFileType('backup')}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium
                rounded-md border transition-colors duration-200 ${
                  fileType === 'backup'
                    ? 'border-warm-500 bg-warm-50 dark:bg-warm-900/20 text-warm-700 dark:text-warm-400'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                }`}
            >
              <Archive className="w-4 h-4" />
              Резервная копия
            </button>
            <button
              onClick={() => setFileType('sync')}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium
                rounded-md border transition-colors duration-200 ${
                  fileType === 'sync'
                    ? 'border-accent bg-accent-50 dark:bg-accent-800/20 text-accent-700 dark:text-accent-300'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                }`}
            >
              <Cloud className="w-4 h-4" />
              Синхронизация
            </button>
          </div>
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Описание
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Например: бэкап перед обновлением"
            className="w-full px-3 py-2 text-sm rounded-md
              bg-white dark:bg-[#2D2D2D] border border-gray-200 dark:border-gray-700
              focus:border-accent focus:outline-none transition-colors duration-200"
          />
        </div>
      </div>

      {actionError && (
        <div className="mt-4 flex items-start gap-2 p-3 rounded-lg
          bg-warm-50 dark:bg-warm-900/20 border border-warm-200 dark:border-warm-800">
          <FileWarning className="w-4 h-4 text-warm-600 dark:text-warm-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-warm-700 dark:text-warm-400">{actionError}</p>
        </div>
      )}

      {error && (
        <div className="mt-4 flex items-start gap-2 p-3 rounded-lg
          bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <FileWarning className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-accent animate-spin" />
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="flex items-center gap-2 text-base font-semibold">
                <Archive className="w-4 h-4 text-warm-600 dark:text-warm-500" />
                Резервные копии
                <span className="text-sm font-normal text-gray-400">({backupFiles.length})</span>
              </h3>
              <button
                onClick={refresh}
                className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium
                  text-gray-500 hover:text-accent transition-colors duration-200"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Обновить
              </button>
            </div>
            {backupFiles.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center
                bg-gray-50 dark:bg-[#252525] rounded-lg">
                Резервные копии пока не загружены
              </p>
            ) : (
              <div className="space-y-2">{backupFiles.map(renderFileCard)}</div>
            )}
          </div>

          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold mb-3">
              <Cloud className="w-4 h-4 text-accent" />
              Файлы синхронизации
              <span className="text-sm font-normal text-gray-400">({syncFiles.length})</span>
            </h3>
            {syncFiles.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center
                bg-gray-50 dark:bg-[#252525] rounded-lg">
                Файлы синхронизации пока не загружены
              </p>
            ) : (
              <div className="space-y-2">{syncFiles.map(renderFileCard)}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
