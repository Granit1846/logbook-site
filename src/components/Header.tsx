import { useEffect, useState } from 'react';
import { Plane, Menu, X, Download, Send, Github } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

const navLinks = [
  { href: '#features', label: 'Возможности' },
  { href: '#screenshots', label: 'Скриншоты' },
  { href: '#roadmap', label: 'Дорожная карта' },
  { href: '#download', label: 'Скачать' },
  { href: '#docs', label: 'Документация' },
];

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/90 dark:bg-[#1E1E1E]/90 backdrop-blur-md shadow-sm'
          : 'bg-transparent'
      }`}
    >
      <div className="container-page">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <a href="#hero" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
              <Plane className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">Logbook</span>
          </a>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300
                  hover:text-accent dark:hover:text-accent-300 rounded-md
                  transition-colors duration-200"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <a
              href="https://t.me/my_logbook_app_bot"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold
                bg-[#2AABEE]/10 hover:bg-[#2AABEE]/20 text-[#2AABEE] dark:bg-[#2AABEE]/20 dark:hover:bg-[#2AABEE]/30
                border border-[#2AABEE]/30 rounded-lg transition-colors"
              title="Открыть Telegram Mini App и бот"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Telegram Бот</span>
            </a>
            <a
              href="https://github.com/Granit1846/LogBook-Android"
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-600 dark:text-gray-300
                hover:bg-gray-200 dark:hover:bg-[#2D2D2D] transition-colors"
              title="Репозиторий на GitHub"
            >
              <Github className="w-4 h-4" />
            </a>
            <ThemeToggle />
            <a
              href="#download"
              className="hidden sm:flex items-center gap-2 px-4 py-2 text-sm font-semibold
                bg-accent text-white rounded-md hover:bg-accent-600
                transition-colors duration-200 shadow-sm"
            >
              <Download className="w-4 h-4" />
              Скачать
            </a>
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="md:hidden w-10 h-10 rounded-lg flex items-center justify-center
                bg-gray-200 dark:bg-[#2D2D2D]"
              aria-label="Меню"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <nav className="md:hidden pb-4 flex flex-col gap-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300
                  hover:text-accent dark:hover:text-accent-300 rounded-md
                  transition-colors duration-200"
              >
                {link.label}
              </a>
            ))}
            <a
              href="https://t.me/my_logbook_app_bot"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMobileOpen(false)}
              className="mt-2 flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold
                bg-[#2AABEE] text-white rounded-md"
            >
              <Send className="w-4 h-4" />
              Telegram Бот & Mini App
            </a>
            <a
              href="#download"
              onClick={() => setMobileOpen(false)}
              className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold
                bg-accent text-white rounded-md"
            >
              <Download className="w-4 h-4" />
              Скачать приложения
            </a>
          </nav>
        )}
      </div>
    </header>
  );
}
