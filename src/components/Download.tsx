import { Download, Monitor, Smartphone, Loader2, RefreshCw } from 'lucide-react';
import { useReleaseManifests, type ReleaseManifest } from '@/hooks/useReleaseManifests';

function ReleaseCard({ platform, release, loading, error, retry }: {
  platform: 'windows' | 'android'; release: ReleaseManifest | null; loading: boolean; error: boolean; retry: () => void;
}) {
  const windows = platform === 'windows';
  const Icon = windows ? Monitor : Smartphone;
  return <article className="flex flex-col p-6 sm:p-8 rounded-xl bg-white dark:bg-[#2D2D2D] border border-gray-200 dark:border-gray-700 shadow-sm">
    <div className="flex items-center gap-4 mb-6"><div className="rounded-xl p-3 bg-accent text-white"><Icon className="w-7 h-7" /></div>
      <div><h3 className="text-xl font-bold">{windows ? 'Windows' : 'Android'}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">{windows ? 'ПК · Windows 10/11, 64 бит' : 'Смартфон и планшет · APK'}</p></div></div>
    <div className="flex-1" aria-live="polite">
      {loading ? <p className="flex items-center gap-2 text-gray-500"><Loader2 className="w-4 h-4 animate-spin" />Проверяем актуальную версию…</p>
        : release ? <><p className="text-lg font-semibold mb-3">Версия {release.version}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4 text-sm text-gray-500 dark:text-gray-400">
            {release.sizeBytes && <span>{(release.sizeBytes / 1048576).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} МБ</span>}
            {release.builtAt && <span>Сборка {new Date(release.builtAt).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' })}</span>}
          </div>
          {release.notes && <details className="mb-5"><summary className="cursor-pointer text-accent font-medium">Что нового</summary><p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-gray-600 dark:text-gray-300">{release.notes}</p></details>}
          {release.sha256 && <details className="mb-5 text-sm"><summary className="cursor-pointer text-gray-500 dark:text-gray-400">Контрольная сумма SHA-256</summary><code className="block mt-2 break-all text-xs">{release.sha256}</code></details>}
        </> : <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400 mb-5">{windows ? 'Не удалось получить сведения о текущей версии.' : 'Приложение для Android уже доступно пользователям. Публичная ссылка на APK готовится.'}</p>}
    </div>
    {release?.url ? <a href={release.url} className="mt-4 flex justify-center items-center gap-2 px-5 py-3 rounded-lg bg-accent text-white font-semibold hover:bg-accent-600 transition-colors"><Download className="w-5 h-5" />{windows ? 'Скачать для Windows' : 'Скачать APK'}</a>
      : <div className="mt-4"><button disabled className="w-full px-5 py-3 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 cursor-not-allowed">{loading ? 'Проверяем версию…' : 'Ссылка на скачивание готовится'}</button>
        {!loading && error && <button onClick={retry} className="flex items-center justify-center gap-2 mt-3 w-full text-sm text-accent hover:underline"><RefreshCw className="w-4 h-4" />Проверить ещё раз</button>}</div>}
  </article>;
}
export default function DownloadSection() {
  const releases = useReleaseManifests();
  return <section id="download" className="py-20 md:py-24 bg-gray-100 dark:bg-[#252525]">
    <div className="container-page"><div className="text-center mb-12"><h2 className="text-2xl md:text-3xl font-bold mb-4">Скачать LogBook</h2>
      <p className="text-base text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">Выберите приложение для ПК или Android. Данные можно переносить через интернет или по Wi-Fi с QR-кодом.</p></div>
      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        <ReleaseCard platform="windows" {...releases.windows} retry={releases.retry} />
        <ReleaseCard platform="android" {...releases.android} retry={releases.retry} />
      </div>
    </div>
  </section>;
}
