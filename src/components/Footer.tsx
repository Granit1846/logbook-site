import { Plane, Send, Github, Download } from 'lucide-react';

interface FooterLink {
  label: string;
  href: string;
  external?: boolean;
  download?: boolean;
}

interface FooterSection {
  title: string;
  links: FooterLink[];
}

const sections: FooterSection[] = [
  {
    title: 'Установка и загрузка',
    links: [
      { label: 'Скачать установщик Windows (.exe)', href: '/downloads/Logbook_Setup_1.1.15.exe', download: true },
      { label: 'Скачать Android APK (v1.1.30)', href: '/downloads/LogBook.apk', download: true },
      { label: 'Раздел загрузок', href: '#download' },
    ],
  },
  {
    title: 'Telegram & Облако',
    links: [
      { label: 'Telegram Бот @my_logbook_app_bot', href: 'https://t.me/my_logbook_app_bot', external: true },
      { label: 'Telegram Mini App (TMA)', href: 'https://t.me/my_logbook_app_bot', external: true },
      { label: 'Вход по одноразовому коду', href: '#docs' },
      { label: 'Wi-Fi синхронизация по QR', href: '#sync-guide' },
    ],
  },
  {
    title: 'Документация и код',
    links: [
      { label: 'Репозиторий LogBook-Android', href: 'https://github.com/Granit1846/LogBook-Android', external: true },
      { label: 'Репозиторий LogBook-PC', href: 'https://github.com/Granit1846/LogBook-PC', external: true },
      { label: 'Краткое руководство', href: '#docs' },
      { label: 'Частые вопросы (FAQ)', href: '#faq' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="bg-[#141414] text-gray-400 pt-16 pb-8 border-t border-gray-800">
      <div className="container-page">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-10 mb-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <a href="#hero" className="flex items-center gap-2.5 mb-4 text-xl font-bold text-white group">
              <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center group-hover:scale-105 transition-transform">
                <Plane className="w-5 h-5 text-white" />
              </div>
              <span>LogBook</span>
            </a>
            <p className="max-w-md text-sm leading-relaxed text-gray-400 mb-6">
              Экосистема ведения формуляров авиационной техники на Windows и Android.
              Полная офлайн-автономия, расчёт наработки агрегатов и мгновенный доступ через Telegram.
            </p>
            <div className="flex items-center gap-3">
              <a
                href="https://t.me/my_logbook_app_bot"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#2AABEE]/15 hover:bg-[#2AABEE]/25 text-[#2AABEE] border border-[#2AABEE]/30 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                @my_logbook_app_bot
              </a>
              <a
                href="https://github.com/Granit1846/LogBook-Android"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 transition-colors"
              >
                <Github className="w-3.5 h-3.5" />
                GitHub
              </a>
            </div>
          </div>

          {/* Navigation sections */}
          {sections.map((section) => (
            <div key={section.title}>
              <h3 className="font-semibold text-white text-sm tracking-wide mb-4 uppercase text-gray-300">
                {section.title}
              </h3>
              <ul className="space-y-2.5">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      target={link.external ? '_blank' : undefined}
                      rel={link.external ? 'noopener noreferrer' : undefined}
                      download={link.download ? true : undefined}
                      className="text-xs sm:text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1.5"
                    >
                      {link.download && <Download className="w-3 h-3 text-accent" />}
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-8 border-t border-gray-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500">
          <p>© {new Date().getFullYear()} LogBook. Все права защищены.</p>
          <p className="flex items-center gap-1">
            Windows 10/11 · Android 7.0+ · Telegram Mini App
          </p>
        </div>
      </div>
    </footer>
  );
}
