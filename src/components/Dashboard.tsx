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
      case 'completed': return 'bg-success/10 text-success border-success/20';
      case 'processing': return 'bg-info/10 text-info border-info/20';
      case 'failed': return 'bg-brand/10 text-brand border-brand/20';
      default: return 'bg-gold/10 text-gold border-gold/20';
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
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 sm:gap-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mb-2">
            Welcome, <span className="text-brand">{user.displayName || 'Agent'}</span>
          </h1>
          <p className="text-slate-600 font-bold tracking-wide uppercase text-[10px]">
            Manage your RD account batches and collections
          </p>
        </div>
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
          <button
            onClick={() => setShowManualAdd(!showManualAdd)}
            className="flex-1 sm:flex-none justify-center px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm hover:shadow-md hover-lift flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            Manual Entry
          </button>
          <button
            className="flex-1 sm:flex-none justify-center px-6 py-3 bg-brand text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-brand/90 transition-all shadow-lg shadow-brand/20 hover:shadow-brand/30 hover-lift flex items-center gap-2"
            onClick={() => document.getElementById('file-upload')?.click()}
          >
            <Upload className="w-4 h-4" />
            Upload CSV
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card-gold p-5 sm:p-6 rounded-3xl border border-gold/20 shadow-premium group hover:border-brand/40 transition-all hover-lift"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-brand/10 rounded-2xl flex items-center justify-center group-hover:bg-brand/20 transition-colors shadow-inner-light">
              <IndianRupee className="w-5 h-5 sm:w-6 sm:h-6 text-brand" />
            </div>
            <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Total Value</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-success tracking-tight group-hover:text-success transition-colors">
            ₹{savedBatches.reduce((sum, b) => sum + b.totalAmount, 0).toLocaleString('en-IN')}
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card-gold p-5 sm:p-6 rounded-3xl border border-gold/20 shadow-premium group hover:border-gold/40 transition-all hover-lift"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gold/10 rounded-2xl flex items-center justify-center group-hover:bg-gold/20 transition-colors shadow-inner-light">
              <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-gold" />
            </div>
            <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Total Batches</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight group-hover:text-gold transition-colors">
            {savedBatches.length}
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card-gold p-5 sm:p-6 rounded-3xl border border-gold/20 shadow-premium group hover:border-brand/40 transition-all hover-lift"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-brand/10 rounded-2xl flex items-center justify-center group-hover:bg-brand/20 transition-colors shadow-inner-light">
              <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-brand" />
            </div>
            <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Pending</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-info tracking-tight group-hover:text-info transition-colors">
            {savedBatches.filter(b => b.status === 'pending').length}
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-card-gold p-5 sm:p-6 rounded-3xl border border-gold/20 shadow-premium group hover:border-gold/40 transition-all hover-lift"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gold/10 rounded-2xl flex items-center justify-center group-hover:bg-gold/20 transition-colors shadow-inner-light">
              <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-gold" />
            </div>
            <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Completed</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-success tracking-tight group-hover:text-success transition-colors">
            {savedBatches.filter(b => b.status === 'completed').length}
          </div>
        </motion.div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Upload & Actions */}
        <div className="lg:col-span-4 space-y-8">
          {/* File Upload Area */}
          <div className="glass-card-gold p-5 sm:p-8 rounded-[2.5rem] border border-gold/20 relative overflow-hidden shadow-premium group">
            <div className="absolute top-0 right-0 w-48 h-48 bg-brand/5 rounded-full -mr-24 -mt-24 blur-3xl group-hover:bg-brand/10 transition-colors" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-gold/5 rounded-full -ml-24 -mb-24 blur-3xl group-hover:bg-gold/10 transition-colors" />
            
            <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-3">
              <div className="w-10 h-10 bg-brand/10 rounded-xl flex items-center justify-center">
                <Upload className="w-5 h-5 text-brand" />
              </div>
              Upload Batch
            </h3>

            <div 
              className={`relative border-2 border-dashed rounded-[2rem] p-6 sm:p-10 transition-all duration-500 text-center group/drop ${
                file 
                  ? 'border-brand bg-brand/5 shadow-inner' 
                  : 'border-slate-200 hover:border-gold/50 hover:bg-gold/5 hover:shadow-lg hover:shadow-gold/5'
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
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="space-y-4"
                >
                  <div className="w-20 h-20 bg-brand rounded-3xl flex items-center justify-center mx-auto shadow-2xl shadow-brand/30 relative">
                    <FileText className="w-10 h-10 text-white" />
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-success rounded-full flex items-center justify-center shadow-md">
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div>
                    <p className="text-base font-black text-slate-900 truncate max-w-[220px] mx-auto">{file.name}</p>
                    <div className="flex items-center justify-center gap-2 mt-1">
                      <span className="px-2 py-0.5 bg-brand/10 text-brand text-[10px] font-black rounded-md uppercase tracking-tighter">CSV</span>
                      <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleClearFile}
                    className="mt-2 px-4 py-2 text-slate-400 hover:text-brand hover:bg-brand/5 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest flex items-center gap-2 mx-auto"
                  >
                    <Trash2 className="w-4 h-4" />
                    Remove File
                  </button>
                </motion.div>
              ) : (
                <div className="space-y-4">
                  <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto group-hover/drop:bg-white group-hover/drop:shadow-xl group-hover/drop:scale-110 transition-all duration-500">
                    <Upload className="w-10 h-10 text-slate-300 group-hover/drop:text-gold transition-colors" />
                  </div>
                  <div>
                    <p className="text-base font-black text-slate-900">Drop your CSV here</p>
                    <p className="text-xs font-bold text-slate-500 mt-1">or click to browse files</p>
                  </div>
                  <button 
                    onClick={() => document.getElementById('file-upload')?.click()}
                    className="px-6 py-2.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-brand uppercase tracking-widest hover:border-brand hover:bg-brand/5 transition-all shadow-sm"
                  >
                    Select File
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={processFile}
              disabled={!file || processing}
              className={`w-full mt-8 py-5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3 relative overflow-hidden group/btn ${
                !file || processing
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-slate-900 text-white shadow-2xl shadow-slate-900/30 hover:shadow-slate-900/40 hover-lift'
              }`}
            >
              {processing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <div className="absolute inset-0 bg-gradient-to-r from-brand/0 via-white/10 to-brand/0 -translate-x-full group-hover/btn:animate-shimmer" />
                  <RefreshCw className="w-5 h-5 group-hover/btn:rotate-180 transition-transform duration-700" />
                  Process Batch
                </>
              )}
            </button>
          </div>

          {/* Manual Entry Form */}
          <AnimatePresence>
            {showManualAdd && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="glass-card-gold p-5 sm:p-8 rounded-[2.5rem] border border-gold/20 overflow-hidden shadow-premium"
              >
                <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-3">
                  <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
                    <FileText className="w-5 h-5 text-gold" />
                  </div>
                  Manual Entry
                </h3>
                <form onSubmit={handleManualAdd} className="space-y-6">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Account Number</label>
                    <input
                      type="text"
                      value={manualAccount.accountNo}
                      onChange={(e) => setManualAccount({...manualAccount, accountNo: e.target.value})}
                      className="w-full px-4 sm:px-6 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-brand/10 focus:border-brand outline-none transition-all shadow-sm"
                      placeholder="Enter 10-digit number"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Account Name</label>
                    <input
                      type="text"
                      value={manualAccount.accountName}
                      onChange={(e) => setManualAccount({...manualAccount, accountName: e.target.value})}
                      className="w-full px-4 sm:px-6 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-brand/10 focus:border-brand outline-none transition-all shadow-sm"
                      placeholder="Optional"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Amount (₹)</label>
                    <div className="relative group">
                      <div className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-brand transition-colors">
                        <IndianRupee className="w-full h-full" />
                      </div>
                      <input
                        type="number"
                        value={manualAccount.amount}
                        onChange={(e) => setManualAccount({...manualAccount, amount: e.target.value})}
                        className="w-full pl-12 sm:pl-14 pr-4 sm:pr-6 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-brand/10 focus:border-brand outline-none transition-all shadow-sm"
                        placeholder="Max 20,000"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={processing}
                    className="w-full py-5 bg-brand text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-brand/90 transition-all shadow-xl shadow-brand/20 hover:shadow-brand/30 hover-lift flex items-center justify-center gap-3"
                  >
                    {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                    Add Account
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Column: Batch List */}
        <div className="lg:col-span-8">
          <div className="glass-card-gold rounded-[2.5rem] border border-gold/20 overflow-hidden shadow-premium">
            <div className="p-6 sm:p-10 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-6 sm:gap-8 bg-gradient-to-br from-gold/5 to-transparent">
              <div>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-3 sm:gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-brand/10 rounded-2xl flex items-center justify-center shadow-inner-light shrink-0">
                    <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-brand" />
                  </div>
                  Recent Batches
                </h3>
                <p className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest mt-2 ml-14 sm:ml-16">
                  {filteredBatches.length} batches found
                </p>
              </div>
              
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-4 w-full sm:w-auto">
                <div className="relative group w-full sm:w-auto flex-1 sm:flex-none">
                  <Search className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-brand transition-colors" />
                  <input
                    type="text"
                    placeholder="Search batch or account..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 sm:pl-12 pr-4 sm:pr-6 py-3 sm:py-4 bg-white border border-slate-200 rounded-2xl text-xs font-bold focus:ring-4 focus:ring-brand/10 focus:border-brand outline-none transition-all w-full sm:w-72 shadow-sm"
                  />
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="relative" ref={exportAllRef}>
                    <button
                      onClick={() => setExportAllOpen(!exportAllOpen)}
                      className="p-3 sm:p-4 bg-white border border-slate-200 text-slate-600 rounded-2xl hover:bg-gold/5 hover:border-gold/30 transition-all shadow-sm hover:shadow-md active:scale-95"
                      title="Export All"
                    >
                      <Download className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>
                    <AnimatePresence>
                      {exportAllOpen && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: 10 }}
                          className="absolute right-0 sm:right-0 -right-12 mt-3 w-64 bg-white border border-gold/10 rounded-3xl shadow-premium z-20 p-3"
                        >
                          <div className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 mb-2">Export All Batches</div>
                          <button onClick={() => { handleExportAllBatches('detailed'); setExportAllOpen(false); }} className="w-full text-left px-4 py-4 text-xs font-black text-slate-700 hover:bg-brand/5 rounded-2xl transition-all flex items-center gap-4 group">
                            <div className="w-3 h-3 rounded-full bg-brand shadow-sm group-hover:scale-125 transition-transform" /> Detailed Report
                          </button>
                          <button onClick={() => { handleExportAllBatches('portal'); setExportAllOpen(false); }} className="w-full text-left px-4 py-4 text-xs font-black text-slate-700 hover:bg-gold/5 rounded-2xl transition-all flex items-center gap-4 group">
                            <div className="w-3 h-3 rounded-full bg-gold shadow-sm group-hover:scale-125 transition-transform" /> Portal Format
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <button
                    onClick={() => setShowDeleteAllConfirm(true)}
                    className="p-3 sm:p-4 bg-white border border-slate-200 text-slate-400 hover:text-brand hover:bg-red-50 hover:border-brand/30 rounded-2xl transition-all shadow-sm hover:shadow-md active:scale-95"
                    title="Delete All"
                  >
                    <Trash2 className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                </div>
              </div>
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100">
                    <th className="px-10 py-8 text-left">
                      <button onClick={() => setSortOption('date')} className="flex items-center gap-3 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-brand transition-colors group">
                        Date & Time <ArrowUpDown className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                      </button>
                    </th>
                    <th className="px-10 py-8 text-left">
                      <button onClick={() => setSortOption('count')} className="flex items-center gap-3 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-brand transition-colors group">
                        Accounts <ArrowUpDown className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                      </button>
                    </th>
                    <th className="px-10 py-8 text-left">
                      <button onClick={() => setSortOption('amount')} className="flex items-center gap-3 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-brand transition-colors group">
                        Amount <ArrowUpDown className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                      </button>
                    </th>
                    <th className="px-10 py-8 text-left">
                      <button onClick={() => setSortOption('status')} className="flex items-center gap-3 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-brand transition-colors group">
                        Status <ArrowUpDown className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                      </button>
                    </th>
                    <th className="px-10 py-8 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loadingBatches ? (
                    <tr>
                      <td colSpan={5} className="px-10 py-32 text-center">
                        <div className="relative w-20 h-20 mx-auto mb-6">
                          <div className="absolute inset-0 border-4 border-brand/10 rounded-full" />
                          <div className="absolute inset-0 border-4 border-brand border-t-transparent rounded-full animate-spin" />
                          <div className="absolute inset-4 border-4 border-gold/20 border-b-transparent rounded-full animate-spin-reverse" />
                        </div>
                        <p className="text-slate-600 text-[11px] font-black uppercase tracking-widest">Loading batches...</p>
                      </td>
                    </tr>
                  ) : paginatedBatches.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-10 py-32 text-center">
                        <div className="w-28 h-28 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-inner relative">
                          <FileText className="w-14 h-14 text-slate-200" />
                          <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-white rounded-2xl shadow-md flex items-center justify-center">
                            <Search className="w-5 h-5 text-slate-300" />
                          </div>
                        </div>
                        <p className="text-2xl font-black text-slate-900 tracking-tight">No batches found</p>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-3">Upload a CSV to get started</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedBatches.map((batch) => (
                      <motion.tr 
                        key={`${batch.id}-desktop`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="group hover:bg-gold/5 transition-all cursor-pointer relative"
                        onClick={() => setSelectedBatch(batch)}
                      >
                        <td className="px-10 py-10">
                          <div className="flex flex-col">
                            <span className="text-base font-black text-slate-900 tracking-tight group-hover:text-brand transition-colors">
                              {batch.createdAt?.toMillis ? new Date(batch.createdAt.toMillis()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Just now'}
                            </span>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5 flex items-center gap-2">
                              <Clock className="w-3 h-3" />
                              {batch.createdAt?.toMillis ? new Date(batch.createdAt.toMillis()).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                          </div>
                        </td>
                        <td className="px-10 py-10">
                          <div className="flex items-center gap-5">
                            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-sm font-black text-slate-900 shadow-sm group-hover:bg-white group-hover:shadow-md transition-all">
                              {batch.accountCount}
                            </div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Records</span>
                          </div>
                        </td>
                        <td className="px-10 py-10">
                          <div className="flex flex-col">
                            <span className="text-lg font-black text-success tracking-tight">
                              ₹{batch.totalAmount.toLocaleString('en-IN')}
                            </span>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Total Value</span>
                          </div>
                        </td>
                        <td className="px-10 py-10">
                          <div className={`inline-flex items-center gap-2.5 px-5 py-2.5 rounded-2xl border text-[10px] font-black uppercase tracking-widest shadow-sm transition-all group-hover:shadow-md ${getStatusColor(batch.status)}`}>
                            {getStatusIcon(batch.status)}
                            {batch.status}
                          </div>
                        </td>
                        <td className="px-10 py-8 text-right">
                          <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                            <button 
                              onClick={(e) => { e.stopPropagation(); setSelectedBatch(batch); }}
                              className="p-3 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-brand hover:text-white hover:border-brand transition-all shadow-sm active:scale-90"
                            >
                              <FileText className="w-5 h-5" />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden flex flex-col divide-y divide-slate-100">
              {loadingBatches ? (
                <div className="p-10 text-center">
                  <div className="relative w-16 h-16 mx-auto mb-4">
                    <div className="absolute inset-0 border-4 border-brand/10 rounded-full" />
                    <div className="absolute inset-0 border-4 border-brand border-t-transparent rounded-full animate-spin" />
                  </div>
                  <p className="text-slate-600 text-[11px] font-black uppercase tracking-widest">Loading batches...</p>
                </div>
              ) : paginatedBatches.length === 0 ? (
                <div className="p-10 text-center">
                  <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-inner">
                    <FileText className="w-10 h-10 text-slate-200" />
                  </div>
                  <p className="text-xl font-black text-slate-900 tracking-tight">No batches found</p>
                </div>
              ) : (
                paginatedBatches.map((batch) => (
                  <div 
                    key={`${batch.id}-mobile`}
                    className="p-5 hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => setSelectedBatch(batch)}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <span className="text-sm font-black text-slate-900 tracking-tight">
                          {batch.createdAt?.toMillis ? new Date(batch.createdAt.toMillis()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Just now'}
                        </span>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {batch.createdAt?.toMillis ? new Date(batch.createdAt.toMillis()).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[9px] font-black uppercase tracking-widest shadow-sm ${getStatusColor(batch.status)}`}>
                        {getStatusIcon(batch.status)}
                        {batch.status}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between mt-4 bg-slate-50 p-3 rounded-2xl">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-sm font-black text-slate-900 shadow-sm">
                          {batch.accountCount}
                        </div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Records</span>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Total Value</span>
                        <span className="text-base font-black text-success tracking-tight">
                          ₹{batch.totalAmount.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-4 sm:p-6 bg-slate-50/80 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest text-center sm:text-left">
                  Showing {((currentPage - 1) * BATCHES_PER_PAGE) + 1} to {Math.min(currentPage * BATCHES_PER_PAGE, filteredBatches.length)} of {filteredBatches.length}
                </p>
                <div className="flex items-center gap-2 flex-wrap justify-center">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="p-2 sm:p-3 rounded-xl border border-slate-200 text-slate-600 disabled:opacity-30 hover:bg-white transition-all shadow-sm"
                  >
                    <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                  <div className="flex items-center gap-1 flex-wrap justify-center">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                      <button
                        key={`btn-${pageNum}`}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl text-xs font-black transition-all ${
                          currentPage === pageNum 
                            ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20' 
                            : 'text-slate-500 hover:bg-white border border-slate-200 hover:border-brand/20 hover:text-brand'
                        }`}
                      >
                        {pageNum}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 sm:p-3 rounded-xl border border-slate-200 text-slate-600 disabled:opacity-30 hover:bg-white transition-all shadow-sm"
                  >
                    <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
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
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setSelectedBatch(null); setShowDeleteConfirm(false); }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              className="glass-card-gold rounded-[2.5rem] shadow-premium w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] relative z-10 border border-gold/30"
            >
              {/* Modal Header */}
              <div className="p-6 sm:p-8 border-b border-gold/20 bg-gradient-to-br from-gold/10 via-white to-transparent flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4 sm:gap-5 w-full sm:w-auto">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-gold/30 to-gold/10 rounded-2xl flex items-center justify-center shadow-gold/20 shadow-lg border border-gold/20 shrink-0">
                    <FileText className="w-6 h-6 sm:w-7 sm:h-7 text-gold" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-none mb-2">Batch Details</h3>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-500 rounded-lg text-[9px] font-black uppercase tracking-widest border border-slate-200">
                        ID: {selectedBatch.id.slice(-12)}
                      </span>
                      {selectedBatch.batchNumber && (
                        <span className="px-2.5 py-1 bg-gold/10 text-gold rounded-lg text-[9px] font-black uppercase tracking-widest border border-gold/20">
                          Batch #{selectedBatch.batchNumber}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 self-end sm:self-auto w-full sm:w-auto justify-end">
                  {!showDeleteConfirm && (
                    <div className="relative" ref={exportBatchRef}>
                      <button
                        onClick={() => setExportBatchOpen(!exportBatchOpen)}
                        className="p-3 sm:p-4 bg-white border border-gold/30 text-gold rounded-2xl hover:bg-gold/5 transition-all shadow-sm hover:shadow-gold/10 hover:shadow-lg active:scale-95"
                        title="Export Batch"
                      >
                        <Download className="w-5 h-5 sm:w-6 sm:h-6" />
                      </button>
                      <AnimatePresence>
                        {exportBatchOpen && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="absolute right-0 mt-3 w-64 bg-white border border-gold/10 rounded-3xl shadow-premium z-20 p-3 overflow-hidden"
                          >
                            <div className="px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 mb-2">Export Options</div>
                            <button onClick={() => { handleExportBatch('detailed'); setExportBatchOpen(false); }} className="w-full text-left px-4 py-4 text-xs font-black text-slate-700 hover:bg-brand/5 rounded-2xl transition-all flex items-center gap-4 group">
                              <div className="w-3 h-3 rounded-full bg-brand shadow-sm group-hover:scale-125 transition-transform" /> 
                              <span>Detailed Report</span>
                            </button>
                            <button onClick={() => { handleExportBatch('portal'); setExportBatchOpen(false); }} className="w-full text-left px-4 py-4 text-xs font-black text-slate-700 hover:bg-gold/5 rounded-2xl transition-all flex items-center gap-4 group">
                              <div className="w-3 h-3 rounded-full bg-gold shadow-sm group-hover:scale-125 transition-transform" /> 
                              <span>Portal Format</span>
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                  <button
                    onClick={() => { setSelectedBatch(null); setShowDeleteConfirm(false); }}
                    className="p-3 sm:p-4 bg-slate-100 text-slate-400 rounded-2xl hover:bg-slate-200 hover:text-slate-600 transition-all shadow-sm active:scale-95"
                  >
                    <X className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                </div>
              </div>
              
              <div className="p-8 overflow-y-auto flex-1 space-y-8 custom-scrollbar bg-slate-50/30">
                {showDeleteConfirm && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="p-6 bg-red-50 border border-red-100 rounded-3xl"
                  >
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
                        <Trash2 className="w-5 h-5 text-brand" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-1">Confirm Deletion</h4>
                        <p className="text-xs font-bold text-slate-600">Are you sure you want to delete this batch? This action cannot be undone.</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={handleDeleteBatch}
                        disabled={deletingBatch}
                        className="flex-1 bg-brand text-white py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-brand/90 transition-all shadow-lg shadow-brand/20 disabled:opacity-50"
                      >
                        {deletingBatch ? 'Deleting...' : 'Yes, Delete Batch'}
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="flex-1 bg-white text-slate-700 border border-slate-200 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                )}
                {/* Status & Summary Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                  <div className="bg-white p-5 sm:p-6 rounded-[2rem] border border-gold/10 shadow-sm hover:shadow-premium transition-all hover-lift">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-info shadow-info/20 shadow-lg" />
                      Status
                    </div>
                    <div className={`inline-flex items-center gap-2.5 px-4 sm:px-5 py-2 sm:py-2.5 rounded-2xl border text-[10px] font-black uppercase tracking-widest shadow-sm ${getStatusColor(selectedBatch.status)}`}>
                      {getStatusIcon(selectedBatch.status)}
                      {selectedBatch.status}
                    </div>
                  </div>
                  <div className="bg-white p-5 sm:p-6 rounded-[2rem] border border-gold/10 shadow-sm hover:shadow-premium transition-all hover-lift">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-success shadow-success/20 shadow-lg" />
                      Total Amount
                    </div>
                    <p className="text-2xl sm:text-3xl font-black text-success tracking-tight flex items-baseline gap-1">
                      <span className="text-sm">₹</span>
                      {selectedBatch.totalAmount.toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div className="bg-white p-5 sm:p-6 rounded-[2rem] border border-gold/10 shadow-sm hover:shadow-premium transition-all hover-lift">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-gold shadow-gold/20 shadow-lg" />
                      Accounts
                    </div>
                    <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{selectedBatch.accountCount}</p>
                  </div>
                </div>

                {/* Reference Number Update */}
                <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] border border-gold/10 shadow-premium-hover relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gold/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-gold/10 transition-colors" />
                  <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest mb-5 flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-brand shadow-brand/20 shadow-lg" />
                    DOP Reference Number
                  </h4>
                  <form onSubmit={handleUpdateReference} className="flex flex-col sm:flex-row gap-4 relative z-10 w-full">
                    <div className="flex-1 relative w-full">
                      <input
                        type="text"
                        value={referenceInput}
                        onChange={(e) => setReferenceInput(e.target.value)}
                        placeholder="Enter reference number..."
                        className="w-full px-4 sm:px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-gold/10 focus:border-gold focus:bg-white outline-none transition-all placeholder:text-slate-400"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={updatingRef || !referenceInput.trim() || referenceInput.trim() === selectedBatch.referenceNumber}
                      className="w-full sm:w-auto px-8 py-4 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20 disabled:opacity-30 disabled:shadow-none flex items-center justify-center min-w-[140px] active:scale-95"
                    >
                      {updatingRef ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Update Reference'}
                    </button>
                  </form>
                </div>

                {/* Account List */}
                <div className="space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between px-2 gap-3">
                    <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-gold shadow-gold/20 shadow-lg" />
                      Account Details
                    </h4>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-full self-start sm:self-auto">
                      {selectedBatch.accounts.length} Records
                    </span>
                  </div>
                  <div className="bg-white border border-slate-100 rounded-[2.5rem] overflow-hidden shadow-premium">
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-sm text-left whitespace-nowrap">
                        <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-500">
                          <tr>
                            <th className="px-8 py-5 font-black uppercase tracking-widest text-[9px] w-16">#</th>
                            <th className="px-8 py-5 font-black uppercase tracking-widest text-[9px]">Account Number</th>
                            <th className="px-8 py-5 font-black uppercase tracking-widest text-[9px]">Holder Name</th>
                            <th className="px-8 py-5 font-black uppercase tracking-widest text-[9px]">Paid Upto</th>
                            <th className="px-8 py-5 font-black uppercase tracking-widest text-[9px]">Next Due</th>
                            <th className="px-8 py-5 font-black uppercase tracking-widest text-[9px] text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {selectedBatch.accounts.map((acc, idx) => (
                            <tr key={`${idx}-desktop`} className="hover:bg-gold/5 transition-all group/row cursor-default">
                              <td className="px-8 py-5 text-slate-400 font-black text-[10px]">{String(idx + 1).padStart(2, '0')}</td>
                              <td className="px-8 py-5 font-mono text-slate-900 font-black tracking-tight group-hover/row:text-brand transition-colors">{acc.accountNo}</td>
                              <td className="px-8 py-5 text-slate-700 font-bold">{acc.accountName || '-'}</td>
                              <td className="px-8 py-5">
                                <span className="px-2.5 py-1 bg-info/10 text-info rounded-lg text-[9px] font-black uppercase tracking-widest border border-info/10">
                                  {acc.monthPaidUpto || '-'}
                                </span>
                              </td>
                              <td className="px-8 py-5">
                                <span className="px-2.5 py-1 bg-amber-100/50 text-amber-700 rounded-lg text-[9px] font-black uppercase tracking-widest border border-amber-200/50">
                                  {acc.nextDueDate || '-'}
                                </span>
                              </td>
                              <td className="px-8 py-5 text-right font-black text-success text-base group-hover/row:scale-105 transition-transform origin-right">
                                ₹{acc.amount.toLocaleString('en-IN')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden flex flex-col divide-y divide-slate-100">
                      {selectedBatch.accounts.map((acc, idx) => (
                        <div key={`${idx}-mobile`} className="p-4 hover:bg-slate-50 transition-colors">
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-400 font-black text-[10px]">{String(idx + 1).padStart(2, '0')}</span>
                              <span className="font-mono text-slate-900 font-black tracking-tight">{acc.accountNo}</span>
                            </div>
                            <span className="font-black text-success text-base">₹{acc.amount.toLocaleString('en-IN')}</span>
                          </div>
                          <div className="text-slate-700 font-bold text-sm mb-3">{acc.accountName || 'No Name'}</div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2 py-1 bg-info/10 text-info rounded-lg text-[9px] font-black uppercase tracking-widest border border-info/10">
                              Paid: {acc.monthPaidUpto || '-'}
                            </span>
                            <span className="px-2 py-1 bg-amber-100/50 text-amber-700 rounded-lg text-[9px] font-black uppercase tracking-widest border border-amber-200/50">
                              Due: {acc.nextDueDate || '-'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-6 sm:p-8 border-t border-slate-100 bg-white flex flex-col sm:flex-row items-center justify-between gap-4">
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full sm:w-auto flex items-center justify-center gap-3 px-6 py-4 text-red-500 hover:bg-red-50 rounded-2xl transition-all text-[11px] font-black uppercase tracking-widest group order-2 sm:order-1"
                >
                  <Trash2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  Delete Batch
                </button>
                <div className="w-full sm:w-auto flex gap-4 order-1 sm:order-2">
                  <button
                    onClick={() => { setSelectedBatch(null); setShowDeleteConfirm(false); }}
                    className="w-full sm:w-auto px-10 py-4 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20 active:scale-95"
                  >
                    Close Details
                  </button>
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
