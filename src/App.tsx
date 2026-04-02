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
  const [loginError, setLoginError] = useState<string | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [loginMode, setLoginMode] = useState<'agent' | 'admin' | null>(null);

  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString() + '-' + Math.random().toString(36).substring(2, 9);
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
          
          // Enforce login mode separation
          if (loginMode === 'admin' && userRole !== 'admin') {
            await logout();
            setLoginError('Access denied. This portal is for administrators only.');
            setUser(null);
            setRole(null);
            return;
          }

          if (status !== 'approved' && userData?.role !== 'admin') {
            await logout();
            setLoginError('Your account is pending admin approval.');
            setUser(null);
            setRole(null);
          } else {
            console.log("Login successful. User Role:", userRole);
            setUser(currentUser);
            setRole(userRole as 'agent' | 'admin');
            setCurrentView(userRole === 'admin' ? 'admin' : 'dashboard');
            setLoginError(null);
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
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dot-pattern">
        <Loader2 className="w-10 h-10 animate-spin text-brand" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex bg-white font-sans selection:bg-brand/10 selection:text-brand overflow-hidden">
        {/* Left Side - Visual/Branding */}
        <div className="hidden lg:flex w-1/2 bg-slate-950 relative overflow-hidden items-center justify-center">
          <div className="absolute inset-0">
            <img 
              src="https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?q=80&w=2070&auto=format&fit=crop" 
              alt="Finance" 
              className="w-full h-full object-cover opacity-20 grayscale"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900/90 to-slate-950" />
            
            {/* Animated Background Elements */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
              <motion.div 
                animate={{ 
                  scale: [1, 1.2, 1],
                  opacity: [0.1, 0.2, 0.1],
                  rotate: [0, 90, 0]
                }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="absolute -top-1/4 -left-1/4 w-full h-full bg-brand/20 rounded-full blur-[120px]"
              />
              <motion.div 
                animate={{ 
                  scale: [1, 1.3, 1],
                  opacity: [0.05, 0.15, 0.05],
                  rotate: [0, -90, 0]
                }}
                transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                className="absolute -bottom-1/4 -right-1/4 w-full h-full bg-gold/20 rounded-full blur-[120px]"
              />
            </div>
          </div>
          
          <div className="relative z-10 max-w-lg px-12">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.8, ease: "backOut" }}
              className={`w-24 h-24 rounded-[2rem] flex items-center justify-center mb-12 shadow-2xl transition-all duration-700 ${
                loginMode === 'admin' 
                  ? 'bg-gradient-to-br from-admin to-admin-dark shadow-admin/40' 
                  : 'bg-gradient-to-br from-brand to-brand-dark shadow-brand/40'
              }`}
            >
              {loginMode === 'admin' ? <ShieldCheck className="w-12 h-12 text-white" /> : <Building2 className="w-12 h-12 text-white" />}
            </motion.div>
            <motion.h1 
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.8, ease: "easeOut" }}
              className="text-7xl font-black text-white mb-8 leading-[0.95] tracking-tighter"
            >
              {loginMode === 'admin' ? 'Administrator' : 'Agent'} Portal <br />
              <span className={`bg-clip-text text-transparent bg-gradient-to-r ${
                loginMode === 'admin' ? 'from-admin-light via-indigo-300 to-white' : 'from-brand via-red-400 to-gold'
              }`}>Dept of Post</span>
            </motion.h1>
            <motion.p 
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }}
              className="text-slate-400 text-xl mb-12 leading-relaxed font-light max-w-md"
            >
              {loginMode === 'admin' 
                ? 'Advanced administrative dashboard for oversight, approvals, and system-wide RD operations.'
                : 'Professional-grade platform for efficient RD account management and batch processing.'}
            </motion.p>
            
            <div className="grid grid-cols-1 gap-8">
              <motion.div 
                initial={{ x: -30, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.8 }}
                className="flex items-center gap-6 group"
              >
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur-md group-hover:bg-white/10 transition-all duration-500 group-hover:scale-110">
                  <ShieldCheck className={`w-7 h-7 ${loginMode === 'admin' ? 'text-admin' : 'text-brand'}`} />
                </div>
                <div>
                  <h4 className="text-white font-black text-xs uppercase tracking-[0.2em]">Secure Access</h4>
                  <p className="text-slate-500 text-sm font-medium">Enterprise-grade encryption</p>
                </div>
              </motion.div>
              <motion.div 
                initial={{ x: -30, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.8 }}
                className="flex items-center gap-6 group"
              >
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur-md group-hover:bg-white/10 transition-all duration-500 group-hover:scale-110">
                  <Zap className={`w-7 h-7 ${loginMode === 'admin' ? 'text-admin-light' : 'text-gold'}`} />
                </div>
                <div>
                  <h4 className="text-white font-black text-xs uppercase tracking-[0.2em]">Real-time Sync</h4>
                  <p className="text-slate-500 text-sm font-medium">Instant data processing</p>
                </div>
              </motion.div>
            </div>
          </div>
        </div>

        {/* Right Side - Login */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 lg:p-24 bg-white relative dot-pattern overflow-y-auto">
          <div className="w-full max-w-md relative z-10">
            <div className="flex items-center justify-between mb-12">
              <div className="flex items-center gap-3">
                <img src="/India-Post-Payments-Bank-Color.png" alt="India Post" className="h-10 w-auto" />
                <div className="h-8 w-px bg-slate-200" />
                <img src="/pngwing.com.png" alt="G20" className="h-10 w-auto" />
              </div>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg transition-colors duration-500 ${
                loginMode === 'admin' ? 'bg-admin shadow-admin/20' : 'bg-brand shadow-brand/20'
              }`}>
                {loginMode === 'admin' ? <ShieldCheck className="w-5 h-5 text-white" /> : <Building2 className="w-5 h-5 text-white" />}
              </div>
            </div>
            
            {loginMode === null ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="space-y-8"
              >
                <div className="mb-12">
                  <h2 className="text-6xl font-black mb-4 tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-500">
                    Welcome to the Portal
                  </h2>
                  <p className="text-slate-500 font-medium text-xl">
                    Select your access level to begin.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  <button
                    onClick={() => setLoginMode('agent')}
                    className="group relative p-8 bg-white border border-slate-100 rounded-[2.5rem] transition-all duration-500 text-left hover:border-brand/20 hover:shadow-brand overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-brand/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700" />
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-gold/5 rounded-full -ml-12 -mb-12 group-hover:scale-150 transition-transform duration-700 delay-75" />
                    
                    <div className="relative z-10">
                      <div className="w-16 h-16 bg-slate-50 group-hover:bg-brand/10 rounded-2xl flex items-center justify-center mb-6 transition-all duration-500 group-hover:rotate-6 group-hover:shadow-brand">
                        <Building2 className="w-8 h-8 text-slate-500 group-hover:text-brand" />
                      </div>
                      <h3 className="text-3xl font-black mb-2 bg-clip-text text-transparent bg-gradient-to-r from-brand via-red-500 to-gold group-hover:scale-105 transition-transform duration-500 origin-left tracking-tight">Agent Portal</h3>
                      <p className="text-slate-600 text-base group-hover:text-slate-700 transition-colors font-medium leading-relaxed">Professional RD management and list preparation tools.</p>
                    </div>
                  </button>

                  <button
                    onClick={() => setLoginMode('admin')}
                    className="group relative p-8 bg-white border border-slate-100 rounded-[2.5rem] transition-all duration-500 text-left hover:border-admin/20 hover:shadow-admin overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-admin/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700" />
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-indigo-100/10 rounded-full -ml-12 -mb-12 group-hover:scale-150 transition-transform duration-700 delay-75" />
                    
                    <div className="relative z-10">
                      <div className="w-16 h-16 bg-slate-50 group-hover:bg-admin/10 rounded-2xl flex items-center justify-center mb-6 transition-all duration-500 group-hover:rotate-6 group-hover:shadow-admin">
                        <ShieldCheck className="w-8 h-8 text-slate-500 group-hover:text-admin" />
                      </div>
                      <h3 className="text-3xl font-black mb-2 bg-clip-text text-transparent bg-gradient-to-r from-admin via-indigo-500 to-indigo-300 group-hover:scale-105 transition-transform duration-500 origin-left tracking-tight">Admin Control</h3>
                      <p className="text-slate-600 text-base group-hover:text-slate-700 transition-colors font-medium leading-relaxed">Manage users, system-wide approvals, and security settings.</p>
                    </div>
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
              >
                <button 
                  onClick={() => {
                    setLoginMode(null);
                    setLoginError(null);
                  }}
                  className={`flex items-center gap-2 transition-colors mb-8 group ${
                    loginMode === 'admin' ? 'text-admin/60 hover:text-admin' : 'text-brand/60 hover:text-brand'
                  }`}
                >
                  <X className="w-4 h-4 group-hover:rotate-90 transition-transform" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">Back to Selection</span>
                </button>

                <h2 className={`text-6xl font-black mb-4 tracking-tighter transition-all duration-700 bg-clip-text text-transparent bg-gradient-to-r ${
                  loginMode === 'admin' ? 'from-admin to-indigo-400' : 'from-brand via-red-500 to-gold'
                }`}>
                  {loginMode === 'admin' ? 'Admin Login' : 'Agent Login'}
                </h2>
                <p className={`mb-12 font-light text-xl transition-colors duration-700 ${
                  loginMode === 'admin' ? 'text-indigo-600/70' : 'text-slate-600'
                }`}>
                  {loginMode === 'admin' 
                    ? 'Authorized personnel only. Access is monitored.'
                    : 'Secure gateway for official Dept of Post agents.'}
                </p>
                
                <AnimatePresence>
                  {loginError && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className={`border rounded-2xl p-6 mb-8 shadow-premium ${
                        loginMode === 'admin' ? 'bg-indigo-50 border-indigo-100' : 'bg-red-50 border-red-100'
                      }`}
                    >
                      <div className="flex items-start gap-4 mb-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          loginMode === 'admin' ? 'bg-admin/10 text-admin' : 'bg-brand/10 text-brand'
                        }`}>
                          <ShieldAlert className="w-6 h-6" />
                        </div>
                        <div>
                          <p className={`text-sm font-black uppercase tracking-widest mb-1 ${
                            loginMode === 'admin' ? 'text-admin' : 'text-brand'
                          }`}>Access Error</p>
                          <p className={`text-sm font-medium ${
                            loginMode === 'admin' ? 'text-indigo-900' : 'text-red-900'
                          }`}>{loginError}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setLoginError(null)}
                        className={`text-xs font-black uppercase tracking-[0.2em] hover:underline ${
                          loginMode === 'admin' ? 'text-admin' : 'text-brand'
                        }`}
                      >
                        Dismiss Notification
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

            <div className={`border rounded-[2.5rem] p-8 mb-12 transition-all duration-700 shadow-inner-light ${
              loginMode === 'admin' ? 'bg-indigo-50/40 border-indigo-100/50' : 'bg-gold-light/20 border-gold/10'
            }`}>
              <p className="text-slate-700 text-sm leading-relaxed">
                <span className={`font-black uppercase text-[10px] tracking-[0.3em] block mb-3 ${
                  loginMode === 'admin' ? 'text-admin' : 'text-brand'
                }`}>Important Notice</span>
                {loginMode === 'admin' 
                  ? 'System maintenance scheduled for every Sunday at 12:00 AM. Please ensure all approvals are processed.'
                  : <>Agents must link mobile numbers to RD accounts by <span className="font-bold text-brand underline decoration-brand/30 underline-offset-4">01/08/2024</span> to continue list preparation.</>}
              </p>
            </div>

                <div className="space-y-6">
                  <button
                    onClick={loginWithGoogle}
                    className={`w-full bg-white border border-slate-200 text-slate-900 font-black py-6 px-8 rounded-[2rem] transition-all duration-500 flex items-center justify-center gap-6 shadow-premium hover:shadow-premium-hover hover-lift group ${
                      loginMode === 'admin' ? 'hover:border-admin/40' : 'hover:border-brand/40'
                    }`}
                  >
                    <div className="relative flex items-center justify-center gap-6">
                      <svg className="w-8 h-8 group-hover:scale-110 transition-transform duration-500" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                      <span className={`text-xl font-black bg-clip-text text-transparent bg-gradient-to-r transition-all duration-500 ${
                        loginMode === 'admin' ? 'from-admin to-indigo-400' : 'from-brand via-red-500 to-gold'
                      }`}>Continue with Google</span>
                    </div>
                  </button>
                </div>
              </motion.div>
            )}

            <div className="mt-16 text-center border-t border-slate-100 pt-8">
              <p className={`text-[10px] uppercase tracking-[0.3em] font-black transition-colors duration-500 ${
                loginMode === 'admin' ? 'text-admin/40' : loginMode === 'agent' ? 'text-brand/40' : 'text-slate-300'
              }`}>
                Official Department of Post Portal
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fcfcfc] font-sans pb-20 md:pb-0 bg-mesh">
      <nav className="bg-white/80 backdrop-blur-xl border-b border-slate-100 sticky top-0 z-30 no-select shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Top Row: Branding & User Profile */}
          <div className="flex justify-between h-24 items-center">
            <div className="flex items-center gap-6 sm:gap-10">
              <div className="flex items-center gap-4 sm:gap-6">
                <img 
                  src="/India-Post-Payments-Bank-Color.png" 
                  alt="IPPB" 
                  className="h-12 sm:h-14 w-auto drop-shadow-sm" 
                  referrerPolicy="no-referrer"
                />
                <div className="h-10 w-px bg-slate-100 hidden sm:block" />
                <img 
                  src="/pngwing.com.png" 
                  alt="G20" 
                  className="h-12 sm:h-14 w-auto drop-shadow-sm" 
                  referrerPolicy="no-referrer"
                />
              </div>
              
              <div className="h-12 w-px bg-slate-200 hidden lg:block" />
              
              <div className="hidden lg:flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-500 ${
                  role === 'admin' ? 'bg-gradient-to-br from-admin to-admin-dark shadow-admin/20' : 'bg-gradient-to-br from-brand to-brand-dark shadow-brand/20'
                }`}>
                  {role === 'admin' ? <ShieldCheck className="w-6 h-6 text-white" /> : <Building2 className="w-6 h-6 text-white" />}
                </div>
                <div className="flex flex-col">
                  <span className="font-black text-slate-900 text-base leading-tight tracking-tight uppercase">
                    {role === 'admin' ? 'Admin Control' : 'Agent Portal'}
                  </span>
                  <span className={`text-[11px] font-black uppercase tracking-[0.3em] bg-clip-text text-transparent bg-gradient-to-r ${
                    role === 'admin' ? 'from-admin to-indigo-400' : 'from-brand to-gold'
                  }`}>Dept of Post</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 sm:gap-8">
              <div className="hidden sm:flex items-center gap-5">
                <div className="flex flex-col items-end">
                  <span className="text-base font-black text-slate-900 tracking-tight">{user.displayName || 'Agent'}</span>
                  <span className={`text-[10px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-md ${
                    role === 'admin' ? 'bg-admin/10 text-admin' : 'bg-brand/10 text-brand'
                  }`}>{role}</span>
                </div>
                <div className={`w-12 h-12 rounded-2xl text-white flex items-center justify-center font-black text-lg shadow-lg ${
                  role === 'admin' ? 'bg-admin shadow-admin/20' : 'bg-brand shadow-brand/20'
                }`}>
                  {user.displayName ? user.displayName.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase()}
                </div>
              </div>
              <div className="h-10 w-px bg-slate-200 hidden sm:block" />
              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="p-3 text-slate-400 hover:text-brand hover:bg-brand/5 rounded-2xl transition-all duration-300 hover:rotate-12"
                title="Sign out"
              >
                <LogOut className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Bottom Row: Desktop Navigation Menu */}
          <div className="hidden md:flex h-16 items-center gap-3 border-t border-slate-50">
            {role === 'admin' && (
              <button
                onClick={() => setCurrentView('admin')}
                className={`px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all duration-500 flex items-center gap-3 group ${
                  currentView === 'admin' 
                    ? 'bg-slate-900 text-white shadow-premium-hover' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-admin'
                }`}
              >
                <ShieldCheck className={`w-4 h-4 transition-colors ${currentView === 'admin' ? 'text-admin-light' : 'group-hover:text-admin'}`} />
                Admin
              </button>
            )}
            <button
              onClick={() => setCurrentView('dashboard')}
              className={`px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all duration-500 flex items-center gap-3 group ${
                currentView === 'dashboard' 
                  ? 'bg-slate-900 text-white shadow-premium-hover' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-brand'
              }`}
            >
              <LayoutDashboard className={`w-4 h-4 transition-colors ${currentView === 'dashboard' ? 'text-brand' : 'group-hover:text-brand'}`} />
              Dashboard
            </button>
            <button
              onClick={() => setCurrentView('collections')}
              className={`px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all duration-500 flex items-center gap-3 group ${
                currentView === 'collections' 
                  ? 'bg-slate-900 text-white shadow-premium-hover' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-brand'
              }`}
            >
              <Wallet className={`w-4 h-4 transition-colors ${currentView === 'collections' ? 'text-brand' : 'group-hover:text-brand'}`} />
              Collections
            </button>
            <button
              onClick={() => setCurrentView('converter')}
              className={`px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all duration-500 flex items-center gap-3 group ${
                currentView === 'converter' 
                  ? 'bg-slate-900 text-white shadow-premium-hover' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-brand'
              }`}
            >
              <FileType className={`w-4 h-4 transition-colors ${currentView === 'converter' ? 'text-brand' : 'group-hover:text-brand'}`} />
              Converter
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-2xl border-t border-slate-100 z-50 px-8 py-4 flex items-center justify-between shadow-[0_-8px_30px_rgba(0,0,0,0.08)] pb-[calc(16px+env(safe-area-inset-bottom))] no-select">
        <button
          onClick={() => setCurrentView('dashboard')}
          className={`flex flex-col items-center gap-2 transition-all duration-500 ${
            currentView === 'dashboard' ? 'text-brand scale-110' : 'text-slate-300 hover:text-brand/50'
          }`}
        >
          <div className={`p-2.5 rounded-2xl transition-all duration-500 ${currentView === 'dashboard' ? 'bg-brand/10 shadow-brand' : ''}`}>
            <LayoutDashboard className="w-7 h-7" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">Home</span>
        </button>
        
        <button
          onClick={() => setCurrentView('collections')}
          className={`flex flex-col items-center gap-2 transition-all duration-500 ${
            currentView === 'collections' ? 'text-brand scale-110' : 'text-slate-300 hover:text-brand/50'
          }`}
        >
          <div className={`p-2.5 rounded-2xl transition-all duration-500 ${currentView === 'collections' ? 'bg-brand/10 shadow-brand' : ''}`}>
            <Wallet className="w-7 h-7" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">Collect</span>
        </button>

        <button
          onClick={() => setCurrentView('converter')}
          className={`flex flex-col items-center gap-2 transition-all duration-500 ${
            currentView === 'converter' ? 'text-brand scale-110' : 'text-slate-300 hover:text-brand/50'
          }`}
        >
          <div className={`p-2.5 rounded-2xl transition-all duration-500 ${currentView === 'converter' ? 'bg-brand/10 shadow-brand' : ''}`}>
            <FileType className="w-7 h-7" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">Convert</span>
        </button>

        {role === 'admin' && (
          <button
            onClick={() => setCurrentView('admin')}
            className={`flex flex-col items-center gap-2 transition-all duration-500 ${
              currentView === 'admin' ? 'text-admin scale-110' : 'text-slate-300 hover:text-admin/50'
            }`}
          >
            <div className={`p-2.5 rounded-2xl transition-all duration-500 ${currentView === 'admin' ? 'bg-admin/10 shadow-admin' : ''}`}>
              <ShieldCheck className="w-7 h-7" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Admin</span>
          </button>
        )}

        <button
          onClick={() => setShowLogoutConfirm(true)}
          className="flex flex-col items-center gap-2 text-slate-300 hover:text-brand transition-colors"
        >
          <div className="p-2.5">
            <LogOut className="w-7 h-7" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">Exit</span>
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
      <div className="fixed bottom-24 md:bottom-6 right-4 md:right-6 z-50 flex flex-col gap-3 pointer-events-none">
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
