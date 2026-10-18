import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download,
  Monitor,
  Smartphone,
  Loader2,
  RefreshCw,
  ExternalLink,
  Github,
  Send,
  FileArchive,
  CheckCircle2,
  ChevronDown,
} from 'lucide-react';
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
  const [isOpen, setIsOpen] = useState(false);
  const windows = platform === 'windows';
  const Icon = windows ? Monitor : Smartphone;

  return (
    <article
      className={`flex flex-col rounded-2xl bg-white dark:bg-[#2D2D2D] border transition-all duration-300 shadow-xs ${
        isOpen
          ? 'border-accent/40 dark:border-accent/50 shadow-md ring-1 ring-accent/20'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
      }`}
    >
      {/* Interactive Header / Spoiler toggle */}
      <div className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex items-center gap-3.5 text-left flex-1 focus:outline-hidden group"
          aria-expanded={isOpen}
          aria-label={`${isOpen ? 'Свернуть' : 'Раскрыть'} информацию о версии ${windows ? 'Windows' : 'Android'}`}
        >
          <div className="rounded-xl p-3 bg-accent text-white shadow-xs shrink-0 group-hover:scale-105 transition-transform duration-200">
            <Icon className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg sm:text-xl font-bold tracking-tight text-gray-900 dark:text-white group-hover:text-accent transition-colors">
                {windows ? 'Windows' : 'Android'}
              </h3>
              {release && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                  <CheckCircle2 className="w-3 h-3" />
                  v{release.version}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
              {windows
                ? 'ПК · Windows 10/11 (64 бит)'
                : 'Смартфон и планшет · Android 8.0+'}
              {release?.sizeBytes && (
                <span className="ml-1.5 font-medium text-gray-600 dark:text-gray-300">
                  · {(release.sizeBytes / 1048576).toFixed(1)} МБ
                </span>
              )}
            </p>
          </div>
        </button>

        {/* Header action area */}
        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-gray-100 dark:border-gray-800">
          {/* Compact download button: visible ONLY when spoiler is closed */}
          {!isOpen && release?.url && (
            <a
              href={release.url}
              download
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg bg-accent text-white hover:bg-accent-600 transition-colors shadow-xs"
              title={windows ? 'Скачать установщик (.exe)' : 'Скачать APK файл'}
            >
              <Download className="w-4 h-4" />
              <span>{windows ? 'Скачать .exe' : 'Скачать APK'}</span>
            </a>
          )}

          {/* Toggle chevron button */}
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title={isOpen ? 'Свернуть подробности' : 'Развернуть подробности'}
          >
            <motion.div
              animate={{ rotate: isOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </motion.div>
          </button>
        </div>
      </div>

      {/* Expandable spoiler content */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-5 sm:px-6 sm:pb-6 pt-2 border-t border-gray-100 dark:border-gray-700/60 flex flex-col">
              <div className="flex-1" aria-live="polite">
                {loading ? (
                  <p className="flex items-center gap-2 text-gray-500 py-4 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin text-accent" />
                    Проверяем актуальную версию…
                  </p>
                ) : release ? (
                  <>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                      {release.sizeBytes && (
                        <span>
                          Размер файла: <strong>{(release.sizeBytes / 1048576).toFixed(1)} МБ</strong>
                        </span>
                      )}
                      {release.builtAt && (
                        <span>
                          Сборка: {new Date(release.builtAt).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' })}
                        </span>
                      )}
                    </div>

                    {release.notes && (
                      <div className="mb-4 p-3.5 rounded-xl bg-gray-50 dark:bg-[#252525] border border-gray-100 dark:border-gray-800 text-xs sm:text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                        <p className="font-semibold text-gray-900 dark:text-white mb-1.5">
                          Что нового в версии:
                        </p>
                        <p className="whitespace-pre-line">{release.notes}</p>
                      </div>
                    )}

                    {release.sha256 && (
                      <details className="mb-4 text-xs text-gray-500 dark:text-gray-400">
                        <summary className="cursor-pointer hover:text-accent transition-colors font-mono">
                          SHA-256 контрольная сумма
                        </summary>
                        <code className="block mt-2 p-2 rounded-lg bg-gray-100 dark:bg-gray-800 break-all text-[11px] font-mono select-all">
                          {release.sha256}
                        </code>
                      </details>
                    )}
                  </>
                ) : (
                  <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400 mb-4">
                    {windows
                      ? 'Сведения о версии загружаются...'
                      : 'Приложение для Android готово к установке.'}
                  </p>
                )}
              </div>

              {/* Full-width Download Button: relocated to bottom of expanded block */}
              <div className="mt-2 pt-3 border-t border-gray-100 dark:border-gray-800 flex flex-col gap-2.5">
                {release?.url && (
                  <a
                    href={release.url}
                    download
                    className="flex justify-center items-center gap-2.5 w-full px-5 py-3 rounded-xl bg-accent text-white font-semibold hover:bg-accent-600 transition-all shadow-sm hover:shadow text-sm sm:text-base"
                  >
                    <Download className="w-5 h-5" />
                    {windows ? 'Скачать установщик (.exe)' : 'Скачать APK файл'}
                  </a>
                )}

                {windows && release?.zipUrl && (
                  <a
                    href={release.zipUrl}
                    download
                    className="flex justify-center items-center gap-2 w-full px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-xs sm:text-sm"
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
                    Все релизы и история версий на GitHub
                    <ExternalLink className="w-3 h-3 ml-0.5" />
                  </a>
                )}

                {!loading && error && (
                  <button
                    type="button"
                    onClick={retry}
                    className="flex items-center justify-center gap-2 mt-1 w-full text-xs text-accent hover:underline"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Обновить статус версии
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}

function TelegramCard() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <article
      className={`flex flex-col rounded-2xl bg-gradient-to-br from-sky-50 to-white dark:from-[#1d2733] dark:to-[#222b35] border transition-all duration-300 shadow-xs ${
        isOpen
          ? 'border-sky-300 dark:border-sky-700/80 shadow-md ring-1 ring-[#2AABEE]/20'
          : 'border-sky-100 dark:border-sky-900/50 hover:border-sky-200 dark:hover:border-sky-800'
      }`}
    >
      {/* Interactive Header / Spoiler toggle */}
      <div className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex items-center gap-3.5 text-left flex-1 focus:outline-hidden group"
          aria-expanded={isOpen}
          aria-label={`${isOpen ? 'Свернуть' : 'Раскрыть'} информацию о Telegram Mini App`}
        >
          <div className="rounded-xl p-3 bg-[#2AABEE] text-white shadow-xs shrink-0 group-hover:scale-105 transition-transform duration-200">
            <Send className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg sm:text-xl font-bold tracking-tight text-gray-900 dark:text-white group-hover:text-[#2AABEE] transition-colors">
                Telegram App & Бот
              </h3>
              <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-700/60">
                Mini App
              </span>
            </div>
            <p className="text-xs text-sky-700 dark:text-sky-300 truncate mt-0.5">
              @my_logbook_app_bot · Без установки файлов
            </p>
          </div>
        </button>

        {/* Header action area */}
        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-sky-100 dark:border-sky-900/40">
          {/* Compact open button: visible ONLY when spoiler is closed */}
          {!isOpen && (
            <a
              href="https://t.me/my_logbook_app_bot"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg bg-[#2AABEE] text-white hover:bg-[#229ED9] transition-colors shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Открыть</span>
            </a>
          )}

          {/* Toggle chevron button */}
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-sky-100/50 dark:hover:bg-gray-800 transition-colors"
            title={isOpen ? 'Свернуть подробности' : 'Развернуть подробности'}
          >
            <motion.div
              animate={{ rotate: isOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </motion.div>
          </button>
        </div>
      </div>

      {/* Expandable spoiler content */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-5 sm:px-6 sm:pb-6 pt-2 border-t border-sky-100 dark:border-sky-900/40 flex flex-col">
              <div className="flex-1 text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed space-y-3">
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
                    <span><strong>Мониторинг наработки:</strong> карточки бортов, остатки ресурсов масел и агрегатов онлайн.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#2AABEE] shrink-0 mt-0.5" />
                    <span><strong>Оповещения об обновлениях:</strong> рассылка новых версий приложений инженерам и пилотам.</span>
                  </li>
                </ul>
              </div>

              {/* Relocated full-size button */}
              <div className="mt-4 pt-3 border-t border-sky-100 dark:border-sky-900/40 flex flex-col gap-2.5">
                <a
                  href="https://t.me/my_logbook_app_bot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex justify-center items-center gap-2.5 w-full px-5 py-3 rounded-xl bg-[#2AABEE] text-white font-semibold hover:bg-[#229ED9] transition-all shadow-sm hover:shadow text-sm sm:text-base"
                >
                  <Send className="w-5 h-5" />
                  Открыть бота @my_logbook_app_bot
                  <ExternalLink className="w-4 h-4 ml-1 opacity-80" />
                </a>
                <p className="text-center text-xs text-gray-400 dark:text-gray-500">
                  Работает в Telegram на iOS, Android, Windows, macOS и Linux
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}

export default function DownloadSection() {
  const releases = useReleaseManifests();

  return (
    <section id="download" className="py-14 sm:py-20 md:py-24 bg-gray-100 dark:bg-[#252525] transition-colors duration-300">
      <div className="container-page">
        <div className="text-center mb-8 sm:mb-12">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight mb-3 sm:mb-4">
            Скачать LogBook
          </h2>
          <p className="text-sm sm:text-base md:text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Нажмите на карточку для просмотра подробностей и списка изменений или скачайте установочный файл сразу.
          </p>
        </div>

        {/* Responsive flex/grid: neatly stacked on mobile/tablet, multi-column on large screens */}
        <div className="flex flex-col gap-4 sm:gap-5 max-w-3xl mx-auto">
          <ReleaseCard platform="windows" {...releases.windows} retry={releases.retry} />
          <ReleaseCard platform="android" {...releases.android} retry={releases.retry} />
          <TelegramCard />
        </div>
      </div>
    </section>
  );
}
