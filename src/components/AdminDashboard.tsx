import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { db } from '../firebase';
import { collection, getDocs, getDoc, setDoc, updateDoc, doc, deleteDoc, query, orderBy, where, serverTimestamp } from 'firebase/firestore';
import { auth } from '../firebase';
import { Bell, Send, Users, FileText, Database, Loader2, ShieldCheck, User as UserIcon, Trash2, Eye, Calendar, X, IndianRupee, CheckCircle2, Clock, AlertCircle, RefreshCw, Download, Zap, Globe, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmationModal from './ConfirmationModal';
import Papa from 'papaparse';
import { Account } from '../utils/batching';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface AdminDashboardProps {
  user: User;
  addToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

interface UserData {
  id: string;
  email: string;
  name: string;
  role: 'agent' | 'admin';
  status: 'pending' | 'approved' | 'rejected';
  lastActiveAt?: any;
}

interface UploadData {
  id: string;
  agentId: string;
  filename: string;
  totalAmount: number;
  totalAccounts: number;
  status: string;
  createdAt: any;
}

interface BatchData {
  id: string;
  uploadId: string;
  totalAmount: number;
  accountCount: number;
  status: string;
  batchNumber: number;
  referenceNumber?: string;
  createdAt: any;
  accounts: Account[];
}

export default function AdminDashboard({ user, addToast }: AdminDashboardProps) {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalUploads: 0,
    totalBatches: 0,
  });
  const [users, setUsers] = useState<UserData[]>([]);
  const [uploads, setUploads] = useState<UploadData[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string, type: 'user' | 'upload', name: string } | null>(null);
  const [selectedUpload, setSelectedUpload] = useState<UploadData | null>(null);
  const [uploadBatches, setUploadBatches] = useState<BatchData[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [activeAdminTab, setActiveAdminTab] = useState<'users' | 'uploads' | 'settings' | 'messages'>('users');
  
  // Tracking
  const [showActiveAgents, setShowActiveAgents] = useState(false);
  const [loginHistory, setLoginHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<string | null>(null);

  // Settings
  const [siteSettings, setSiteSettings] = useState<any>({
    aboutUsText: '',
    address: '',
    email: '',
    phone: '',
    whatsapp: '',
    youtube: '',
  });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  // Messages
  const [contactMessages, setContactMessages] = useState<any[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  useEffect(() => {
    if (activeAdminTab === 'settings') {
      const fetchSettings = async () => {
        setSettingsLoading(true);
        try {
          const docRef = doc(db, 'settings', 'general');
          const docSnap = await getDocs(query(collection(db, 'settings')));
          if (!docSnap.empty) {
             const data = docSnap.docs[0].data();
             setSiteSettings(data);
          } else {
             const gSnap = await getDoc(docRef);
             if (gSnap.exists()) {
               setSiteSettings(gSnap.data());
             }
          }
        } catch (error) {
          console.error("Error fetching settings:", error);
        } finally {
          setSettingsLoading(false);
        }
      };
      fetchSettings();
    } else if (activeAdminTab === 'messages') {
      const fetchMessages = async () => {
        setMessagesLoading(true);
        try {
          const q = query(collection(db, 'contact_messages'), orderBy('createdAt', 'desc'));
          const snap = await getDocs(q);
          setContactMessages(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (error) {
          console.error("Error fetching messages:", error);
        } finally {
          setMessagesLoading(false);
        }
      };
      fetchMessages();
    }
  }, [activeAdminTab]);

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'general'), {
        ...siteSettings,
        updatedAt: serverTimestamp()
      });
      addToast?.('Settings updated successfully', 'success');
    } catch (error) {
      console.error("Error saving settings:", error);
      handleFirestoreError(error, OperationType.WRITE, 'settings/general');
      addToast?.('Failed to save settings', 'error');
    } finally {
      setSettingsSaving(false);
    }
  };

  const markMessageRead = async (messageId: string) => {
    try {
      await updateDoc(doc(db, 'contact_messages', messageId), { status: 'read' });
      setContactMessages(prev => prev.map(m => m.id === messageId ? { ...m, status: 'read' } : m));
      addToast?.('Message marked as read', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'contact_messages');
    }
  };

  const activeUsersCount = users.filter(u => {
    if (!u.lastActiveAt) return false;
    const activeTime = u.lastActiveAt.toMillis ? u.lastActiveAt.toMillis() : u.lastActiveAt;
    return (Date.now() - activeTime) < 5 * 60 * 1000;
  }).length;
  
  const fetchLoginHistory = async () => {
    setLoadingHistory(true);
    try {
      // Query without limit to get full history, or limit(100) if it gets too large
      const q = query(collection(db, 'login_history'), orderBy('loginAt', 'desc'));
      const snap = await getDocs(q);
      setLoginHistory(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error fetching login history:", error);
      handleFirestoreError(error, OperationType.LIST, 'login_history');
    } finally {
      setLoadingHistory(false);
    }
  };
  
  const handleOpenTracking = () => {
    setShowActiveAgents(true);
    fetchLoginHistory();
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const uploadsQuery = query(collection(db, 'uploads'), orderBy('createdAt', 'desc'));
        const uploadsSnap = await getDocs(uploadsQuery);
        const batchesSnap = await getDocs(collection(db, 'batches'));
        
        setStats({
          totalUsers: usersSnap.size,
          totalUploads: uploadsSnap.size,
          totalBatches: batchesSnap.size,
        });

        const usersList = usersSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as UserData[];
        setUsers(usersList);

        const uploadsList = uploadsSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as UploadData[];
        setUploads(uploadsList);
      } catch (error) {
        console.error("Error fetching admin stats, users or uploads:", error);
        handleFirestoreError(error, OperationType.LIST, 'users/uploads/batches');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const toggleUserRole = async (userId: string, currentRole: 'agent' | 'admin') => {
    const newRole = currentRole === 'agent' ? 'admin' : 'agent';
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
      addToast?.(`User role updated to ${newRole}`, 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users/' + userId);
      addToast?.('Failed to update user role', 'error');
    }
  };

  const updateUserStatus = async (userId: string, newStatus: 'approved' | 'rejected') => {
    console.log("Updating user status:", userId, newStatus);
    try {
      await updateDoc(doc(db, 'users', userId), { status: newStatus });
      setUsers(users.map(u => u.id === userId ? { ...u, status: newStatus } : u));
      console.log("User status updated successfully");
      addToast?.(`User status updated to ${newStatus}`, 'success');
    } catch (error) {
      console.error("Error updating user status:", error);
      handleFirestoreError(error, OperationType.UPDATE, 'users/' + userId);
      addToast?.('Failed to update user status', 'error');
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      await deleteDoc(doc(db, 'users', userId));
      setUsers(users.filter(u => u.id !== userId));
      setStats(prev => ({ ...prev, totalUsers: prev.totalUsers - 1 }));
      setDeleteTarget(null);
      addToast?.('User deleted successfully', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'users/' + userId);
      addToast?.('Failed to delete user', 'error');
    }
  };

  const deleteUpload = async (uploadId: string) => {
    try {
      await deleteDoc(doc(db, 'uploads', uploadId));
      setUploads(uploads.filter(u => u.id !== uploadId));
      setStats(prev => ({ ...prev, totalUploads: prev.totalUploads - 1 }));
      setDeleteTarget(null);
      addToast?.('Upload deleted successfully', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'uploads/' + uploadId);
      addToast?.('Failed to delete upload', 'error');
    }
  };

  const viewUploadDetails = async (upload: UploadData) => {
    setSelectedUpload(upload);
    setLoadingBatches(true);
    try {
      const q = query(collection(db, 'batches'), where('uploadId', '==', upload.id), orderBy('batchNumber', 'asc'));
      const snap = await getDocs(q);
      const batches = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as BatchData[];
      setUploadBatches(batches);
    } catch (error) {
      console.error("Error fetching upload batches:", error);
    } finally {
      setLoadingBatches(false);
    }
  };

  const handleDownloadUpload = async (upload: UploadData) => {
    try {
      addToast?.('Preparing download...', 'info');
      
      // Fetch batches if not already selected or if we're downloading from the list
      let batchesToExport = uploadBatches;
      if (!selectedUpload || selectedUpload.id !== upload.id) {
        const q = query(collection(db, 'batches'), where('uploadId', '==', upload.id), orderBy('batchNumber', 'asc'));
        const snap = await getDocs(q);
        batchesToExport = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as BatchData[];
      }

      if (batchesToExport.length === 0) {
        addToast?.('No data found for this upload', 'error');
        return;
      }

      const csvData: any[] = [];
      batchesToExport.forEach(batch => {
        const batchRef = batch.referenceNumber || `Batch ${batch.batchNumber}`;
        batch.accounts.forEach(acc => {
          // Add normal string
          const formattedAccNo = acc.accountNo ? String(acc.accountNo) : '';
          
          csvData.push({
            'Batch Reference': batchRef,
            'Account No': formattedAccNo,
            'Account Name': acc.accountName || '',
            'Month Paid Upto': acc.monthPaidUpto || '',
            'Next RD Installment Due Date': acc.nextDueDate || '',
            'Amount': acc.amount
          });
        });
        
        // Add a total row for each batch
        csvData.push({
          'Batch Reference': batchRef,
          'Account No': 'TOTAL BATCH AMOUNT',
          'Account Name': '',
          'Month Paid Upto': '',
          'Next RD Installment Due Date': '',
          'Amount': batch.totalAmount
        });
        
        // Add empty row for separation
        csvData.push({});
      });

      const csv = Papa.unparse(csvData);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${upload.filename.replace('.csv', '')}_export.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      addToast?.('Download started', 'success');
    } catch (error) {
      console.error("Error downloading upload:", error);
      addToast?.('Failed to download upload', 'error');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-red-100 text-red-800 border-red-200';
      case 'processing': return 'bg-slate-100 text-slate-800 border-slate-200';
      case 'failed': return 'bg-red-50 text-red-900 border-red-100';
      default: return 'bg-amber-100 text-amber-800 border-amber-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-4 h-4" />;
      case 'processing': return <RefreshCw className="w-4 h-4 animate-spin" />;
      case 'failed': return <AlertCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-red-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8 font-sans">
      {/* Welcome & Header Section */}
      <div className="relative overflow-hidden bg-white rounded-[2.5rem] p-6 sm:p-10 border border-slate-100 shadow-sm glass-card">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-gold/5 rounded-full -ml-32 -mb-32 blur-3xl"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="px-3 py-1 bg-brand/10 text-brand text-[10px] font-black uppercase tracking-widest rounded-full">
                Admin Control Panel
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight mb-2">
              System <span className="text-brand">Overview</span>
            </h1>
            <p className="text-slate-500 text-lg max-w-xl">
              Monitor agent activity, manage user permissions, and oversee all batch processing across the platform.
            </p>
          </div>
          
          <div className="flex flex-col gap-3 w-full md:w-auto">
            <button 
              onClick={() => window.location.reload()}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all hover-lift shadow-lg shadow-slate-900/10 w-full md:w-auto"
            >
              <RefreshCw className="w-5 h-5" />
              Refresh Data
            </button>
            <a 
              href="https://dop-help.onrender.com/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-center text-sm font-bold text-slate-500 hover:text-brand transition-colors underline decoration-slate-300 hover:decoration-brand underline-offset-4 flex items-center justify-center gap-1"
            >
              DOP Help
              <Zap className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <motion.div 
          onClick={handleOpenTracking}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-premium glass-card relative overflow-hidden group hover:border-brand/20 transition-all cursor-pointer hover:shadow-xl hover:-translate-y-1"
          title="Click to view Active Agent Tracking"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Users className="w-16 h-16 text-brand" />
          </div>
          <p className="text-slate-600 font-bold text-sm uppercase tracking-wider mb-1">Total Agents</p>
          <h3 className="text-5xl font-black text-info mb-4 group-hover:text-info transition-colors">{stats.totalUsers}</h3>
          
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs bg-emerald-50 w-fit px-2.5 py-1 rounded-full">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Active System
            </div>
            <div className="flex items-center gap-2 text-brand font-black text-xs bg-brand/5 w-fit px-3 py-1 rounded-full shadow-sm border border-brand/10">
              <span className="w-2 h-2 rounded-full bg-brand animate-pulse"></span>
              {activeUsersCount} Active Now
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-premium glass-card relative overflow-hidden group hover:border-gold/20 transition-all"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <FileText className="w-16 h-16 text-gold" />
          </div>
          <p className="text-slate-600 font-bold text-sm uppercase tracking-wider mb-1">Total Uploads</p>
          <h3 className="text-5xl font-black text-success mb-4 group-hover:text-gold transition-colors">{stats.totalUploads}</h3>
          <div className="flex items-center gap-2 text-gold font-bold text-sm bg-gold/5 w-fit px-3 py-1 rounded-full">
            <Database className="w-4 h-4" />
            Data Processed
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-premium glass-card relative overflow-hidden group sm:col-span-2 lg:col-span-1 hover:border-brand/20 transition-all"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Database className="w-16 h-16 text-brand" />
          </div>
          <p className="text-slate-600 font-bold text-sm uppercase tracking-wider mb-1">Total Batches</p>
          <h3 className="text-5xl font-black text-info mb-4 group-hover:text-brand transition-colors">{stats.totalBatches}</h3>
          <div className="flex items-center gap-2 text-brand font-bold text-sm bg-brand/5 w-fit px-3 py-1 rounded-full">
            <Clock className="w-4 h-4" />
            Batch History
          </div>
        </motion.div>
      </div>
      
      <div className="flex bg-white rounded-[2rem] p-3 border border-slate-100 shadow-sm gap-2 mt-4 mx-auto w-fit overflow-x-auto">
        <button
          onClick={() => setActiveAdminTab('users')}
          className={`flex-none px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
            activeAdminTab === 'users' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          Agents
        </button>
        <button
          onClick={() => setActiveAdminTab('uploads')}
          className={`flex-none px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
            activeAdminTab === 'uploads' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          Uploads
        </button>
        <button
          onClick={() => setActiveAdminTab('settings')}
          className={`flex-none px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
            activeAdminTab === 'settings' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          Site Settings
        </button>
        <button
          onClick={() => setActiveAdminTab('messages')}
          className={`flex-none px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
            activeAdminTab === 'messages' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          Messages
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-8">
        {/* User Management */}
        <div className={`lg:col-span-5 space-y-6 ${activeAdminTab !== 'users' && activeAdminTab !== 'uploads' ? 'hidden' : activeAdminTab !== 'users' ? 'hidden lg:block' : ''}`}>
          <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 p-4 sm:p-8 glass-card">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Agents</h3>
                <p className="text-slate-600 text-xs font-bold uppercase tracking-widest mt-1">Manage system access and permissions</p>
              </div>
              <span className="text-xs font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                {users.length} Total
              </span>
            </div>
            
            <div className="space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
              {users.map((u) => (
                <div key={u.id} className="group p-5 bg-slate-50/50 rounded-2xl border border-slate-100 hover:border-brand/20 hover:bg-white transition-all duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-400 border border-slate-100 shadow-sm group-hover:text-brand transition-colors">
                        <UserIcon className="w-6 h-6" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-slate-900 truncate text-lg">{u.name || 'Unknown'}</p>
                        <p className="text-sm text-slate-500 truncate font-medium">{u.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setDeleteTarget({ id: u.id, type: 'user', name: u.name || u.email })}
                      className="p-2 text-slate-300 hover:text-brand hover:bg-brand/5 rounded-xl transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-100">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                        (u.status || 'pending') === 'approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                        (u.status || 'pending') === 'rejected' ? 'bg-brand/5 text-brand border-brand/10' :
                        'bg-gold/5 text-gold border-gold/10'
                      }`}>
                        {u.status || 'pending'}
                      </span>
                      <button
                        onClick={() => toggleUserRole(u.id, u.role)}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                          u.role === 'admin' 
                            ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/10' 
                            : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <ShieldCheck className="w-3 h-3" />
                        {u.role}
                      </button>
                    </div>

                    {(u.status || 'pending') === 'pending' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateUserStatus(u.id, 'approved')}
                          className="px-4 py-1.5 bg-brand text-white rounded-xl text-xs font-bold hover:bg-brand-dark transition-all shadow-lg shadow-brand/20"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => updateUserStatus(u.id, 'rejected')}
                          className="px-4 py-1.5 bg-white text-slate-600 border border-slate-200 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Upload Management */}
        <div className={`lg:col-span-7 space-y-6 ${activeAdminTab !== 'uploads' ? 'hidden lg:block' : ''}`}>
          <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 p-4 sm:p-8 glass-card">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-3">
                <div className="w-10 h-10 bg-brand/10 rounded-xl flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-brand" />
                </div>
                Recent Uploads
              </h3>
            </div>
            
            <div className="hidden md:block overflow-x-auto -mx-4 sm:-mx-8 px-4 sm:px-8 max-h-[600px] overflow-y-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80">
                    <th className="py-4 px-4 sm:px-8 text-[10px] font-black text-slate-600 uppercase tracking-widest">File & Agent</th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-600 uppercase tracking-widest text-center">Stats</th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-600 uppercase tracking-widest">Date</th>
                    <th className="py-4 px-4 sm:px-8 text-[10px] font-black text-slate-600 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {uploads.map((up) => {
                    const agent = users.find(u => u.id === up.agentId);
                    return (
                      <tr key={`${up.id}-desktop`} className="group hover:bg-slate-50/50 transition-all duration-300">
                        <td className="py-4 sm:py-5 px-4 sm:px-8">
                          <div className="flex items-center gap-3 sm:gap-4">
                            <div className="w-10 h-10 bg-white rounded-xl border border-slate-100 flex items-center justify-center text-slate-500 group-hover:text-brand transition-colors shadow-sm shrink-0">
                              <FileText className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 truncate group-hover:text-brand transition-colors">{up.filename}</p>
                              <p className="text-xs text-slate-600 flex items-center gap-1">
                                <UserIcon className="w-3 h-3" />
                                {agent?.name || 'Unknown Agent'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-5 px-4">
                          <div className="flex flex-col items-center gap-1">
                            <span className="font-mono text-success font-black text-sm">₹{up.totalAmount?.toLocaleString()}</span>
                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-tighter bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                              {up.totalAccounts} Accounts
                            </span>
                          </div>
                        </td>
                        <td className="py-5 px-4">
                          <div className="flex items-center gap-1.5 text-slate-600 text-xs font-bold">
                            <Calendar className="w-3.5 h-3.5 text-slate-600" />
                            {up.createdAt?.toDate ? up.createdAt.toDate().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'N/A'}
                          </div>
                        </td>
                        <td className="py-4 sm:py-5 px-4 sm:px-8 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => viewUploadDetails(up)}
                              className="p-2.5 text-slate-500 hover:text-brand hover:bg-brand/5 rounded-xl transition-all"
                              title="View Details"
                            >
                              <Eye className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleDownloadUpload(up)}
                              className="p-2.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                              title="Download CSV"
                            >
                              <Download className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => setDeleteTarget({ id: up.id, type: 'upload', name: up.filename })}
                              className="p-2.5 text-slate-500 hover:text-brand hover:bg-brand/5 rounded-xl transition-all"
                              title="Delete Upload"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {uploads.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-12 text-center">
                        <div className="flex flex-col items-center gap-2 text-slate-400">
                          <Database className="w-12 h-12 opacity-20" />
                          <p className="font-medium italic">No uploads found in the system.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden flex flex-col divide-y divide-slate-100 max-h-[600px] overflow-y-auto custom-scrollbar">
              {uploads.map((up) => {
                const agent = users.find(u => u.id === up.agentId);
                return (
                  <div key={`${up.id}-mobile`} className="p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-xl border border-slate-100 flex items-center justify-center text-slate-500 shadow-sm shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate">{up.filename}</p>
                          <p className="text-xs text-slate-600 flex items-center gap-1">
                            <UserIcon className="w-3 h-3" />
                            {agent?.name || 'Unknown Agent'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-600 text-xs font-bold whitespace-nowrap">
                        <Calendar className="w-3.5 h-3.5 text-slate-600" />
                        {up.createdAt?.toDate ? up.createdAt.toDate().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'N/A'}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between mt-4 bg-slate-50 p-3 rounded-2xl">
                      <div className="flex flex-col gap-1">
                        <span className="font-mono text-success font-black text-sm">₹{up.totalAmount?.toLocaleString()}</span>
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-tighter bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200 w-fit">
                          {up.totalAccounts} Accounts
                        </span>
                      </div>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => viewUploadDetails(up)}
                          className="p-2.5 text-slate-500 hover:text-brand hover:bg-brand/5 rounded-xl transition-all"
                          title="View Details"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDownloadUpload(up)}
                          className="p-2.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                          title="Download CSV"
                        >
                          <Download className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget({ id: up.id, type: 'upload', name: up.filename })}
                          className="p-2.5 text-slate-500 hover:text-brand hover:bg-brand/5 rounded-xl transition-all"
                          title="Delete Upload"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {uploads.length === 0 && (
                <div className="py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <Database className="w-12 h-12 opacity-20" />
                    <p className="font-medium italic">No uploads found in the system.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {activeAdminTab === 'settings' && (
        <div className="mt-8 bg-white rounded-[2rem] shadow-sm border border-slate-100 p-6 sm:p-10 glass-card">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-premium">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Site Settings</h3>
              <p className="text-slate-500 font-medium text-sm">Manage global content and contact details shown to users</p>
            </div>
          </div>
          
          {settingsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-brand" />
            </div>
          ) : (
            <form onSubmit={saveSettings} className="space-y-6">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">About Us Text</label>
                <textarea
                  value={siteSettings.aboutUsText || ''}
                  onChange={(e) => setSiteSettings({ ...siteSettings, aboutUsText: e.target.value })}
                  placeholder="Enter content for the About Us page..."
                  className="w-full min-h-[120px] px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:border-brand focus:ring-0 transition-all custom-scrollbar outline-none"
                  required
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Contact Email</label>
                  <input
                    type="email"
                    value={siteSettings.email || ''}
                    onChange={(e) => setSiteSettings({ ...siteSettings, email: e.target.value })}
                    placeholder="contact@example.com"
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:border-brand outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Phone Number</label>
                  <input
                    type="tel"
                    value={siteSettings.phone || ''}
                    onChange={(e) => setSiteSettings({ ...siteSettings, phone: e.target.value })}
                    placeholder="+91 1234567890"
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:border-brand outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">WhatsApp Number</label>
                  <input
                    type="tel"
                    value={siteSettings.whatsapp || ''}
                    onChange={(e) => setSiteSettings({ ...siteSettings, whatsapp: e.target.value })}
                    placeholder="+91 1234567890"
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:border-brand outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">YouTube Link</label>
                  <input
                    type="url"
                    value={siteSettings.youtube || ''}
                    onChange={(e) => setSiteSettings({ ...siteSettings, youtube: e.target.value })}
                    placeholder="https://youtube.com/@channel"
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:border-brand outline-none"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Office Address</label>
                  <textarea
                    value={siteSettings.address || ''}
                    onChange={(e) => setSiteSettings({ ...siteSettings, address: e.target.value })}
                    placeholder="123 Agent Street..."
                    className="w-full min-h-[80px] px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:border-brand outline-none"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={settingsSaving}
                className="w-full sm:w-auto px-10 py-5 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20 active:scale-95 disabled:opacity-50 flex items-center justify-center min-w-[200px]"
              >
                {settingsSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Settings'}
              </button>
            </form>
          )}
        </div>
      )}

      {activeAdminTab === 'messages' && (
        <div className="mt-8 bg-white rounded-[2rem] shadow-sm border border-slate-100 p-6 sm:p-10 glass-card">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-premium">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Contact Messages</h3>
              <p className="text-slate-500 font-medium text-sm">inquiries and support requests from users</p>
            </div>
          </div>
          
          {messagesLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-brand" />
            </div>
          ) : (
            <div className="space-y-4">
              {contactMessages.map((msg) => (
                <div key={msg.id} className={`p-6 rounded-2xl border transition-colors ${msg.status === 'unread' ? 'bg-indigo-50/30 border-indigo-100 shadow-sm' : 'bg-slate-50 border-slate-100'}`}>
                  <div className="flex flex-col sm:flex-row justify-between gap-4 mb-4">
                    <div>
                      <h4 className="font-black text-lg text-slate-900 flex items-center gap-2">
                        {msg.name}
                        {msg.status === 'unread' && <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />}
                      </h4>
                      <p className="text-sm font-medium text-slate-600 font-mono mt-1">{msg.email} • {msg.phone}</p>
                    </div>
                    <div className="flex flex-col sm:items-end gap-2 shrink-0">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleString('en-IN', {
                          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                        }) : 'N/A'}
                      </span>
                      {msg.status === 'unread' && (
                        <button
                          onClick={() => markMessageRead(msg.id)}
                          className="px-4 py-1.5 bg-white border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600 rounded-xl hover:bg-slate-50 hover:text-brand transition-colors shadow-sm mt-1 w-fit"
                        >
                          Mark as Read
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-100 text-sm text-slate-700 whitespace-pre-wrap">
                    {msg.message}
                  </div>
                </div>
              ))}
              {contactMessages.length === 0 && (
                <div className="py-12 text-center text-slate-400 font-medium italic">
                  No messages found.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <ConfirmationModal
        isOpen={!!deleteTarget}
        title={`Delete ${deleteTarget?.type === 'user' ? 'User' : 'Upload'}`}
        message={`Are you sure you want to delete ${deleteTarget?.name}? This action cannot be undone and will remove all associated data.`}
        onConfirm={() => {
          if (!deleteTarget) return;
          if (deleteTarget.type === 'user') {
            deleteUser(deleteTarget.id);
          } else {
            deleteUpload(deleteTarget.id);
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      <AnimatePresence>
        {selectedUpload && (
          <div key="admin-upload-modal-backdrop" className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            {/* Same code as original for selectedUpload */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              className="bg-white rounded-[2.5rem] shadow-premium border border-slate-200 w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col relative"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-brand"></div>
              
              <div className="p-6 sm:p-10 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-slate-50/30">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-brand/10 rounded-xl flex items-center justify-center text-brand shrink-0 shadow-premium">
                      <FileText className="w-6 h-6" />
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight truncate">{selectedUpload.filename}</h3>
                  </div>
                  <div className="text-slate-500 font-medium flex flex-wrap items-center gap-2 text-sm">
                    <UserIcon className="w-4 h-4 shrink-0" />
                    <span className="truncate">Uploaded by <span className="text-brand font-black">{users.find(u => u.id === selectedUpload.agentId)?.name || 'Unknown Agent'}</span></span>
                    <span className="hidden sm:inline-block w-1 h-1 rounded-full bg-slate-300"></span>
                    <Calendar className="w-4 h-4 shrink-0" />
                    <span className="whitespace-nowrap">{selectedUpload.createdAt?.toDate ? selectedUpload.createdAt.toDate().toLocaleString() : 'N/A'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:w-auto w-full">
                  <button
                    onClick={() => handleDownloadUpload(selectedUpload)}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-brand text-white rounded-2xl hover:bg-brand/90 transition-all shadow-xl shadow-brand/20 font-black uppercase tracking-widest text-xs hover-lift whitespace-nowrap"
                  >
                    <Download className="w-5 h-5 shrink-0" />
                    Download
                  </button>
                  <button
                    onClick={() => setSelectedUpload(null)}
                    className="p-3 hover:bg-slate-200 rounded-2xl transition-colors text-slate-500 shrink-0 bg-slate-100 sm:bg-transparent"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="p-6 sm:p-10 overflow-y-auto flex-1 custom-scrollbar">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
                  <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-premium glass-card group hover:border-brand/20 transition-all">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Total Amount</p>
                    <p className="text-3xl font-black text-success flex items-center gap-1 group-hover:text-success transition-colors">
                      <IndianRupee className="w-6 h-6 text-brand" />
                      {selectedUpload.totalAmount?.toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-premium glass-card group hover:border-gold/20 transition-all">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Total Accounts</p>
                    <p className="text-3xl font-black text-slate-900 group-hover:text-gold transition-colors">{selectedUpload.totalAccounts}</p>
                  </div>
                  <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-premium glass-card group hover:border-brand/20 transition-all">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Total Batches</p>
                    <p className="text-3xl font-black text-slate-900 group-hover:text-brand transition-colors">{uploadBatches.length}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-xl font-black text-slate-900 flex items-center gap-2">
                    <Database className="w-5 h-5 text-brand" />
                    Associated Batches
                  </h4>
                </div>

                {loadingBatches ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <Loader2 className="w-12 h-12 animate-spin text-brand" />
                    <p className="text-slate-500 font-bold animate-pulse">Loading batch data...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {uploadBatches.map((batch) => (
                      <div key={batch.id} className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-slate-50/50 rounded-[1.5rem] border border-slate-100 hover:border-brand/20 hover:bg-white transition-all duration-300">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-white rounded-2xl border border-slate-100 flex items-center justify-center font-black text-slate-400 group-hover:text-brand group-hover:border-brand/20 transition-all shadow-sm shrink-0">
                            #{batch.batchNumber}
                          </div>
                          <div>
                            <p className="font-black text-success flex items-center gap-1 text-lg">
                              <IndianRupee className="w-4 h-4 text-brand shrink-0" />
                              <span className="truncate">{batch.totalAmount.toLocaleString()}</span>
                            </p>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">{batch.accountCount} Accounts</p>
                          </div>
                        </div>
                        <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 w-full sm:w-auto border-t sm:border-t-0 border-slate-100 pt-3 sm:pt-0 mt-1 sm:mt-0">
                          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest ${getStatusColor(batch.status)}`}>
                            {getStatusIcon(batch.status)}
                            <span>{batch.status}</span>
                          </div>
                          {batch.referenceNumber && (
                            <p className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">{batch.referenceNumber}</p>
                          )}
                        </div>
                      </div>
                    ))}
                    {uploadBatches.length === 0 && (
                      <div className="col-span-full py-12 text-center bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
                        <p className="text-slate-400 font-medium italic">No batches found for this upload.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}

        {showActiveAgents && (
          <div key="active-agents-modal" className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              className="bg-white rounded-[2.5rem] shadow-premium border border-slate-200 w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col relative"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-brand"></div>
              
              <div className="p-6 sm:p-10 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-slate-50/30">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-brand/10 rounded-xl flex items-center justify-center text-brand shrink-0 shadow-premium">
                      <Users className="w-6 h-6" />
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">Active Agent Tracking</h3>
                  </div>
                  <p className="text-slate-500 font-medium text-sm">
                    Monitor currently active agents and view complete login history records.
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => { setShowActiveAgents(false); setHistoryFilter(null); }}
                    className="p-3 hover:bg-slate-200 rounded-2xl transition-colors text-slate-500 bg-slate-100 sm:bg-transparent"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="p-6 sm:p-10 overflow-y-auto flex-1 custom-scrollbar">
                <div className="mb-10">
                  <h4 className="text-lg font-black text-slate-900 flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 rounded-full bg-brand animate-pulse"></div>
                    Active Now ({activeUsersCount})
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {users.filter(u => {
                      if (!u.lastActiveAt) return false;
                      const activeTime = u.lastActiveAt.toMillis ? u.lastActiveAt.toMillis() : u.lastActiveAt;
                      return (Date.now() - activeTime) < 5 * 60 * 1000;
                    }).map(u => (
                      <div key={u.id} 
                        onClick={() => setHistoryFilter(historyFilter === u.id ? null : u.id)}
                        className={`p-4 rounded-[1.5rem] border transition-all cursor-pointer flex flex-col gap-2 ${historyFilter === u.id ? 'bg-brand/5 border-brand/20 shadow-md' : 'bg-white border-slate-100 shadow-sm hover:border-brand/20'}`}>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 shrink-0">
                            <UserIcon className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 truncate text-sm">{u.name || 'Unknown'}</p>
                            <p className="text-xs text-slate-500 truncate">{u.role}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {activeUsersCount === 0 && (
                      <div className="col-span-full py-8 text-center bg-slate-50 rounded-[1.5rem] border border-dashed border-slate-200">
                        <p className="text-slate-400 font-bold">No agents are currently active.</p>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-black text-slate-900 flex items-center gap-2">
                      <Clock className="w-5 h-5 text-slate-400" />
                      Login History
                    </h4>
                    {historyFilter && (
                      <button 
                        onClick={() => setHistoryFilter(null)}
                        className="text-xs font-bold text-brand hover:text-brand-dark flex items-center gap-1 bg-brand/5 px-3 py-1 rounded-full transition-colors"
                      >
                       Clear Filter <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  
                  {loadingHistory ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-brand" />
                    </div>
                  ) : (
                    <div className="bg-white border border-slate-100 rounded-[2rem] overflow-hidden shadow-sm">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50/80 border-b border-slate-100">
                            <th className="py-4 px-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">User</th>
                            <th className="py-4 px-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Email</th>
                            <th className="py-4 px-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Role</th>
                            <th className="py-4 px-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Login Time</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {loginHistory.filter(h => !historyFilter || h.userId === historyFilter).map((record, i) => (
                            <tr key={record.id || i} className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-4 px-6">
                                <div className="font-bold text-slate-900 text-sm">{record.name}</div>
                              </td>
                              <td className="py-4 px-6">
                                <div className="text-slate-500 text-sm">{record.email}</div>
                              </td>
                              <td className="py-4 px-6">
                                <div className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                  record.role === 'admin' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {record.role}
                                </div>
                              </td>
                              <td className="py-4 px-6 text-right">
                                <div className="text-slate-600 text-sm font-medium">
                                  {record.loginAt?.toDate ? record.loginAt.toDate().toLocaleString('en-IN', {
                                    day: '2-digit', month: 'short', year: 'numeric',
                                    hour: '2-digit', minute: '2-digit'
                                  }) : 'Unknown Time'}
                                </div>
                              </td>
                            </tr>
                          ))}
                          {loginHistory.length === 0 && (
                            <tr>
                              <td colSpan={4} className="py-8 text-center text-slate-400 font-medium italic">
                                No login history found.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
