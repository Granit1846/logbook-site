import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { getIcon } from '@/lib/iconMap';
import type { FeatureRow } from '@/lib/types';

interface FeaturesProps {
  features: FeatureRow[];
  loading: boolean;
  error: string | null;
}

const INITIAL_VISIBLE_COUNT = 6;

export default function Features({ features, loading, error }: FeaturesProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const visibleFeatures = isExpanded
    ? features
    : features.slice(0, INITIAL_VISIBLE_COUNT);
  const hasMore = features.length > INITIAL_VISIBLE_COUNT;

  return (
    <section id="features" className="py-14 sm:py-20 md:py-24">
      <div className="container-page">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8 sm:mb-12"
        >
          <h2 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4">
            Возможности программы
          </h2>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Полный набор инструментов для ведения формуляров авиационной техники
            и контроля ресурсов
          </p>
        </motion.div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 text-accent animate-spin" />
          </div>
        ) : error ? (
          <p className="text-center text-red-500 py-20">{error}</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              <AnimatePresence>
                {visibleFeatures.map((feature, index) => {
                  const Icon = getIcon(feature.icon_name);
                  return (
                    <motion.div
                      key={feature.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3, delay: index < INITIAL_VISIBLE_COUNT ? index * 0.04 : 0.05 }}
                      className="group p-5 sm:p-6 bg-white dark:bg-[#2D2D2D] rounded-xl sm:rounded-2xl
                        border border-gray-200 dark:border-gray-700
                        hover:border-accent dark:hover:border-accent-500
                        hover:shadow-md dark:hover:border-accent
                        transition-all duration-200 cursor-default"
                    >
                      <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-accent-50 dark:bg-accent-800/30
                        flex items-center justify-center mb-3 sm:mb-4
                        group-hover:bg-accent group-hover:scale-105
                        transition-all duration-200">
                        <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-accent group-hover:text-white transition-colors duration-200" />
                      </div>
                      <h3 className="text-base sm:text-lg font-bold mb-1.5 sm:mb-2 text-gray-900 dark:text-white">
                        {feature.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                        {feature.description}
                      </p>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {hasMore && (
              <div className="flex justify-center mt-8 sm:mt-10">
                <button
                  type="button"
                  onClick={() => setIsExpanded((prev) => !prev)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 sm:px-6 sm:py-3 text-xs sm:text-sm font-semibold rounded-xl
                    bg-white dark:bg-[#2D2D2D] text-gray-700 dark:text-gray-200
                    border border-gray-300 dark:border-gray-700 hover:border-accent dark:hover:border-accent
                    hover:text-accent dark:hover:text-accent-300 transition-all duration-200 shadow-xs hover:shadow"
                >
                  {isExpanded ? (
                    <>
                      <span>Свернуть список возможностей</span>
                      <ChevronUp className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      <span>Показать все возможности (+{features.length - INITIAL_VISIBLE_COUNT})</span>
                      <ChevronDown className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
