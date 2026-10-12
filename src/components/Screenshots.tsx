import { useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, X, Loader2, Monitor, Smartphone, Layers, ZoomIn } from 'lucide-react';
import type { ScreenshotRow } from '@/lib/types';

interface ScreenshotsProps {
  screenshots: ScreenshotRow[];
  loading: boolean;
  error: string | null;
}

type TabCategory = 'all' | 'desktop' | 'android';

export default function Screenshots({ screenshots, loading, error }: ScreenshotsProps) {
  const [selected, setSelected] = useState<ScreenshotRow | null>(null);
  const [activeTab, setActiveTab] = useState<TabCategory>('all');
  const scrollRef = useRef<HTMLDivElement>(null);

  const filteredScreenshots = useMemo(() => {
    if (activeTab === 'all') return screenshots;
    return screenshots.filter((s) => s.category === activeTab);
  }, [screenshots, activeTab]);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = 360;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    });
  };

  return (
    <section id="screenshots" className="py-20 md:py-24 bg-gray-100 dark:bg-[#252525]">
      <div className="container-page">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Скриншоты системы</h2>
          <p className="text-base text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Оцените эргономику и возможности интерфейса на ПК (Windows) и планшетах/смартфонах (Android)
          </p>

          {/* Filter Tabs */}
          <div className="inline-flex p-1 mt-6 rounded-xl bg-gray-200 dark:bg-[#2D2D2D] border border-gray-300 dark:border-gray-700">
            <button
              onClick={() => setActiveTab('all')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === 'all'
                  ? 'bg-white dark:bg-[#1E1E1E] text-accent shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Layers className="w-4 h-4" />
              Все ({screenshots.length})
            </button>
            <button
              onClick={() => setActiveTab('desktop')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === 'desktop'
                  ? 'bg-white dark:bg-[#1E1E1E] text-accent shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Monitor className="w-4 h-4" />
              Windows ПК
            </button>
            <button
              onClick={() => setActiveTab('android')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === 'android'
                  ? 'bg-white dark:bg-[#1E1E1E] text-accent shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              Android
            </button>
          </div>
        </motion.div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 text-accent animate-spin" />
          </div>
        ) : error ? (
          <p className="text-center text-red-500 py-20">{error}</p>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs uppercase tracking-wider font-semibold text-gray-500 dark:text-gray-400">
                Показано: {filteredScreenshots.length} экранов
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => scroll('left')}
                  className="w-10 h-10 rounded-lg bg-white dark:bg-[#2D2D2D] flex items-center justify-center
                    hover:bg-accent hover:text-white transition-colors duration-200 shadow-sm"
                  aria-label="Назад"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => scroll('right')}
                  className="w-10 h-10 rounded-lg bg-white dark:bg-[#2D2D2D] flex items-center justify-center
                    hover:bg-accent hover:text-white transition-colors duration-200 shadow-sm"
                  aria-label="Вперёд"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div
              ref={scrollRef}
              className="flex gap-5 overflow-x-auto pb-6 scroll-smooth snap-x"
              style={{ scrollbarWidth: 'thin' }}
            >
              {filteredScreenshots.map((shot) => {
                const isAndroidPortrait = shot.category === 'android' && shot.imageUrl && !shot.imageUrl.includes('landscape');
                return (
                  <motion.div
                    key={shot.id}
                    layout
                    whileHover={{ scale: 1.02, y: -4 }}
                    onClick={() => setSelected(shot)}
                    className={`flex-shrink-0 snap-start cursor-pointer group flex flex-col ${
                      isAndroidPortrait ? 'w-56 md:w-64' : 'w-72 md:w-80'
                    }`}
                  >
                    <div
                      className={`w-full rounded-xl overflow-hidden relative shadow-md group-hover:shadow-xl
                        transition-all duration-300 border border-gray-200 dark:border-gray-700 bg-gray-900 ${
                          isAndroidPortrait ? 'aspect-[9/16]' : 'aspect-[16/10]'
                        }`}
                    >
                      {shot.imageUrl ? (
                        <img
                          src={shot.imageUrl}
                          alt={shot.title}
                          className="w-full h-full object-cover object-top group-hover:brightness-105 transition-all duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <div
                          className="w-full h-full flex items-center justify-center"
                          style={{ backgroundColor: shot.color }}
                        >
                          <span className="text-4xl font-bold text-white/30">{shot.sort_order}</span>
                        </div>
                      )}

                      <div className="absolute top-2 left-2 flex gap-1">
                        <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded bg-black/60 text-white backdrop-blur-sm">
                          {shot.category === 'android' ? 'Android' : 'Windows'}
                        </span>
                      </div>

                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 dark:bg-[#1E1E1E]/90 text-xs font-semibold text-gray-900 dark:text-white shadow-lg">
                          <ZoomIn className="w-3.5 h-3.5" /> Увеличить
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 flex-1">
                      <p className="text-sm font-bold text-gray-800 dark:text-gray-200 line-clamp-1">
                        {shot.title}
                      </p>
                      {shot.description && (
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                          {shot.description}
                        </p>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Lightbox / Modal */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelected(null)}
            className="fixed inset-0 z-[100] flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-5xl w-full bg-[#1E1E1E] text-white rounded-2xl overflow-hidden shadow-2xl border border-gray-800 flex flex-col max-h-[92vh]"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800 bg-[#252525]">
                <div className="flex items-center gap-3">
                  <span className="px-2.5 py-1 text-xs font-semibold uppercase tracking-wider rounded bg-accent/20 text-accent">
                    {selected.category === 'android' ? 'Android' : 'Windows ПК'}
                  </span>
                  <h3 className="text-base font-semibold">{selected.title}</h3>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="w-9 h-9 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center transition-colors"
                  aria-label="Закрыть"
                >
                  <X className="w-5 h-5 text-gray-300" />
                </button>
              </div>

              {/* Image body */}
              <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/40">
                {selected.imageUrl ? (
                  <img
                    src={selected.imageUrl}
                    alt={selected.title}
                    className="max-h-[68vh] w-auto max-w-full rounded-lg object-contain shadow-2xl"
                  />
                ) : (
                  <div
                    className="w-full h-80 rounded-lg flex items-center justify-center text-4xl font-bold text-white/30"
                    style={{ backgroundColor: selected.color }}
                  >
                    {selected.title}
                  </div>
                )}
              </div>

              {/* Footer description */}
              {selected.description && (
                <div className="px-6 py-4 bg-[#252525] border-t border-gray-800">
                  <p className="text-sm text-gray-300 leading-relaxed">
                    {selected.description}
                  </p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

