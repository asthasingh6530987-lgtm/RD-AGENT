import { useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, loginWithGoogle, logout } from './firebase';
import Dashboard from './components/Dashboard';
import Converter from './components/Converter';
import AdminDashboard from './components/AdminDashboard';
import CollectionTracker from './components/CollectionTracker';
import ErrorBoundary from './components/ErrorBoundary';
import ConfirmationModal from './components/ConfirmationModal';
import { LogIn, Loader2, LayoutDashboard, FileType, Building2, ShieldCheck, Zap, LogOut, ShieldAlert, X, CheckCircle2, AlertCircle, Info, Wallet } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'agent' | 'admin' | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<'dashboard' | 'converter' | 'admin' | 'collections'>('dashboard');
  const [loginMode, setLoginMode] = useState<'agent' | 'admin'>('agent');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      removeToast(id);
    }, 5000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      if (currentUser) {
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          let userRole = 'agent';
          
          if (userDoc.exists()) {
            userRole = userDoc.data().role || 'agent';
            // If they are the default admin, ensure role is admin
            if (currentUser.email === 'asthasingh6530987@gmail.com' && currentUser.emailVerified && userRole !== 'admin') {
              userRole = 'admin';
              await updateDoc(userDocRef, { role: 'admin' });
            }
          } else {
            // Check if default admin
            if (currentUser.email === 'asthasingh6530987@gmail.com' && currentUser.emailVerified) {
              userRole = 'admin';
            }
            // Create user document
            const newUserDoc: any = {
              uid: currentUser.uid,
              email: currentUser.email,
              role: userRole,
              status: userRole === 'admin' ? 'approved' : 'pending',
              createdAt: serverTimestamp()
            };
            
            if (currentUser.displayName) {
              newUserDoc.name = currentUser.displayName;
            }

            await setDoc(userDocRef, newUserDoc);
          }

          // Check status
          const userData = (await getDoc(userDocRef)).data();
          const status = userData?.status || 'approved'; // Default to approved for existing users
          if (status !== 'approved' && userData?.role !== 'admin') {
            await logout();
            setLoginError('Your account is pending admin approval.');
            setUser(null);
            setRole(null);
          } else {
            // Check if login mode matches role
            console.log("Login Mode:", loginMode, "User Role:", userRole);
            if (loginMode === 'admin' && userRole !== 'admin') {
              console.log("Admin login failed: User is not an admin.");
              await logout();
              setLoginError('You do not have admin privileges.');
              setUser(null);
              setRole(null);
            } else {
              console.log("Login successful.");
              setUser(currentUser);
              setRole(userRole as 'agent' | 'admin');
              setCurrentView(userRole === 'admin' ? 'admin' : 'dashboard');
              setLoginError(null);
            }
          }
        } catch (error: any) {
          console.error("Error fetching user role:", error);
          if (error?.code === 'permission-denied') {
            setLoginError('Permission denied. Your account might not be fully set up or approved.');
          } else {
            setLoginError('Error verifying account. Please check your connection and try again.');
          }
          await logout();
          setUser(null);
          setRole(null);
        }
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [loginMode]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dot-pattern">
        <Loader2 className="w-10 h-10 animate-spin text-brand" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex bg-white font-sans selection:bg-brand/10 selection:text-brand">
        {/* Left Side - Visual/Branding */}
        <div className="hidden lg:flex w-1/2 bg-slate-950 relative overflow-hidden items-center justify-center">
          <div className="absolute inset-0">
            <img 
              src="https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?q=80&w=2070&auto=format&fit=crop" 
              alt="Finance" 
              className="w-full h-full object-cover opacity-20 grayscale"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
          </div>
          
          <div className="relative z-10 max-w-lg px-12">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="w-16 h-16 bg-brand rounded-2xl flex items-center justify-center mb-8 shadow-2xl shadow-brand/30"
            >
              <Building2 className="w-8 h-8 text-white" />
            </motion.div>
            <motion.h1 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="text-5xl font-bold text-white mb-6 leading-[1.1] tracking-tight"
            >
              Modern Agent Portal for <span className="text-brand">Dept of Post</span>
            </motion.h1>
            <motion.p 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="text-slate-400 text-lg mb-10 leading-relaxed font-light"
            >
              Streamline your RD account management, convert CSV files, and process batches with our secure, lightning-fast platform.
            </motion.p>
            
            <div className="space-y-5">
              <motion.div 
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="flex items-center gap-4 text-slate-300"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-brand" />
                </div>
                <span className="font-medium text-sm uppercase tracking-widest">Enterprise Security</span>
              </motion.div>
              <motion.div 
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.5 }}
                className="flex items-center gap-4 text-slate-300"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-gold" />
                </div>
                <span className="font-medium text-sm uppercase tracking-widest">Instant Processing</span>
              </motion.div>
            </div>
          </div>
        </div>

        {/* Right Side - Login */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 lg:p-24 bg-white relative dot-pattern">
          <div className="w-full max-w-md relative z-10">
            <div className="flex items-center justify-between mb-12">
              <div className="flex items-center gap-3">
                <img src="/India-Post-Payments-Bank-Color.png" alt="India Post" className="h-10 w-auto" />
                <div className="h-8 w-px bg-slate-200" />
                <img src="/pngwing.com.png" alt="G20" className="h-10 w-auto" />
              </div>
              <div className="w-10 h-10 bg-brand rounded-xl flex items-center justify-center shadow-lg shadow-brand/20">
                <Building2 className="w-5 h-5 text-white" />
              </div>
            </div>
            
            <div className="flex bg-slate-50 p-1.5 rounded-2xl mb-10 border border-slate-100">
              <button
                onClick={() => setLoginMode('agent')}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                  loginMode === 'agent' 
                    ? 'bg-white text-brand shadow-sm border border-slate-100' 
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                Agent
              </button>
              <button
                onClick={() => setLoginMode('admin')}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                  loginMode === 'admin' 
                    ? 'bg-white text-brand shadow-sm border border-slate-100' 
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                Admin
              </button>
            </div>

            <h2 className="text-4xl font-bold text-slate-900 mb-3 tracking-tight">
              {loginMode === 'admin' ? 'Admin Access' : 'Agent Portal'}
            </h2>
            <p className="text-slate-500 mb-10 font-light text-lg">
              {loginMode === 'admin' ? 'Secure administrative gateway.' : 'Manage your RD collections with ease.'}
            </p>
            
            <AnimatePresence>
              {loginError && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-red-50 border border-red-100 rounded-2xl p-4 mb-8"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <ShieldAlert className="w-5 h-5 text-brand flex-shrink-0 mt-0.5" />
                    <p className="text-red-900 text-sm font-medium">{loginError}</p>
                  </div>
                  <button 
                    onClick={() => {
                      setLoginError(null);
                      setLoading(true);
                      // Trigger a re-check of auth state
                      const currentUser = auth.currentUser;
                      if (currentUser) {
                        // Force a refresh by temporarily setting user to null then back
                        // or just wait for the next auth change. 
                        // Actually, just clearing the error and letting them click login again is best.
                        setLoading(false);
                      } else {
                        setLoading(false);
                      }
                    }}
                    className="text-xs font-bold text-brand uppercase tracking-widest hover:underline"
                  >
                    Try Again
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {loginMode === 'agent' && (
              <div className="bg-gold-light/30 border border-gold/10 rounded-2xl p-5 mb-10">
                <p className="text-slate-700 text-sm leading-relaxed">
                  <span className="font-bold text-brand uppercase text-[10px] tracking-widest block mb-1">Important Notice</span>
                  Agents must link mobile numbers to RD accounts by <span className="font-bold">01/08/2024</span> to continue list preparation.
                </p>
              </div>
            )}

            <div className="space-y-4">
              <button
                onClick={loginWithGoogle}
                className="w-full bg-white border border-slate-200 hover:border-brand/30 hover:bg-slate-50 text-slate-900 font-bold py-4 px-6 rounded-2xl transition-all duration-300 flex items-center justify-center gap-4 shadow-sm hover:shadow-xl hover-lift group"
              >
                <svg className="w-6 h-6 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>
            </div>

            <div className="mt-16 text-center border-t border-slate-100 pt-8">
              <p className="text-xs text-slate-400 uppercase tracking-widest font-medium">
                Official Department of Post Portal
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fcfcfc] font-sans pb-20 md:pb-0 dot-pattern">
      <nav className="bg-white/80 backdrop-blur-xl border-b border-slate-100 sticky top-0 z-30 no-select">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Top Row: Branding & User Profile */}
          <div className="flex justify-between h-20 items-center">
            <div className="flex items-center gap-4 sm:gap-8">
              <div className="flex items-center gap-3 sm:gap-5">
                <img 
                  src="/India-Post-Payments-Bank-Color.png" 
                  alt="IPPB" 
                  className="h-10 sm:h-12 w-auto" 
                  referrerPolicy="no-referrer"
                />
                <div className="h-8 w-px bg-slate-100 hidden sm:block" />
                <img 
                  src="/pngwing.com.png" 
                  alt="G20" 
                  className="h-10 sm:h-12 w-auto" 
                  referrerPolicy="no-referrer"
                />
              </div>
              
              <div className="h-10 w-px bg-slate-200 hidden lg:block" />
              
              <div className="hidden lg:flex items-center gap-3">
                <div className="w-10 h-10 bg-brand rounded-xl flex items-center justify-center shadow-lg shadow-brand/10">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <div className="flex flex-col">
                  <span className="font-black text-slate-900 text-sm leading-tight tracking-tight uppercase">Agent Portal</span>
                  <span className="text-[10px] font-bold text-brand uppercase tracking-[0.2em]">Dept of Post</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 sm:gap-6">
              <div className="hidden sm:flex items-center gap-4">
                <div className="flex flex-col items-end">
                  <span className="text-sm font-bold text-slate-900">{user.displayName || 'Agent'}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{role}</span>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-slate-50 text-slate-900 flex items-center justify-center font-black text-sm border border-slate-100 shadow-sm">
                  {user.displayName ? user.displayName.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase()}
                </div>
              </div>
              <div className="h-8 w-px bg-slate-200 hidden sm:block" />
              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="p-2.5 text-slate-400 hover:text-brand hover:bg-red-50 rounded-xl transition-all duration-200"
                title="Sign out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Bottom Row: Desktop Navigation Menu */}
          <div className="hidden md:flex h-14 items-center gap-2 border-t border-slate-50">
            {role === 'admin' && (
              <button
                onClick={() => setCurrentView('admin')}
                className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-2.5 ${
                  currentView === 'admin' 
                    ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/20' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                Admin
              </button>
            )}
            <button
              onClick={() => setCurrentView('dashboard')}
              className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-2.5 ${
                currentView === 'dashboard' 
                  ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/20' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </button>
            <button
              onClick={() => setCurrentView('collections')}
              className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-2.5 ${
                currentView === 'collections' 
                  ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/20' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Wallet className="w-4 h-4" />
              Collections
            </button>
            <button
              onClick={() => setCurrentView('converter')}
              className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-2.5 ${
                currentView === 'converter' 
                  ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/20' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <FileType className="w-4 h-4" />
              Converter
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-2xl border-t border-slate-100 z-50 px-8 py-4 flex items-center justify-between shadow-[0_-8px_30px_rgba(0,0,0,0.08)] pb-[calc(16px+env(safe-area-inset-bottom))] no-select">
        <button
          onClick={() => setCurrentView('dashboard')}
          className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${
            currentView === 'dashboard' ? 'text-brand scale-110' : 'text-slate-300'
          }`}
        >
          <LayoutDashboard className="w-6 h-6" />
          <span className="text-[9px] font-black uppercase tracking-[0.2em]">Home</span>
        </button>
        
        <button
          onClick={() => setCurrentView('collections')}
          className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${
            currentView === 'collections' ? 'text-brand scale-110' : 'text-slate-300'
          }`}
        >
          <Wallet className="w-6 h-6" />
          <span className="text-[9px] font-black uppercase tracking-[0.2em]">Collect</span>
        </button>

        <button
          onClick={() => setCurrentView('converter')}
          className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${
            currentView === 'converter' ? 'text-brand scale-110' : 'text-slate-300'
          }`}
        >
          <FileType className="w-6 h-6" />
          <span className="text-[9px] font-black uppercase tracking-[0.2em]">Convert</span>
        </button>

        {role === 'admin' && (
          <button
            onClick={() => setCurrentView('admin')}
            className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${
              currentView === 'admin' ? 'text-brand scale-110' : 'text-slate-300'
            }`}
          >
            <ShieldCheck className="w-6 h-6" />
            <span className="text-[9px] font-black uppercase tracking-[0.2em]">Admin</span>
          </button>
        )}

        <button
          onClick={() => setShowLogoutConfirm(true)}
          className="flex flex-col items-center gap-1.5 text-slate-300"
        >
          <LogOut className="w-6 h-6" />
          <span className="text-[9px] font-black uppercase tracking-[0.2em]">Exit</span>
        </button>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <motion.div
          key={currentView}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          {currentView === 'admin' ? (
            <AdminDashboard user={user} addToast={addToast} />
          ) : currentView === 'dashboard' ? (
            <Dashboard user={user} addToast={addToast} />
          ) : currentView === 'collections' ? (
            <CollectionTracker user={user} addToast={addToast} />
          ) : (
            <Converter />
          )}
        </motion.div>
      </main>

      <ConfirmationModal
        isOpen={showLogoutConfirm}
        title="Sign Out"
        message="Are you sure you want to sign out of the portal?"
        confirmText="Sign Out"
        type="info"
        onConfirm={async () => {
          await logout();
          setShowLogoutConfirm(false);
          addToast("Successfully signed out", "success");
        }}
        onCancel={() => setShowLogoutConfirm(false)}
      />

      {/* Global Toast Notifications */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 20, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.9 }}
              className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border min-w-[300px] max-w-md ${
                toast.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' :
                toast.type === 'error' ? 'bg-red-50 border-red-100 text-red-800' :
                'bg-blue-50 border-blue-100 text-blue-800'
              }`}
            >
              {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
              {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
              {toast.type === 'info' && <Info className="w-5 h-5 text-blue-500" />}
              <span className="flex-1 text-sm font-medium">{toast.message}</span>
              <button
                onClick={() => removeToast(toast.id)}
                className="p-1 hover:bg-black/5 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 opacity-50" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
