import { useEffect, useState } from 'react';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { useSiteContent } from '@/hooks/useSiteContent';
import Header from '@/components/Header';
import Hero from '@/components/Hero';
import Features from '@/components/Features';
import Screenshots from '@/components/Screenshots';
import Roadmap from '@/components/Roadmap';
import Download from '@/components/Download';
import Docs from '@/components/Docs';
import FAQ from '@/components/FAQ';
import Footer from '@/components/Footer';
import AdminPanel from '@/components/AdminPanel';
import TelegramMiniApp from '@/components/tma/TelegramMiniApp';
import { isRunningInMax, isRunningInTelegram } from '@/lib/telegram';

// Telegram and MAX append launch data to the hash (e.g. tgWebAppPlatform=tdesktop); only our own part may force the site.
function forcesDesktop(): boolean {
  const own = window.location.hash.toLowerCase().split('webapp')[0];
  const search = window.location.search.toLowerCase();
  return own.includes('site') || own.includes('desktop') || search.includes('site') || search.includes('desktop');
}

function App() {
  const content = useSiteContent();
  const [isTmaMode, setIsTmaMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    const hash = window.location.hash.toLowerCase();
    const search = window.location.search.toLowerCase();
    const pathname = window.location.pathname.toLowerCase();
    
    // Проверяем параметры в URL для перехода в режим приложения (Telegram, MAX или веб-приложение)
    const hasMiniAppInUrl = 
      hash.includes('app') ||
      hash.includes('max') ||
      hash.includes('tg') || 
      search.includes('app') ||
      search.includes('max') ||
      search.includes('tg') || 
      search.includes('telegram') ||
      pathname.includes('/app') ||
      pathname.includes('/max') ||
      pathname.includes('/tg');

    // Проверяем Telegram WebApp окружение
    const isTg = isRunningInTelegram() || /Telegram/i.test(navigator.userAgent);

    // Проверяем MAX WebApp окружение
    const isMax = isRunningInMax();

    // На смартфонах и планшетах открываем Mini App интерфейс LogBook по умолчанию
    const isMobileDevice = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth <= 768;
    const forceDesktop = forcesDesktop();

    return (hasMiniAppInUrl || isTg || isMax || isMobileDevice) && !forceDesktop;
  });

  useEffect(() => {
    const checkMiniApp = () => {
      const hash = window.location.hash.toLowerCase();
      const search = window.location.search.toLowerCase();
      const pathname = window.location.pathname.toLowerCase();
      const forceDesktop = forcesDesktop();

      const hasMiniAppInUrl = 
        hash.includes('app') ||
        hash.includes('max') ||
        hash.includes('tg') || 
        search.includes('app') ||
        search.includes('max') ||
        search.includes('tg') ||
        pathname.includes('/app') ||
        pathname.includes('/max') ||
        pathname.includes('/tg');

      const isMobileDevice = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth <= 768;

      if (!forceDesktop && (hasMiniAppInUrl || isRunningInTelegram() || isRunningInMax() || isMobileDevice)) {
        setIsTmaMode(true);
      } else if (forceDesktop) {
        setIsTmaMode(false);
      }
    };

    checkMiniApp();
    const timer = setTimeout(checkMiniApp, 200);

    const handleHash = () => {
      checkMiniApp();
    };
    window.addEventListener('hashchange', handleHash);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('hashchange', handleHash);
    };
  }, []);

  if (isTmaMode) {
    return (
      <ThemeProvider>
        <AuthProvider>
          <TelegramMiniApp />
        </AuthProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <div className="min-h-screen bg-[#F5F5F5] dark:bg-[#1E1E1E] transition-colors duration-300">
          <Header />
          <main>
            <Hero />
            <Features
              features={content.features}
              loading={content.loading}
              error={content.error}
            />
            <Screenshots
              screenshots={content.screenshots}
              loading={content.loading}
              error={content.error}
            />
            <Roadmap
              roadmap={content.roadmap}
              loading={false}
              error={null}
            />
            <Download />
            <Docs />
            <FAQ
              faq={content.faq}
              loading={false}
              error={null}
            />
          </main>
          <Footer />
          <AdminPanel />
        </div>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
