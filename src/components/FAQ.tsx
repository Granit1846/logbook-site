import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Loader2 } from 'lucide-react';
import type { FaqRow } from '@/lib/types';

interface FAQProps {
  faq: FaqRow[];
  loading: boolean;
  error: string | null;
}

export default function FAQ({ faq, loading, error }: FAQProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="py-20 md:py-24 bg-gray-100 dark:bg-[#252525]">
      <div className="container-page">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Частые вопросы
          </h2>
          <p className="text-base text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Ответы на наиболее популярные вопросы о программе Logbook
          </p>
        </motion.div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 text-accent animate-spin" />
          </div>
        ) : error ? (
          <p className="text-center text-red-500 py-20">{error}</p>
        ) : (
          <div className="max-w-3xl mx-auto space-y-3">
            {faq.map((item, index) => {
              const isOpen = openIndex === index;
              return (
                <div
                  key={item.id}
                  className="bg-white dark:bg-[#2D2D2D] rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
                >
                  <button
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                    className="flex items-center justify-between w-full px-5 py-4 text-left
                      hover:bg-gray-50 dark:hover:bg-[#333] transition-colors duration-200"
                    aria-expanded={isOpen}
                  >
                    <span className="text-base font-semibold pr-4">
                      {item.question}
                    </span>
                    <ChevronDown
                      className={`w-5 h-5 flex-shrink-0 text-accent transition-transform duration-200 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <p className="px-5 pb-4 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                          {item.answer}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
