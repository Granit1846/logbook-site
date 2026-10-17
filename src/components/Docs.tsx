import { BookOpen } from 'lucide-react';

const guides = [
  {
    id: 'install',
    title: 'Установка',
    steps: [
      'Windows: скачайте установщик Logbook_Setup_1.1.13.exe из раздела «Скачать» и установите программу, либо используйте портативный архив LogBook-PC.zip (без установки).',
      'Android: скачайте установочный файл LogBook.apk на устройство (версия 1.1.28), откройте его и подтвердите установку. Новая версия сохраняет все ваши базы и профили.',
    ],
  },
  {
    id: 'first-start',
    title: 'Первый запуск',
    steps: [
      'Создайте профиль борта и заполните номера установленных агрегатов.',
      'Внесите начальные значения в формуляры, затем заполните ресурсы агрегатов и масел. Незаполненные ограничения оставляйте пустыми.',
    ],
  },
  {
    id: 'formulars',
    title: 'Полёты и формуляры',
    steps: [
      'В «Полётах» выберите дату, заполните экипаж, запуски и СНК. Команда «Закончить день» создаёт записи формуляров.',
      'В Android формуляр можно масштабировать двумя пальцами и кнопками в верхней панели. При замене агрегата используйте отдельную команду замены, чтобы сохранить историю.',
      'Удаление дня крестиком в формуляре удаляет его связанные записи целиком. Перед удалением проверьте выбранную дату.',
    ],
  },
  {
    id: 'resources',
    title: 'Ресурсы и масла',
    steps: [
      'Введите известные ограничения, сроки и наработку. Пустое ограничение означает, что оно не задано.',
      'Предупреждения отражают заполненные ограничения. Проверяйте наработку и сроки при установке или замене агрегата.',
    ],
  },
  {
    id: 'sync-guide',
    title: 'Синхронизация и копии',
    steps: [
      'Вход через Telegram-бота: в окне синхронизации нажмите «Войти через Telegram», получите 6-значный код и отправьте его боту @my_logbook_app_bot. Приложение авторизуется мгновенно.',
      'По Wi-Fi без интернета: подключите ПК и телефон к общей Wi-Fi сети (или точке доступа смартфона), откройте на ПК окно QR-кода и отсканируйте его с телефона.',
      'Облачная синхронизация: выберите личное пространство для своих бортов или общее пространство для выборочного обмена бортами с коллегами.',
      'Резервные копии: перед каждой синхронизацией копия создается автоматически; также доступен ручной экспорт в JSON.',
    ],
  },
  {
    id: 'printing',
    title: 'Печать и PDF',
    steps: [
      'Откройте печать, выберите формуляры и нужный период.',
      'Проверьте страницы в предпросмотре, затем сохраните PDF или отправьте документ на доступный принтер.',
    ],
  },
];

export default function Docs() {
  return (
    <section id="docs" className="py-14 sm:py-20 md:py-24">
      <div className="container-page">
        <div className="text-center mb-8 sm:mb-12">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight mb-3 sm:mb-4">
            Краткое руководство
          </h2>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Начало работы, формуляры, обмен данными и резервные копии.
          </p>
        </div>

        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-3 sm:gap-4 items-start">
          {guides.map((guide) => (
            <details
              key={guide.id}
              id={guide.id}
              className="group scroll-mt-24 p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#2D2D2D] open:border-accent/50 open:shadow-sm transition-all duration-200"
            >
              <summary className="cursor-pointer font-bold text-sm sm:text-base text-gray-900 dark:text-white flex items-center justify-between list-none select-none">
                <span className="flex items-center gap-2.5">
                  <BookOpen className="w-5 h-5 text-accent shrink-0" />
                  <span>{guide.title}</span>
                </span>
                <span className="text-gray-400 group-open:rotate-180 transition-transform duration-200">
                  ▼
                </span>
              </summary>
              <ol className="mt-4 ml-4 list-decimal space-y-2.5 text-xs sm:text-sm leading-relaxed text-gray-600 dark:text-gray-300 pl-2 border-t border-gray-100 dark:border-gray-800 pt-3">
                {guide.steps.map((step) => (
                  <li key={step} className="pl-1">
                    {step}
                  </li>
                ))}
              </ol>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
