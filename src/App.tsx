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
import { isRunningInTelegram } from '@/lib/telegram';

function App() {
  const content = useSiteContent();
  const [isTmaMode, setIsTmaMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    const url = new URL(window.location.href);
    const hash = window.location.hash;
    const search = window.location.search;
    
    // Проверяем Telegram WebApp напрямую
    const hasTgInUrl = 
      hash.includes('tg') || 
      search.includes('tg') || 
      search.includes('telegram') ||
      url.pathname.includes('/tg');

    // Проверяем Telegram User-Agent или наличие window.Telegram
    const isTgBrowser = 
      /Telegram/i.test(navigator.userAgent) || 
      Boolean((window as any).Telegram?.WebApp?.initData) ||
      Boolean((window as any).TelegramWebviewProxy);

    return hasTgInUrl || isTgBrowser;
  });

  useEffect(() => {
    const handleHash = () => {
      if (window.location.hash === '#tg') {
        setIsTmaMode(true);
      }
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
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
