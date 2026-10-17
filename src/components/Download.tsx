import { Download, Monitor, Smartphone, Loader2, RefreshCw, ExternalLink, Github, Send, FileArchive, CheckCircle2 } from 'lucide-react';
import { useReleaseManifests, type ReleaseManifest } from '@/hooks/useReleaseManifests';

function ReleaseCard({
  platform,
  release,
  loading,
  error,
  retry,
}: {
  platform: 'windows' | 'android';
  release: ReleaseManifest | null;
  loading: boolean;
  error: boolean;
  retry: () => void;
}) {
  const windows = platform === 'windows';
  const Icon = windows ? Monitor : Smartphone;

  return (
    <article className="flex flex-col p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#2D2D2D] border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow duration-300">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="rounded-xl p-3.5 bg-accent text-white shadow-sm">
            <Icon className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-xl font-bold tracking-tight">{windows ? 'Windows' : 'Android'}</h3>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              {windows ? 'ПК · Windows 10/11 (64 бит)' : 'Смартфон и планшет · Android 7.0+'}
            </p>
          </div>
        </div>
        {release && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
            <CheckCircle2 className="w-3.5 h-3.5" />
            v{release.version}
          </span>
        )}
      </div>

      <div className="flex-1" aria-live="polite">
        {loading ? (
          <p className="flex items-center gap-2 text-gray-500 py-6">
            <Loader2 className="w-4 h-4 animate-spin text-accent" />
            Проверяем актуальную версию…
          </p>
        ) : release ? (
          <>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              {release.sizeBytes && (
                <span>
                  Размер: <strong>{(release.sizeBytes / 1048576).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} МБ</strong>
                </span>
              )}
              {release.builtAt && (
                <span>Сборка от {new Date(release.builtAt).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' })}</span>
              )}
            </div>

            {release.notes && (
              <div className="mb-5 p-3.5 rounded-lg bg-gray-50 dark:bg-[#252525] border border-gray-100 dark:border-gray-800 text-xs sm:text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                <p className="font-medium text-gray-900 dark:text-white mb-1.5">Описание релиза:</p>
                <p className="whitespace-pre-line">{release.notes}</p>
              </div>
            )}

            {release.sha256 && (
              <details className="mb-5 text-xs text-gray-500 dark:text-gray-400">
                <summary className="cursor-pointer hover:text-accent transition-colors font-mono">
                  SHA-256 контрольная сумма
                </summary>
                <code className="block mt-2 p-2 rounded bg-gray-100 dark:bg-gray-800 break-all text-[11px] font-mono select-all">
                  {release.sha256}
                </code>
              </details>
            )}
          </>
        ) : (
          <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400 mb-5">
            {windows
              ? 'Сведения о версии загружаются...'
              : 'Приложение для Android готово к установке.'}
          </p>
        )}
      </div>

      <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700/60 flex flex-col gap-2.5">
        {release?.url && (
          <a
            href={release.url}
            download
            className="flex justify-center items-center gap-2.5 w-full px-5 py-3 rounded-xl bg-accent text-white font-semibold hover:bg-accent-600 transition-all shadow-sm hover:shadow"
          >
            <Download className="w-5 h-5" />
            {windows ? 'Скачать установщик (.exe)' : 'Скачать APK файл'}
          </a>
        )}

        {windows && release?.zipUrl && (
          <a
            href={release.zipUrl}
            download
            className="flex justify-center items-center gap-2 w-full px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm"
          >
            <FileArchive className="w-4 h-4 text-accent" />
            Портативная версия (.zip, без установки)
          </a>
        )}

        {release?.githubUrl && (
          <a
            href={release.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex justify-center items-center gap-1.5 w-full py-2 text-xs text-gray-500 hover:text-accent dark:text-gray-400 dark:hover:text-accent-300 transition-colors"
          >
            <Github className="w-3.5 h-3.5" />
            Все релизы и исходный код на GitHub
            <ExternalLink className="w-3 h-3 ml-0.5" />
          </a>
        )}

        {!loading && error && (
          <button
            onClick={retry}
            className="flex items-center justify-center gap-2 mt-2 w-full text-xs text-accent hover:underline"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Обновить статус версии
          </button>
        )}
      </div>
    </article>
  );
}

function TelegramCard() {
  return (
    <article className="flex flex-col p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-sky-50 to-white dark:from-[#1d2733] dark:to-[#222b35] border border-sky-100 dark:border-sky-900/50 shadow-sm hover:shadow-md transition-shadow duration-300">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="rounded-xl p-3.5 bg-[#2AABEE] text-white shadow-sm">
            <Send className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-xl font-bold tracking-tight">Telegram App & Бот</h3>
            <p className="text-xs sm:text-sm text-sky-700 dark:text-sky-300">
              @my_logbook_app_bot · Без установки
            </p>
          </div>
        </div>
        <span className="inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-700/60">
          Mini App
        </span>
      </div>

      <div className="flex-1 text-sm text-gray-600 dark:text-gray-300 leading-relaxed space-y-3">
        <p>
          Мгновенный доступ к данным авиационной техники прямо в мессенджере Telegram на любом смартфоне (iOS / Android) или компьютере.
        </p>
        <ul className="space-y-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#2AABEE] shrink-0 mt-0.5" />
            <span><strong>Безопасный вход:</strong> генерация 6-значных OTP-кодов для авторизации мобильного приложения и ПК.</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#2AABEE] shrink-0 mt-0.5" />
            <span><strong>Мониторинг наработки:</strong> карточки бортов, остатки ресурсов масел и агрегатов в реальном времени.</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#2AABEE] shrink-0 mt-0.5" />
            <span><strong>Оповещения об обновлениях:</strong> рассылка новых версий приложений инженерам и пилотам.</span>
          </li>
        </ul>
      </div>

      <div className="mt-6 pt-4 border-t border-sky-100 dark:border-sky-900/40 flex flex-col gap-2.5">
        <a
          href="https://t.me/my_logbook_app_bot"
          target="_blank"
          rel="noopener noreferrer"
          className="flex justify-center items-center gap-2.5 w-full px-5 py-3 rounded-xl bg-[#2AABEE] text-white font-semibold hover:bg-[#229ED9] transition-all shadow-sm hover:shadow"
        >
          <Send className="w-5 h-5" />
          Открыть бота @my_logbook_app_bot
          <ExternalLink className="w-4 h-4 ml-1 opacity-80" />
        </a>
        <p className="text-center text-xs text-gray-400 dark:text-gray-500">
          Работает в Telegram на iOS, Android, Windows, macOS и Linux
        </p>
      </div>
    </article>
  );
}

export default function DownloadSection() {
  const releases = useReleaseManifests();

  return (
    <section id="download" className="py-20 md:py-24 bg-gray-100 dark:bg-[#252525] transition-colors duration-300">
      <div className="container-page">
        <div className="text-center mb-14">
          <h2 className="text-2xl md:text-4xl font-extrabold tracking-tight mb-4">
            Скачать LogBook
          </h2>
          <p className="text-base md:text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Выберите удобный клиент: нативные приложения для ПК и Android с полной офлайн-работой, либо запустите Telegram Mini App без установки.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          <ReleaseCard platform="windows" {...releases.windows} retry={releases.retry} />
          <ReleaseCard platform="android" {...releases.android} retry={releases.retry} />
          <TelegramCard />
        </div>
      </div>
    </section>
  );
}
