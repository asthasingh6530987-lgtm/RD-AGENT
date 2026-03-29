import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { collection, addDoc, query, where, onSnapshot, orderBy, serverTimestamp, doc, setDoc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import Papa from 'papaparse';
import { createBatches, Account, Batch } from '../utils/batching';
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, IndianRupee, Clock, RefreshCw, X, Trash2, Download, ChevronLeft, ChevronRight, Search, ArrowUpDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmationModal from './ConfirmationModal';

interface DashboardProps {
  user: User;
  addToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

interface SavedBatch {
  id: string;
  totalAmount: number;
  accountCount: number;
  status: string;
  referenceNumber?: string;
  createdAt: any;
  accounts: Account[];
  batchNumber?: number;
}

export default function Dashboard({ user, addToast }: DashboardProps) {
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualAccount, setManualAccount] = useState({
    accountNo: '',
    amount: '',
    accountName: '',
  });
  const [savedBatches, setSavedBatches] = useState<SavedBatch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [selectedBatch, setSelectedBatch] = useState<SavedBatch | null>(null);
  const [referenceInput, setReferenceInput] = useState('');
  const [updatingRef, setUpdatingRef] = useState(false);
  const [exportAllOpen, setExportAllOpen] = useState(false);
  const [exportBatchOpen, setExportBatchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<'date' | 'status' | 'amount' | 'count'>('date');
  const [currentPage, setCurrentPage] = useState(1);
  const BATCHES_PER_PAGE = 20;

  const [deletingBatch, setDeletingBatch] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);

  const exportAllRef = React.useRef<HTMLDivElement>(null);
  const exportBatchRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (exportAllRef.current && !exportAllRef.current.contains(event.target as Node)) {
        setExportAllOpen(false);
      }
      if (exportBatchRef.current && !exportBatchRef.current.contains(event.target as Node)) {
        setExportBatchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Ensure user profile exists in Firestore
  useEffect(() => {
    const ensureUserExists = async () => {
      try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            uid: user.uid,
            email: user.email,
            name: user.displayName || '',
            role: 'agent',
            createdAt: serverTimestamp()
          });
        }
      } catch (err) {
        console.error("Error setting user profile:", err);
      }
    };
    ensureUserExists();
  }, [user]);

  // Fetch batches
  useEffect(() => {
    const q = query(
      collection(db, 'batches'),
      where('agentId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const batchesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SavedBatch[];
      setSavedBatches(batchesData);
      setLoadingBatches(false);
    }, (err) => {
      console.error("Error fetching batches:", err);
      setError("Failed to load your batches. Please check your permissions.");
      setLoadingBatches(false);
    });

    return () => unsubscribe();
  }, [user.uid]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
      setSuccess(null);
    }
  };

  const handleClearFile = () => {
    setFile(null);
    setError(null);
    setSuccess(null);
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  const processFile = async () => {
    if (!file) {
      setError("Please select a CSV file first.");
      return;
    }

    setProcessing(true);
    setError(null);
    setSuccess(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const accounts: Account[] = [];
          let totalAmount = 0;

          // Validate and parse CSV data
          for (const row of results.data as any[]) {
            // Assuming CSV has columns: AccountNo, Amount, Account Name, Denomination, Month Paid Upto, Next RD Installment Due Date
            const accountNo = row['AccountNo'] || row['accountNo'] || row['Account No'] || row['account_no'];
            let amountStr = row['Amount'] || row['amount'] || row['Denomination'];
            const accountName = row['Account Name'] || row['account_name'] || row['AccountName'];
            const monthPaidUpto = row['Month Paid Upto'] || row['month_paid_upto'];
            const nextDueDate = row['Next RD Installment Due Date'] || row['next_due_date'];

            if (!accountNo || !amountStr) {
              throw new Error("Invalid CSV format. Please ensure 'Account No' and 'Denomination' or 'Amount' columns exist.");
            }

            if (typeof amountStr === 'string') {
              amountStr = amountStr.replace(/,/g, '').replace(/Cr\./g, '').trim();
            }

            const amount = parseFloat(amountStr);
            if (isNaN(amount) || amount <= 0) {
              throw new Error(`Invalid amount for account ${accountNo}.`);
            }

            if (amount > 20000) {
              throw new Error(`Account ${accountNo} has amount ₹${amount} which exceeds the ₹20,000 limit.`);
            }

            accounts.push({ 
              accountNo: String(accountNo).trim(), 
              amount,
              accountName: accountName ? String(accountName).trim() : undefined,
              monthPaidUpto: monthPaidUpto ? String(monthPaidUpto).trim() : undefined,
              nextDueDate: nextDueDate ? String(nextDueDate).trim() : undefined
            });
            totalAmount += amount;
          }

          if (accounts.length === 0) {
            throw new Error("No valid accounts found in the file.");
          }

          // Create Upload Record
          const uploadRef = await addDoc(collection(db, 'uploads'), {
            agentId: user.uid,
            filename: file.name,
            totalAmount,
            totalAccounts: accounts.length,
            status: 'processed',
            createdAt: serverTimestamp()
          });

          // Group into batches of max ₹20,000
          const batches = createBatches(accounts, 20000);

          const maxBatchNumber = savedBatches.reduce((max, batch) => Math.max(max, batch.batchNumber || 0), 0);

          // Save batches to Firestore
          const batchPromises = batches.map((batch, index) => 
            addDoc(collection(db, 'batches'), {
              agentId: user.uid,
              uploadId: uploadRef.id,
              totalAmount: batch.totalAmount,
              accountCount: batch.accounts.length,
              status: 'pending', // Python script will pick these up
              accounts: batch.accounts,
              createdAt: serverTimestamp(),
              batchNumber: maxBatchNumber + index + 1
            })
          );

          await Promise.all(batchPromises);

          const msg = `Successfully processed ${accounts.length} accounts into ${batches.length} batches.`;
          setSuccess(msg);
          addToast?.(msg, 'success');
          setFile(null);
          // Reset file input
          const fileInput = document.getElementById('file-upload') as HTMLInputElement;
          if (fileInput) fileInput.value = '';

        } catch (err: any) {
          const msg = err.message || "An error occurred while processing the file.";
          setError(msg);
          addToast?.(msg, 'error');
        } finally {
          setProcessing(false);
        }
      },
      error: (err) => {
        const msg = `Failed to parse CSV: ${err.message}`;
        setError(msg);
        addToast?.(msg, 'error');
        setProcessing(false);
      }
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'processing': return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'failed': return 'bg-red-50 text-brand border-red-100';
      default: return 'bg-amber-50 text-amber-700 border-amber-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-3.5 h-3.5" />;
      case 'processing': return <Clock className="w-3.5 h-3.5" />;
      case 'failed': return <AlertCircle className="w-3.5 h-3.5" />;
      default: return <Clock className="w-3.5 h-3.5" />;
    }
  };

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualAccount.accountNo || !manualAccount.amount) {
      const msg = "Please fill in account number and amount.";
      setError(msg);
      addToast?.(msg, 'error');
      return;
    }

    const amount = parseFloat(manualAccount.amount);
    if (isNaN(amount) || amount <= 0) {
      const msg = "Invalid amount.";
      setError(msg);
      addToast?.(msg, 'error');
      return;
    }

    if (amount > 20000) {
      const msg = "Amount exceeds ₹20,000 limit.";
      setError(msg);
      addToast?.(msg, 'error');
      return;
    }

    setProcessing(true);
    try {
      const account: Account = {
        accountNo: manualAccount.accountNo.trim(),
        amount,
        accountName: manualAccount.accountName.trim() || undefined,
      };

      // Create Upload Record for manual entry
      const uploadRef = await addDoc(collection(db, 'uploads'), {
        agentId: user.uid,
        filename: 'Manual Entry',
        totalAmount: amount,
        totalAccounts: 1,
        status: 'processed',
        createdAt: serverTimestamp()
      });

      const maxBatchNumber = savedBatches.reduce((max, batch) => Math.max(max, batch.batchNumber || 0), 0);

      await addDoc(collection(db, 'batches'), {
        agentId: user.uid,
        uploadId: uploadRef.id,
        totalAmount: amount,
        accountCount: 1,
        status: 'pending',
        accounts: [account],
        createdAt: serverTimestamp(),
        batchNumber: maxBatchNumber + 1
      });

      const msg = "Account added successfully.";
      setSuccess(msg);
      addToast?.(msg, 'success');
      setManualAccount({ accountNo: '', amount: '', accountName: '' });
      setShowManualAdd(false);
    } catch (err: any) {
      const msg = err.message || "Failed to add account.";
      setError(msg);
      addToast?.(msg, 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleUpdateReference = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatch || !referenceInput.trim()) return;

    setUpdatingRef(true);
    try {
      const batchRef = doc(db, 'batches', selectedBatch.id);
      await updateDoc(batchRef, {
        referenceNumber: referenceInput.trim(),
        status: 'completed'
      });
      setSuccess('Reference number added successfully.');
      setTimeout(() => setSuccess(null), 3000);
      setSelectedBatch(null);
      setReferenceInput('');
    } catch (err) {
      console.error("Error updating reference:", err);
      setError("Failed to update reference number. Please try again.");
      setTimeout(() => setError(null), 3000);
    } finally {
      setUpdatingRef(false);
    }
  };

  const handleExportBatch = (format: 'detailed' | 'portal' | 'summary' = 'detailed') => {
    if (!selectedBatch) return;

    const csvData: any[] = [];
    selectedBatch.accounts.forEach(acc => {
      if (format === 'portal' || format === 'summary') {
        csvData.push({
          'Account No': acc.accountNo,
          'Amount': acc.amount
        });
      } else {
        csvData.push({
          'Account No': acc.accountNo,
          'Account Name': acc.accountName || '',
          'Month Paid Upto': acc.monthPaidUpto || '',
          'Next RD Installment Due Date': acc.nextDueDate || '',
          'Amount': acc.amount
        });
      }
    });

    if (format === 'detailed') {
      csvData.push({
        'Account No': 'TOTAL BATCH AMOUNT',
        'Account Name': '',
        'Month Paid Upto': '',
        'Next RD Installment Due Date': '',
        'Amount': selectedBatch.totalAmount
      });
    } else if (format === 'summary') {
      csvData.push({
        'Account No': 'TOTAL BATCH AMOUNT',
        'Amount': selectedBatch.totalAmount
      });
    }

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `batch_${selectedBatch.referenceNumber || selectedBatch.id}${format === 'portal' ? '_portal' : ''}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteBatch = async () => {
    if (!selectedBatch) return;
    setDeletingBatch(true);
    try {
      await deleteDoc(doc(db, 'batches', selectedBatch.id));
      setSelectedBatch(null);
      setShowDeleteConfirm(false);
      addToast?.('Batch deleted successfully', 'success');
    } catch (err) {
      console.error("Error deleting batch:", err);
      addToast?.('Failed to delete batch', 'error');
    } finally {
      setDeletingBatch(false);
    }
  };

  const handleDeleteAllBatches = async () => {
    if (savedBatches.length === 0) return;
    setDeletingAll(true);
    try {
      const promises = savedBatches.map(batch => deleteDoc(doc(db, 'batches', batch.id)));
      await Promise.all(promises);
      setShowDeleteAllConfirm(false);
      addToast?.('All batches deleted successfully', 'success');
    } catch (err) {
      console.error("Error deleting all batches:", err);
      addToast?.('Failed to delete all batches', 'error');
    } finally {
      setDeletingAll(false);
    }
  };

  const handleExportAllBatches = (format: 'detailed' | 'portal' | 'summary' = 'detailed') => {
    if (savedBatches.length === 0) return;

    const csvData: any[] = [];
    
    savedBatches.forEach(batch => {
      const batchIdentifier = batch.referenceNumber || batch.id;
      batch.accounts.forEach(acc => {
        if (format === 'portal' || format === 'summary') {
          csvData.push({
            'Account No': acc.accountNo,
            'Amount': acc.amount
          });
        } else {
          csvData.push({
            'Batch Reference': batchIdentifier,
            'Account No': acc.accountNo,
            'Account Name': acc.accountName || '',
            'Month Paid Upto': acc.monthPaidUpto || '',
            'Next RD Installment Due Date': acc.nextDueDate || '',
            'Amount': acc.amount
          });
        }
      });
      
      if (format === 'detailed') {
        csvData.push({
          'Batch Reference': batchIdentifier,
          'Account No': 'TOTAL BATCH AMOUNT',
          'Account Name': '',
          'Month Paid Upto': '',
          'Next RD Installment Due Date': '',
          'Amount': batch.totalAmount
        });
        // Add empty row for separation between batches
        csvData.push({
          'Batch Reference': '',
          'Account No': '',
          'Account Name': '',
          'Month Paid Upto': '',
          'Next RD Installment Due Date': '',
          'Amount': ''
        });
      } else if (format === 'summary') {
        csvData.push({
          'Account No': 'TOTAL BATCH AMOUNT',
          'Amount': batch.totalAmount
        });
        // Add empty row for separation between batches
        csvData.push({
          'Account No': '',
          'Amount': ''
        });
      }
    });

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `all_batches_export${format === 'portal' ? '_portal' : ''}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredBatches = React.useMemo(() => {
    let filtered = savedBatches.filter(batch => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase().trim();
      if (batch.referenceNumber?.toLowerCase().includes(query)) return true;
      if (batch.accounts.some(acc => acc.accountNo.toLowerCase().includes(query))) return true;
      return false;
    });

    if (sortOption === 'date') {
      filtered.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
    } else if (sortOption === 'status') {
      filtered.sort((a, b) => a.status.localeCompare(b.status));
    } else if (sortOption === 'amount') {
      filtered.sort((a, b) => b.totalAmount - a.totalAmount);
    } else if (sortOption === 'count') {
      filtered.sort((a, b) => b.accountCount - a.accountCount);
    }
    
    return filtered;
  }, [savedBatches, searchQuery, sortOption]);

  const totalPages = Math.ceil(filteredBatches.length / BATCHES_PER_PAGE);
  const paginatedBatches = filteredBatches.slice(
    (currentPage - 1) * BATCHES_PER_PAGE,
    currentPage * BATCHES_PER_PAGE
  );

  // Reset to page 1 if current page is out of bounds after deletion or search
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [filteredBatches.length, totalPages, currentPage]);

  return (
    <div className="space-y-10 pb-12">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">
            Welcome, <span className="text-brand">{user.displayName || 'Agent'}</span>
          </h1>
          <p className="text-slate-500 font-medium tracking-wide uppercase text-[10px]">
            Manage your RD account batches and collections
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowManualAdd(!showManualAdd)}
            className="px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm hover:shadow-md hover-lift flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            Manual Entry
          </button>
          <button
            className="px-6 py-3 bg-brand text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-brand/90 transition-all shadow-lg shadow-brand/20 hover:shadow-brand/30 hover-lift flex items-center gap-2"
            onClick={() => document.getElementById('file-upload')?.click()}
          >
            <Upload className="w-4 h-4" />
            Upload CSV
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-6 rounded-3xl border border-slate-100"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center">
              <IndianRupee className="w-6 h-6 text-emerald-600" />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Value</span>
          </div>
          <div className="text-3xl font-black text-slate-900 tracking-tight">
            ₹{savedBatches.reduce((sum, b) => sum + b.totalAmount, 0).toLocaleString('en-IN')}
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-6 rounded-3xl border border-slate-100"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Batches</span>
          </div>
          <div className="text-3xl font-black text-slate-900 tracking-tight">
            {savedBatches.length}
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-6 rounded-3xl border border-slate-100"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pending</span>
          </div>
          <div className="text-3xl font-black text-slate-900 tracking-tight">
            {savedBatches.filter(b => b.status === 'pending').length}
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-card p-6 rounded-3xl border border-slate-100"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-brand/5 rounded-2xl flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-brand" />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Completed</span>
          </div>
          <div className="text-3xl font-black text-slate-900 tracking-tight">
            {savedBatches.filter(b => b.status === 'completed').length}
          </div>
        </motion.div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Upload & Actions */}
        <div className="lg:col-span-4 space-y-8">
          {/* File Upload Area */}
          <div className="glass-card p-8 rounded-[2rem] border border-slate-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand/5 rounded-full -mr-16 -mt-16 blur-3xl" />
            
            <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-3">
              <Upload className="w-6 h-6 text-brand" />
              Upload Batch
            </h3>

            <div 
              className={`relative border-2 border-dashed rounded-3xl p-8 transition-all duration-300 text-center ${
                file ? 'border-brand bg-brand/5' : 'border-slate-200 hover:border-brand/30 hover:bg-slate-50'
              }`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  setFile(e.dataTransfer.files[0]);
                }
              }}
            >
              <input
                type="file"
                id="file-upload"
                className="hidden"
                accept=".csv"
                onChange={handleFileChange}
              />
              
              {file ? (
                <div className="space-y-4">
                  <div className="w-16 h-16 bg-brand rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-brand/20">
                    <FileText className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 truncate max-w-[200px] mx-auto">{file.name}</p>
                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-1">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={handleClearFile}
                      className="p-2 text-slate-400 hover:text-brand transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto">
                    <Upload className="w-8 h-8 text-slate-300" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">Drop your CSV here</p>
                    <p className="text-xs text-slate-400 mt-1">or click to browse files</p>
                  </div>
                  <button 
                    onClick={() => document.getElementById('file-upload')?.click()}
                    className="text-xs font-black text-brand uppercase tracking-widest hover:underline"
                  >
                    Select File
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={processFile}
              disabled={!file || processing}
              className={`w-full mt-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3 ${
                !file || processing
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-slate-900 text-white shadow-xl shadow-slate-900/20 hover:shadow-slate-900/30 hover-lift'
              }`}
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Process Batch
                </>
              )}
            </button>
          </div>

          {/* Manual Entry Form */}
          <AnimatePresence>
            {showManualAdd && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="glass-card p-8 rounded-[2rem] border border-slate-100 overflow-hidden"
              >
                <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-3">
                  <FileText className="w-6 h-6 text-brand" />
                  Manual Entry
                </h3>
                <form onSubmit={handleManualAdd} className="space-y-5">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Account Number</label>
                    <input
                      type="text"
                      value={manualAccount.accountNo}
                      onChange={(e) => setManualAccount({...manualAccount, accountNo: e.target.value})}
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none transition-all font-medium"
                      placeholder="Enter 10-digit number"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Account Name</label>
                    <input
                      type="text"
                      value={manualAccount.accountName}
                      onChange={(e) => setManualAccount({...manualAccount, accountName: e.target.value})}
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none transition-all font-medium"
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Amount (₹)</label>
                    <div className="relative">
                      <IndianRupee className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="number"
                        value={manualAccount.amount}
                        onChange={(e) => setManualAccount({...manualAccount, amount: e.target.value})}
                        className="w-full pl-12 pr-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none transition-all font-medium"
                        placeholder="Max 20,000"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={processing}
                    className="w-full py-4 bg-brand text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-brand/90 transition-all shadow-lg shadow-brand/20 hover:shadow-brand/30 hover-lift flex items-center justify-center gap-2"
                  >
                    {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Add Account
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Column: Batch List */}
        <div className="lg:col-span-8">
          <div className="glass-card rounded-[2rem] border border-slate-100 overflow-hidden">
            <div className="p-8 border-b border-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Recent Batches</h3>
                <p className="text-slate-400 text-xs font-medium uppercase tracking-widest mt-1">History of your processed lists</p>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search batches..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs focus:ring-2 focus:ring-brand/20 outline-none w-full sm:w-64 transition-all"
                  />
                </div>
                <div className="relative" ref={exportAllRef}>
                  <button
                    onClick={() => setExportAllOpen(!exportAllOpen)}
                    className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-slate-600 hover:bg-slate-100 transition-all"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                  <AnimatePresence>
                    {exportAllOpen && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-20"
                      >
                        <button
                          onClick={() => { handleExportAllBatches('detailed'); setExportAllOpen(false); }}
                          className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 rounded-xl transition-colors flex items-center gap-2"
                        >
                          <FileText className="w-4 h-4 text-brand" />
                          Export as CSV
                        </button>
                        <button
                          onClick={() => { handleExportAllBatches('portal'); setExportAllOpen(false); }}
                          className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 rounded-xl transition-colors flex items-center gap-2"
                        >
                          <Download className="w-4 h-4 text-red-500" />
                          Export as PDF
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <button
                  onClick={() => setShowDeleteAllConfirm(true)}
                  className="p-2.5 bg-red-50 border border-red-100 rounded-xl text-brand hover:bg-brand hover:text-white transition-all"
                  title="Delete all batches"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Batch Info</th>
                    <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount</th>
                    <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                    <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Reference</th>
                    <th className="px-8 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loadingBatches ? (
                    <tr>
                      <td colSpan={5} className="px-8 py-20 text-center">
                        <Loader2 className="w-10 h-10 animate-spin text-brand mx-auto mb-4" />
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Loading batches...</p>
                      </td>
                    </tr>
                  ) : paginatedBatches.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-8 py-20 text-center">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                          <FileText className="w-10 h-10 text-slate-200" />
                        </div>
                        <p className="text-slate-900 font-bold">No batches found</p>
                        <p className="text-slate-400 text-xs mt-1">Upload a CSV to get started</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedBatches.map((batch) => (
                      <motion.tr 
                        key={batch.id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="hover:bg-slate-50/50 transition-colors group"
                      >
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center font-black text-slate-900 text-xs">
                              #{batch.batchNumber || '-'}
                            </div>
                            <div>
                              <p className="text-sm font-black text-slate-900">Batch {batch.batchNumber || 'N/A'}</p>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                                {batch.accountCount} Accounts • {batch.createdAt?.toDate().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <span className="text-sm font-black text-slate-900">₹{batch.totalAmount.toLocaleString('en-IN')}</span>
                        </td>
                        <td className="px-8 py-6">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${getStatusColor(batch.status)}`}>
                            {getStatusIcon(batch.status)}
                            {batch.status}
                          </span>
                        </td>
                        <td className="px-8 py-6">
                          <span className="text-xs font-bold text-slate-600 font-mono bg-slate-100 px-2 py-1 rounded-lg">
                            {batch.referenceNumber || '---'}
                          </span>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex items-center justify-end gap-2 transition-opacity">
                            <button
                              onClick={() => setSelectedBatch(batch)}
                              className="p-2 text-slate-400 hover:text-brand transition-colors"
                              title="View details"
                            >
                              <FileText className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedBatch(batch);
                                setShowDeleteConfirm(true);
                              }}
                              className="p-2 text-slate-400 hover:text-brand transition-colors"
                              title="Delete batch"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-6 bg-slate-50/50 border-t border-slate-50 flex items-center justify-between">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Showing {((currentPage - 1) * BATCHES_PER_PAGE) + 1} to {Math.min(currentPage * BATCHES_PER_PAGE, filteredBatches.length)} of {filteredBatches.length}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-xl border border-slate-200 text-slate-400 disabled:opacity-30 hover:bg-white transition-all"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                      <button
                        key={`btn-${pageNum}`}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-10 h-10 rounded-xl text-xs font-black transition-all ${
                          currentPage === pageNum 
                            ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20' 
                            : 'text-slate-400 hover:bg-white border border-transparent hover:border-slate-200'
                        }`}
                      >
                        {pageNum}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-xl border border-slate-200 text-slate-400 disabled:opacity-30 hover:bg-white transition-all"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

    {/* Batch Detail Modal */}
      <AnimatePresence>
        {selectedBatch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="flex items-center justify-between p-5 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-900">Batch Details</h3>
                <div className="flex items-center gap-2">
                  {!showDeleteConfirm && (
                    <div className="relative" ref={exportBatchRef}>
                      <button
                        onClick={() => setExportBatchOpen(!exportBatchOpen)}
                        className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full transition-colors"
                        title="Export Batch"
                      >
                        <Download className="w-5 h-5" />
                      </button>
                      {exportBatchOpen && (
                        <div className="absolute right-0 mt-1 w-48 bg-white rounded-xl shadow-lg border border-slate-100 transition-all z-10">
                          <div className="p-1">
                            <button
                              onClick={() => {
                                handleExportBatch('detailed');
                                setExportBatchOpen(false);
                              }}
                              className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                            >
                              Detailed (All Columns)
                            </button>
                            <button
                              onClick={() => {
                                handleExportBatch('portal');
                                setExportBatchOpen(false);
                              }}
                              className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                            >
                              Portal Format (A/C & Amount)
                            </button>
                            <button
                              onClick={() => {
                                handleExportBatch('summary');
                                setExportBatchOpen(false);
                              }}
                              className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                            >
                              Batch Totals Summary
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <button
                    onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
                    className={`p-2 rounded-full transition-colors ${
                      showDeleteConfirm 
                        ? 'text-slate-500 bg-slate-100 hover:bg-slate-200' 
                        : 'text-red-500 hover:text-red-700 hover:bg-red-50'
                    }`}
                    title={showDeleteConfirm ? "Cancel Delete" : "Delete Batch"}
                  >
                    {showDeleteConfirm ? <X className="w-5 h-5" /> : <Trash2 className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={() => {
                      setSelectedBatch(null);
                      setShowDeleteConfirm(false);
                    }}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <div className="p-5 overflow-y-auto flex-1">
                {showDeleteConfirm && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl"
                  >
                    <p className="text-sm text-red-800 font-medium mb-3">
                      Are you sure you want to delete this batch? This action cannot be undone.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleDeleteBatch}
                        disabled={deletingBatch}
                        className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-red-700 transition-colors disabled:opacity-50"
                      >
                        {deletingBatch ? 'Deleting...' : 'Yes, Delete Batch'}
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="flex-1 bg-white text-slate-700 border border-slate-200 py-2 rounded-lg text-sm font-bold hover:bg-slate-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                )}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-sm text-slate-500 font-medium mb-1">Total Amount</p>
                    <p className="text-xl font-bold text-slate-900">₹{selectedBatch.totalAmount.toLocaleString('en-IN')}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-sm text-slate-500 font-medium mb-1">Accounts</p>
                    <p className="text-xl font-bold text-slate-900">{selectedBatch.accountCount}</p>
                  </div>
                </div>

                <form onSubmit={handleUpdateReference} className="mb-6">
                  <label htmlFor="referenceNumber" className="block text-sm font-medium text-slate-700 mb-2">
                    DOP Reference Number
                  </label>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      id="referenceNumber"
                      value={referenceInput}
                      onChange={(e) => setReferenceInput(e.target.value)}
                      placeholder="Enter reference number..."
                      className="flex-1 px-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                    />
                    <button
                      type="submit"
                      disabled={updatingRef || !referenceInput.trim() || referenceInput.trim() === selectedBatch.referenceNumber}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors flex items-center justify-center min-w-[100px]"
                    >
                      {updatingRef ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save'}
                    </button>
                  </div>
                </form>

                <div>
                  <h4 className="text-sm font-semibold text-slate-900 mb-3">Accounts in this batch</h4>
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                        <tr>
                          <th className="px-4 py-3 font-medium w-16">#</th>
                          <th className="px-4 py-3 font-medium">Account No</th>
                          <th className="px-4 py-3 font-medium">Name</th>
                          <th className="px-4 py-3 font-medium">Month Paid Upto</th>
                          <th className="px-4 py-3 font-medium">Next Due Date</th>
                          <th className="px-4 py-3 font-medium text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedBatch.accounts.map((acc, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="px-4 py-2.5 text-slate-500 font-medium">{idx + 1}</td>
                            <td className="px-4 py-2.5 font-mono text-slate-700">{acc.accountNo}</td>
                            <td className="px-4 py-2.5 text-slate-700">{acc.accountName || '-'}</td>
                            <td className="px-4 py-2.5 text-slate-700">{acc.monthPaidUpto || '-'}</td>
                            <td className="px-4 py-2.5 text-slate-700">{acc.nextDueDate || '-'}</td>
                            <td className="px-4 py-2.5 text-right font-medium text-slate-900">₹{acc.amount.toLocaleString('en-IN')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmationModal
        isOpen={showDeleteAllConfirm}
        title="Clear All Batches"
        message="Are you sure you want to delete all your batches? This action cannot be undone."
        confirmText={deletingAll ? "Deleting..." : "Delete All"}
        onConfirm={handleDeleteAllBatches}
        onCancel={() => setShowDeleteAllConfirm(false)}
      />
    </div>
  );
}
