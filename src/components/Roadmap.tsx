import { motion } from 'framer-motion';
import { Check, Wrench, Calendar, Loader2 } from 'lucide-react';
import type { RoadmapRow } from '@/lib/types';

interface RoadmapProps {
  roadmap: RoadmapRow[];
  loading: boolean;
  error: string | null;
}

const statusConfig = {
  done: {
    label: 'Готово',
    icon: Check,
    color: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-100 dark:bg-green-900/30',
    ring: 'ring-green-400',
  },
  'in-progress': {
    label: 'В работе',
    icon: Wrench,
    color: 'text-warm-600 dark:text-warm-500',
    bg: 'bg-warm-100 dark:bg-warm-900/30',
    ring: 'ring-warm-400',
  },
  planned: {
    label: 'Запланировано',
    icon: Calendar,
    color: 'text-gray-500 dark:text-gray-400',
    bg: 'bg-gray-100 dark:bg-gray-700',
    ring: 'ring-gray-400',
  },
} as const;

export default function Roadmap({ roadmap, loading, error }: RoadmapProps) {
  return (
    <section id="roadmap" className="py-20 md:py-24">
      <div className="container-page">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Дорожная карта</h2>
          <p className="text-base text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Развитие проекта — что уже сделано и что планируется в будущем
          </p>
        </motion.div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 text-accent animate-spin" />
          </div>
        ) : error ? (
          <p className="text-center text-red-500 py-20">{error}</p>
        ) : (
          <div className="relative max-w-3xl mx-auto">
            <div className="absolute left-5 md:left-1/2 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700 md:-translate-x-1/2" />

            {roadmap.map((item, index) => {
              const config = statusConfig[item.status] ?? statusConfig.planned;
              const isLeft = index % 2 === 0;
              const Icon = config.icon;

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-50px' }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  className={`relative flex items-start gap-6 mb-8 ${
                    isLeft ? 'md:flex-row-reverse md:text-right' : ''
                  }`}
                >
                  <div className="absolute left-5 md:left-1/2 -translate-x-1/2 z-10">
                    <div
                      className={`w-10 h-10 rounded-full ${config.bg} flex items-center justify-center ring-2 ${config.ring}`}
                    >
                      <Icon className={`w-5 h-5 ${config.color}`} />
                    </div>
                  </div>

                  <div className={`flex-1 pl-16 md:pl-0 ${isLeft ? 'md:pr-16 md:text-right' : 'md:pl-16'}`}>
                    <div className="p-5 bg-white dark:bg-[#2D2D2D] rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow duration-200">
                      <div className={`flex items-center gap-3 mb-2 ${isLeft ? 'md:flex-row-reverse' : ''}`}>
                        <span className="text-sm font-bold text-accent">{item.version}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${config.bg} ${config.color} font-medium`}>
                          {config.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">{item.date_text}</p>
                      <h3 className="text-base font-semibold mb-1">{item.title}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  <div className="hidden md:block flex-1" />
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
