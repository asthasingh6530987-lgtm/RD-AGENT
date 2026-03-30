import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { collection, getDocs, updateDoc, doc, deleteDoc, query, orderBy, where } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Users, FileText, Database, Loader2, ShieldCheck, User as UserIcon, Trash2, Eye, Calendar, X, IndianRupee, CheckCircle2, Clock, AlertCircle, RefreshCw, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
          csvData.push({
            'Batch Reference': batchRef,
            'Account No': acc.accountNo,
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
      <div className="relative overflow-hidden bg-white rounded-[2.5rem] p-8 sm:p-10 border border-slate-100 shadow-sm glass-card">
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
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all hover-lift shadow-lg shadow-slate-900/10"
            >
              <RefreshCw className="w-5 h-5" />
              Refresh Data
            </button>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm glass-card relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Users className="w-16 h-16 text-brand" />
          </div>
          <p className="text-slate-500 font-bold text-sm uppercase tracking-wider mb-1">Total Agents</p>
          <h3 className="text-5xl font-black text-slate-900 mb-4">{stats.totalUsers}</h3>
          <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm bg-emerald-50 w-fit px-3 py-1 rounded-full">
            <CheckCircle2 className="w-4 h-4" />
            Active System
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm glass-card relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <FileText className="w-16 h-16 text-brand" />
          </div>
          <p className="text-slate-500 font-bold text-sm uppercase tracking-wider mb-1">Total Uploads</p>
          <h3 className="text-5xl font-black text-slate-900 mb-4">{stats.totalUploads}</h3>
          <div className="flex items-center gap-2 text-brand font-bold text-sm bg-brand/5 w-fit px-3 py-1 rounded-full">
            <Database className="w-4 h-4" />
            Data Processed
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm glass-card relative overflow-hidden group sm:col-span-2 lg:col-span-1"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Database className="w-16 h-16 text-brand" />
          </div>
          <p className="text-slate-500 font-bold text-sm uppercase tracking-wider mb-1">Total Batches</p>
          <h3 className="text-5xl font-black text-slate-900 mb-4">{stats.totalBatches}</h3>
          <div className="flex items-center gap-2 text-gold font-bold text-sm bg-gold/5 w-fit px-3 py-1 rounded-full">
            <Clock className="w-4 h-4" />
            Batch History
          </div>
        </motion.div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* User Management */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 p-8 glass-card">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                <div className="w-10 h-10 bg-brand/10 rounded-xl flex items-center justify-center">
                  <Users className="w-5 h-5 text-brand" />
                </div>
                Agents
              </h3>
              <span className="text-xs font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                {users.length} Total
              </span>
            </div>
            
            <div className="space-y-4">
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
                  
                  <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-100">
                    <div className="flex items-center gap-2">
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
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 p-8 glass-card">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                <div className="w-10 h-10 bg-brand/10 rounded-xl flex items-center justify-center">
                  <FileText className="w-5 h-5 text-brand" />
                </div>
                Recent Uploads
              </h3>
            </div>
            
            <div className="overflow-x-auto -mx-8">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-50">
                    <th className="py-4 px-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">File & Agent</th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Stats</th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                    <th className="py-4 px-8 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {uploads.map((up) => {
                    const agent = users.find(u => u.id === up.agentId);
                    return (
                      <tr key={up.id} className="group hover:bg-slate-50/50 transition-all duration-300">
                        <td className="py-5 px-8">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-white rounded-xl border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-brand transition-colors shadow-sm">
                              <FileText className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 truncate group-hover:text-brand transition-colors">{up.filename}</p>
                              <p className="text-xs text-slate-500 flex items-center gap-1">
                                <UserIcon className="w-3 h-3" />
                                {agent?.name || 'Unknown Agent'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-5 px-4">
                          <div className="flex flex-col items-center gap-1">
                            <span className="font-mono text-slate-900 font-bold text-sm">₹{up.totalAmount?.toLocaleString()}</span>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter bg-slate-100 px-2 py-0.5 rounded-full">
                              {up.totalAccounts} Accounts
                            </span>
                          </div>
                        </td>
                        <td className="py-5 px-4">
                          <div className="flex items-center gap-1.5 text-slate-500 text-xs font-medium">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            {up.createdAt?.toDate ? up.createdAt.toDate().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'N/A'}
                          </div>
                        </td>
                        <td className="py-5 px-8 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => viewUploadDetails(up)}
                              className="p-2.5 text-slate-400 hover:text-brand hover:bg-brand/5 rounded-xl transition-all"
                              title="View Details"
                            >
                              <Eye className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleDownloadUpload(up)}
                              className="p-2.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                              title="Download CSV"
                            >
                              <Download className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => setDeleteTarget({ id: up.id, type: 'upload', name: up.filename })}
                              className="p-2.5 text-slate-400 hover:text-brand hover:bg-brand/5 rounded-xl transition-all"
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
          </div>
        </div>
      </div>
      
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col relative"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-brand via-gold to-brand"></div>
              
              <div className="p-8 sm:p-10 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-slate-50/30">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-brand/10 rounded-xl flex items-center justify-center text-brand">
                      <FileText className="w-6 h-6" />
                    </div>
                    <h3 className="text-3xl font-black text-slate-900 tracking-tight">{selectedUpload.filename}</h3>
                  </div>
                  <p className="text-slate-500 font-medium flex items-center gap-2">
                    <UserIcon className="w-4 h-4" />
                    Uploaded by <span className="text-slate-900 font-bold">{users.find(u => u.id === selectedUpload.agentId)?.name || 'Unknown Agent'}</span>
                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                    <Calendar className="w-4 h-4" />
                    {selectedUpload.createdAt?.toDate ? selectedUpload.createdAt.toDate().toLocaleString() : 'N/A'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleDownloadUpload(selectedUpload)}
                    className="flex items-center gap-2 px-6 py-3 bg-brand text-white rounded-2xl hover:bg-brand-dark transition-all shadow-xl shadow-brand/20 font-bold hover-lift"
                  >
                    <Download className="w-5 h-5" />
                    Download Export
                  </button>
                  <button
                    onClick={() => setSelectedUpload(null)}
                    className="p-3 hover:bg-slate-200 rounded-2xl transition-colors text-slate-500"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="p-8 sm:p-10 overflow-y-auto flex-1 custom-scrollbar">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
                  <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm glass-card">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Amount</p>
                    <p className="text-3xl font-black text-slate-900 flex items-center gap-1">
                      <IndianRupee className="w-6 h-6 text-brand" />
                      {selectedUpload.totalAmount?.toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm glass-card">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Accounts</p>
                    <p className="text-3xl font-black text-slate-900">{selectedUpload.totalAccounts}</p>
                  </div>
                  <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm glass-card">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Batches</p>
                    <p className="text-3xl font-black text-slate-900">{uploadBatches.length}</p>
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
                      <div key={batch.id} className="group flex items-center justify-between p-5 bg-slate-50/50 rounded-[1.5rem] border border-slate-100 hover:border-brand/20 hover:bg-white transition-all duration-300">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-white rounded-2xl border border-slate-100 flex items-center justify-center font-black text-slate-400 group-hover:text-brand group-hover:border-brand/20 transition-all shadow-sm">
                            #{batch.batchNumber}
                          </div>
                          <div>
                            <p className="font-black text-slate-900 flex items-center gap-1 text-lg">
                              <IndianRupee className="w-4 h-4 text-brand" />
                              {batch.totalAmount.toLocaleString()}
                            </p>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">{batch.accountCount} Accounts</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
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
      </AnimatePresence>
    </div>
  );
}
