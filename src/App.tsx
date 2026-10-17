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
    const tg = window.Telegram?.WebApp;
    const isTgBrowser = 
      /Telegram/i.test(navigator.userAgent) || 
      Boolean(tg?.initData) ||
      Boolean(tg?.initDataUnsafe?.user) ||
      Boolean(window.TelegramWebviewProxy) ||
      Boolean(tg?.platform && tg.platform !== 'unknown');

    return hasMiniAppInUrl || isTgBrowser;
  });

  useEffect(() => {
    const checkMiniApp = () => {
      const hash = window.location.hash.toLowerCase();
      const search = window.location.search.toLowerCase();
      const tg = window.Telegram?.WebApp;
      if (
        hash.includes('app') ||
        hash.includes('max') ||
        hash.includes('tg') ||
        search.includes('app') ||
        search.includes('max') ||
        search.includes('tg') ||
        Boolean(tg?.initData) ||
        Boolean(tg?.initDataUnsafe?.user) ||
        Boolean(tg?.platform && tg.platform !== 'unknown') ||
        Boolean(window.TelegramWebviewProxy)
      ) {
        setIsTmaMode(true);
      }
    };

    checkMiniApp();
    const timer = setTimeout(checkMiniApp, 200);

    const handleHash = () => {
      const h = window.location.hash.toLowerCase();
      if (h.includes('app') || h.includes('max') || h.includes('tg')) {
        setIsTmaMode(true);
      }
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
