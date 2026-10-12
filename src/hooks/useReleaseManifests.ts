import { useCallback, useEffect, useState } from 'react';

const storage = 'https://zjagjauwmpuzcwzidhkn.supabase.co/storage/v1/object/public/updates';
export const releaseSources = { windows: `${storage}/version.json`, android: `${storage}/android/version.json` };
export interface ReleaseManifest {
  version: string; url: string; notes: string; sizeBytes?: number; sha256?: string; builtAt?: string;
}

const localCurrent: Record<'windows' | 'android', ReleaseManifest> = {
  windows: { version: '1.1.13', url: '', notes: 'Текущая версия ПК' },
  android: { version: '1.1.17', url: '', notes: 'Текущая версия Android' },
};

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const va = pa[i] ?? 0;
    const vb = pb[i] ?? 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

export function parseRelease(value: unknown): ReleaseManifest {
  if (!value || typeof value !== 'object') throw new Error('Некорректные сведения о версии');
  const item = value as Record<string, unknown>;
  if (typeof item.version !== 'string' || !/^\d+(?:\.\d+){0,3}$/.test(item.version)) throw new Error('Некорректный номер версии');
  const rawUrl = typeof item.url === 'string' ? item.url : '';
  const url = rawUrl ? new URL(rawUrl) : null;
  if (url && (url.protocol !== 'https:' || url.username || url.password)) throw new Error('Некорректная ссылка на скачивание');
  return { version: item.version, url: url?.href ?? '', notes: typeof item.notes === 'string' ? item.notes : '',
    sizeBytes: typeof item.sizeBytes === 'number' && Number.isSafeInteger(item.sizeBytes) && item.sizeBytes > 0 ? item.sizeBytes : undefined,
    sha256: typeof item.sha256 === 'string' && /^[a-f\d]{64}$/i.test(item.sha256) ? item.sha256 : undefined,
    builtAt: typeof item.builtAt === 'string' && Number.isFinite(Date.parse(item.builtAt)) ? item.builtAt : undefined };
}
type Result = { release: ReleaseManifest | null; loading: boolean; error: boolean };
export function useReleaseManifests() {
  const [attempt, setAttempt] = useState(0);
  const [results, setResults] = useState<Record<'windows' | 'android', Result>>({
    windows: { release: null, loading: true, error: false }, android: { release: null, loading: true, error: false },
  });
  const retry = useCallback(() => setAttempt((x) => x + 1), []);
  useEffect(() => {
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 12000);
    let active = true;
    setResults({ windows: { release: null, loading: true, error: false }, android: { release: null, loading: true, error: false } });
    const requests = (Object.keys(releaseSources) as ('windows' | 'android')[]).map(async (platform) => {
      const local = localCurrent[platform];
      let result: Result;
      try {
        const response = await fetch(releaseSources[platform], { signal: abort.signal, cache: 'no-store', credentials: 'omit' });
        if (!response.ok) throw new Error('Версия ещё не опубликована');
        const fetched = parseRelease(await response.json());
        if (compareVersions(fetched.version, local.version) < 0) {
          result = { release: local, loading: false, error: false };
        } else {
          result = { release: fetched, loading: false, error: false };
        }
      } catch {
        result = { release: local, loading: false, error: true };
      }
      if (active) setResults((old) => ({ ...old, [platform]: result }));
    });
    void Promise.all(requests).finally(() => clearTimeout(timeout));
    return () => { active = false; clearTimeout(timeout); abort.abort(); };
  }, [attempt]);
  return { ...results, retry };
}
