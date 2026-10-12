import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { getIcon } from '@/lib/iconMap';
import type { FeatureRow } from '@/lib/types';

interface FeaturesProps {
  features: FeatureRow[];
  loading: boolean;
  error: string | null;
}

export default function Features({ features, loading, error }: FeaturesProps) {
  return (
    <section id="features" className="py-20 md:py-24">
      <div className="container-page">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Возможности программы
          </h2>
          <p className="text-base text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => {
              const Icon = getIcon(feature.icon_name);
              return (
                <motion.div
                  key={feature.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-50px' }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  className="group p-6 bg-white dark:bg-[#2D2D2D] rounded-lg
                    border border-gray-200 dark:border-gray-700
                    hover:border-accent dark:hover:border-accent-500
                    hover:shadow-lg dark:hover:border-accent
                    transition-all duration-200 cursor-default"
                >
                  <div className="w-12 h-12 rounded-lg bg-accent-50 dark:bg-accent-800/30
                    flex items-center justify-center mb-4
                    group-hover:bg-accent group-hover:scale-105
                    transition-all duration-200">
                    <Icon className="w-6 h-6 text-accent group-hover:text-white transition-colors duration-200" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    {feature.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
