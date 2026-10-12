import { motion } from 'framer-motion';
import { Download, BookOpen, Monitor, Smartphone, Wifi, WifiOff } from 'lucide-react';

const badges = [
  { icon: Monitor, label: 'Windows 10/11' },
  { icon: Smartphone, label: 'Android' },
  { icon: WifiOff, label: 'Офлайн' },
];

export default function Hero() {
  return (
    <section
      id="hero"
      className="relative pt-28 pb-20 md:pt-36 md:pb-24 overflow-hidden"
    >
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-accent-100 dark:bg-accent-900/20 rounded-full blur-3xl opacity-60" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-warm-100 dark:bg-warm-900/10 rounded-full blur-3xl opacity-40" />
      </div>

      <div className="container-page">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: text */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            <div className="flex flex-wrap gap-2 mb-6">
              {badges.map((badge) => (
                <span
                  key={badge.label}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                    bg-white dark:bg-[#2D2D2D] text-accent-700 dark:text-accent-300
                    rounded-full border border-gray-200 dark:border-gray-700"
                >
                  <badge.icon className="w-3.5 h-3.5" />
                  {badge.label}
                </span>
              ))}
            </div>

            <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold leading-tight tracking-tight mb-6">
              Logbook — формуляры авиационной техники под контролем
            </h1>

            <p className="text-lg text-gray-600 dark:text-gray-400 mb-8 max-w-xl leading-relaxed">
              Программа для ведения формуляров, расчёта ресурсов и анализа
              наработки на ПК и Android. Работает офлайн, хранит данные локально.
              Обмен между устройствами — через интернет или по Wi-Fi с QR-кодом.
            </p>

            <div className="flex flex-wrap gap-4">
              <a
                href="#download"
                className="flex items-center gap-2 px-6 py-3 text-base font-semibold
                  bg-accent text-white rounded-md hover:bg-accent-600
                  transition-colors duration-200 shadow-md hover:shadow-lg"
              >
                <Download className="w-5 h-5" />
                Windows и Android
              </a>
              <a
                href="#docs"
                className="flex items-center gap-2 px-6 py-3 text-base font-semibold
                  bg-white dark:bg-[#2D2D2D] text-accent-700 dark:text-accent-300
                  border-2 border-accent rounded-md hover:bg-accent-50 dark:hover:bg-accent-800
                  transition-colors duration-200"
              >
                <BookOpen className="w-5 h-5" />
                Документация
              </a>
            </div>
          </motion.div>

          {/* Right: screenshot placeholder */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
            className="relative"
          >
            <div className="relative rounded-lg overflow-hidden shadow-2xl border border-gray-300 dark:border-gray-700">
              {/* Window chrome */}
              <div className="flex items-center gap-2 px-4 py-3 bg-gray-200 dark:bg-[#2D2D2D] border-b border-gray-300 dark:border-gray-700">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
                <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                  Logbook — Главное окно
                </span>
              </div>
              {/* Screenshot image */}
              <div className="relative aspect-[16/10] bg-gray-900 flex items-center justify-center overflow-hidden">
                <img
                  src="/hero-screenshot.png"
                  alt="Интерфейс Logbook — Главное окно и Журнал ТО"
                  className="w-full h-full object-cover object-top hover:scale-[1.02] transition-transform duration-500"
                  loading="eager"
                />
              </div>
            </div>

            {/* Floating accent card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="absolute -bottom-4 -left-4 hidden md:flex items-center gap-3 px-4 py-3
                bg-white dark:bg-[#2D2D2D] rounded-lg shadow-lg border border-gray-200 dark:border-gray-700"
            >
              <div className="w-10 h-10 rounded-lg bg-warm-500/20 flex items-center justify-center">
                <Wifi className="w-5 h-5 text-warm-600 dark:text-warm-500" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Режим</p>
                <p className="text-sm font-semibold">Офлайн работа</p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
