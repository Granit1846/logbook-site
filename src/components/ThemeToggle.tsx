import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? 'Включить светлую тему' : 'Включить тёмную тему'}
      className="relative w-10 h-10 rounded-lg flex items-center justify-center
        bg-gray-200 dark:bg-[#2D2D2D] hover:bg-accent-100 dark:hover:bg-accent-700
        transition-colors duration-200"
    >
      <Sun
        className={`absolute w-5 h-5 text-warm-500 transition-all duration-300 ${
          isDark ? 'opacity-0 rotate-90 scale-0' : 'opacity-100 rotate-0 scale-100'
        }`}
      />
      <Moon
        className={`absolute w-5 h-5 text-accent-300 transition-all duration-300 ${
          isDark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-0'
        }`}
      />
    </button>
  );
}
