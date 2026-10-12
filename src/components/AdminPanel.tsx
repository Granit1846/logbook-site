import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, LogOut, X, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import AdminFileStorage from '@/components/AdminFileStorage';

export default function AdminPanel() {
  const { user, isAdmin, loading, signIn, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setAuthError(null);
    const { error } = await signIn(email, password);
    if (error) {
      setAuthError(error);
    } else {
      setAuthError(null);
      setEmail('');
      setPassword('');
    }
    setSubmitting(false);
  };

  const handleSignOut = async () => {
    await signOut();
    setOpen(false);
  };

  // Admin trigger button (bottom-left, subtle)
  const triggerButton = (
    <button
      onClick={() => setOpen(true)}
      className="fixed bottom-4 left-4 z-40 w-10 h-10 rounded-full
        bg-gray-200 dark:bg-[#2D2D2D] hover:bg-accent hover:text-white
        flex items-center justify-center shadow-md
        transition-colors duration-200 opacity-30 hover:opacity-100"
      aria-label="Админ-панель"
      title="Админ-панель"
    >
      <Lock className="w-4 h-4" />
    </button>
  );

  return (
    <>
      {triggerButton}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-4xl max-h-[85vh] overflow-y-auto
                bg-[#F5F5F5] dark:bg-[#1E1E1E] rounded-lg shadow-2xl"
            >
              {/* Header bar */}
              <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4
                bg-white dark:bg-[#2D2D2D] border-b border-gray-200 dark:border-gray-700 rounded-t-lg">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Lock className="w-5 h-5 text-accent" />
                  Панель администратора
                </h2>
                <div className="flex items-center gap-2">
                  {user && (
                    <button
                      onClick={handleSignOut}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium
                        text-red-600 dark:text-red-400 rounded-md
                        hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-200"
                    >
                      <LogOut className="w-4 h-4" />
                      Выйти
                    </button>
                  )}
                  <button
                    onClick={() => setOpen(false)}
                    className="w-8 h-8 rounded-md flex items-center justify-center
                      hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                    aria-label="Закрыть"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                {loading ? (
                  <div className="flex justify-center py-20">
                    <Loader2 className="w-8 h-8 text-accent animate-spin" />
                  </div>
                ) : user ? (
                  isAdmin ? (
                    <AdminFileStorage />
                  ) : (
                    <div className="max-w-sm mx-auto py-8 text-center">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        У вас нет доступа к панели администратора.
                      </p>
                      <button
                        onClick={handleSignOut}
                        className="mt-4 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        Выйти
                      </button>
                    </div>
                  )
                ) : (
                  <form onSubmit={handleSignIn} className="max-w-sm mx-auto py-8">
                    <div className="text-center mb-6">
                      <div className="w-16 h-16 rounded-full bg-accent-50 dark:bg-accent-800/30
                        flex items-center justify-center mx-auto mb-4">
                        <Lock className="w-8 h-8 text-accent" />
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Войдите для доступа к файловому хранилищу
                      </p>
                    </div>

                    {authError && (
                      <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20
                        border border-red-200 dark:border-red-800">
                        <p className="text-sm text-red-600 dark:text-red-400">{authError}</p>
                      </div>
                    )}

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Email</label>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full px-4 py-2.5 text-sm rounded-md
                            bg-white dark:bg-[#2D2D2D] border border-gray-200 dark:border-gray-700
                            focus:border-accent focus:outline-none transition-colors duration-200"
                          placeholder="admin@logbook.app"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Пароль</label>
                        <input
                          type="password"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full px-4 py-2.5 text-sm rounded-md
                            bg-white dark:bg-[#2D2D2D] border border-gray-200 dark:border-gray-700
                            focus:border-accent focus:outline-none transition-colors duration-200"
                          placeholder="••••••••"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5
                          text-sm font-semibold bg-accent text-white rounded-md
                          hover:bg-accent-600 transition-colors duration-200
                          disabled:opacity-50"
                      >
                        {submitting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Lock className="w-4 h-4" />
                        )}
                        Войти
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
