import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, serverTimestamp, orderBy, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { User } from 'firebase/auth';
import { Calendar, CheckCircle2, Circle, IndianRupee, Loader2, Plus, Search, User as UserIcon, Trash2, X, Upload, Star, FileDown, RotateCcw } from 'lucide-react';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ConfirmationModal from './ConfirmationModal';
import CustomCalendar from './CustomCalendar';

interface Customer {
  id: string;
  accountNo: string;
  accountName: string;
  defaultAmount: number;
  isFavorite?: boolean;
}

interface CollectionRecord {
  id: string;
  accountNo: string;
  amount: number;
  collectionDate: string;
  installmentMonths: number;
}

interface CollectionTrackerProps {
  user: User;
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export default function CollectionTracker({ user, addToast }: CollectionTrackerProps) {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [collections, setCollections] = useState<CollectionRecord[]>([]);
  const [monthlyCollections, setMonthlyCollections] = useState<CollectionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Add Customer Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAccountNo, setNewAccountNo] = useState('');
  const [newAccountName, setNewAccountName] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [uploadingCSV, setUploadingCSV] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete Confirmation State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<string | null>(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Loading states for individual checkboxes
  const [processingAccounts, setProcessingAccounts] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchData();
  }, [user.uid, selectedDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch Customers
      const customersRef = collection(db, 'customers');
      const qCustomers = query(customersRef, where('agentId', '==', user.uid), orderBy('createdAt', 'desc'));
      const customerSnap = await getDocs(qCustomers);
      const customerData = customerSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
      setCustomers(customerData);

      // Fetch Collections for selected date
      const collectionsRef = collection(db, 'collections');
      const qCollections = query(
        collectionsRef, 
        where('agentId', '==', user.uid),
        where('collectionDate', '==', selectedDate)
      );
      const collectionSnap = await getDocs(qCollections);
      const collectionData = collectionSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CollectionRecord));
      setCollections(collectionData);

      // Fetch Collections for the entire month
      const currentMonthPrefix = selectedDate.substring(0, 7);
      const startOfMonth = `${currentMonthPrefix}-01`;
      const endOfMonth = `${currentMonthPrefix}-31`;
      
      const qMonthlyCollections = query(
        collectionsRef,
        where('agentId', '==', user.uid),
        where('collectionDate', '>=', startOfMonth),
        where('collectionDate', '<=', endOfMonth)
      );
      const monthlySnap = await getDocs(qMonthlyCollections);
      const monthlyData = monthlySnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CollectionRecord));
      setMonthlyCollections(monthlyData);
    } catch (error) {
      console.error("Error fetching collection data:", error);
      addToast("Failed to load collection data", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountNo || !newAmount) {
      addToast("Account Number and Amount are required", "error");
      return;
    }

    setAddingCustomer(true);
    try {
      const docRef = await addDoc(collection(db, 'customers'), {
        agentId: user.uid,
        accountNo: newAccountNo,
        accountName: newAccountName || '',
        defaultAmount: Number(newAmount),
        isFavorite: false,
        createdAt: serverTimestamp()
      });

      const newCustomer: Customer = {
        id: docRef.id,
        accountNo: newAccountNo,
        accountName: newAccountName,
        defaultAmount: Number(newAmount),
        isFavorite: false
      };

      setCustomers([newCustomer, ...customers]);
      setShowAddModal(false);
      setNewAccountNo('');
      setNewAccountName('');
      setNewAmount('');
      addToast("Account added successfully", "success");
    } catch (error) {
      console.error("Error adding customer:", error);
      addToast("Failed to add account", "error");
    } finally {
      setAddingCustomer(false);
    }
  };

  const toggleCollection = async (customer: Customer, months: number = 1) => {
    if (processingAccounts.has(customer.accountNo)) return;

    setProcessingAccounts(prev => new Set(prev).add(customer.accountNo));

    const existingCollection = collections.find(c => c.accountNo === customer.accountNo);

    try {
      if (existingCollection) {
        // Un-tick: Delete collection
        await deleteDoc(doc(db, 'collections', existingCollection.id));
        setCollections(collections.filter(c => c.id !== existingCollection.id));
        setMonthlyCollections(monthlyCollections.filter(c => c.id !== existingCollection.id));
      } else {
        // Tick: Add collection
        const totalAmount = customer.defaultAmount * months;
        const docRef = await addDoc(collection(db, 'collections'), {
          agentId: user.uid,
          accountNo: customer.accountNo,
          amount: totalAmount,
          collectionDate: selectedDate,
          installmentMonths: months,
          createdAt: serverTimestamp()
        });
        
        const newRecord = {
          id: docRef.id,
          accountNo: customer.accountNo,
          amount: totalAmount,
          collectionDate: selectedDate,
          installmentMonths: months
        };
        
        setCollections([...collections, newRecord]);
        setMonthlyCollections([...monthlyCollections, newRecord]);
      }
    } catch (error) {
      console.error("Error toggling collection:", error);
      addToast("Failed to update collection status", "error");
    } finally {
      setProcessingAccounts(prev => {
        const next = new Set(prev);
        next.delete(customer.accountNo);
        return next;
      });
    }
  };

  const toggleFavorite = async (e: React.MouseEvent, customer: Customer) => {
    e.stopPropagation();
    try {
      const customerRef = doc(db, 'customers', customer.id);
      const newFavoriteStatus = !customer.isFavorite;
      
      // Update local state optimistically
      setCustomers(customers.map(c => 
        c.id === customer.id ? { ...c, isFavorite: newFavoriteStatus } : c
      ));

      // Update in Firestore
      const { updateDoc } = await import('firebase/firestore');
      await updateDoc(customerRef, {
        isFavorite: newFavoriteStatus
      });
      
      addToast(newFavoriteStatus ? "Added to favorites" : "Removed from favorites", "success");
    } catch (error) {
      console.error("Error toggling favorite:", error);
      // Revert local state on error
      setCustomers(customers.map(c => 
        c.id === customer.id ? { ...c, isFavorite: customer.isFavorite } : c
      ));
      addToast("Failed to update favorite status", "error");
    }
  };

  const handleDeleteCustomer = (customerId: string) => {
    setCustomerToDelete(customerId);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteCustomer = async () => {
    if (!customerToDelete) return;
    
    const customer = customers.find(c => c.id === customerToDelete);
    if (!customer) {
      setShowDeleteConfirm(false);
      setCustomerToDelete(null);
      return;
    }

    try {
      const batch = writeBatch(db);
      
      // Delete the customer document
      batch.delete(doc(db, 'customers', customerToDelete));
      
      // Find and delete all collection records for this customer
      const collectionsQuery = query(
        collection(db, 'collections'), 
        where('agentId', '==', user.uid),
        where('accountNo', '==', customer.accountNo)
      );
      const collectionsSnap = await getDocs(collectionsQuery);
      
      collectionsSnap.docs.forEach(docSnap => {
        batch.delete(docSnap.ref);
      });

      await batch.commit();

      setCustomers(customers.filter(c => c.id !== customerToDelete));
      setCollections(collections.filter(c => c.accountNo !== customer.accountNo));
      setMonthlyCollections(monthlyCollections.filter(c => c.accountNo !== customer.accountNo));
      
      addToast("Account and records removed", "success");
    } catch (error) {
      console.error("Error deleting customer:", error);
      addToast("Failed to remove account", "error");
    } finally {
      setShowDeleteConfirm(false);
      setCustomerToDelete(null);
    }
  };

  const handleDeleteAllCustomers = () => {
    setShowDeleteAllConfirm(true);
  };

  const handleResetDailyCollection = () => {
    if (collections.length === 0) {
      addToast("No collections to reset for this date", "info");
      return;
    }
    setShowResetConfirm(true);
  };

  const confirmResetDailyCollection = async () => {
    setLoading(true);
    setShowResetConfirm(false);
    try {
      const collectionChunks = [];
      for (let i = 0; i < collections.length; i += 500) {
        collectionChunks.push(collections.slice(i, i + 500));
      }

      for (const chunk of collectionChunks) {
        const batch = writeBatch(db);
        chunk.forEach(c => {
          batch.delete(doc(db, 'collections', c.id));
        });
        await batch.commit();
      }

      const dailyIds = new Set(collections.map(c => c.id));
      setMonthlyCollections(monthlyCollections.filter(c => !dailyIds.has(c.id)));
      setCollections([]);
      
      addToast("Daily collection reset successfully", "success");
    } catch (error) {
      console.error("Error resetting daily collection:", error);
      addToast("Failed to reset collection", "error");
    } finally {
      setLoading(false);
    }
  };

  const confirmDeleteAllCustomers = async () => {
    setLoading(true);
    setShowDeleteAllConfirm(false);
    try {
      // 1. Delete all customers
      const customerChunks = [];
      for (let i = 0; i < customers.length; i += 500) {
        customerChunks.push(customers.slice(i, i + 500));
      }
      
      for (const chunk of customerChunks) {
        const batch = writeBatch(db);
        chunk.forEach(c => {
          batch.delete(doc(db, 'customers', c.id));
        });
        await batch.commit();
      }

      // 2. Delete all collections for this agent
      const collectionsQuery = query(collection(db, 'collections'), where('agentId', '==', user.uid));
      const collectionsSnap = await getDocs(collectionsQuery);
      
      const collectionChunks = [];
      for (let i = 0; i < collectionsSnap.docs.length; i += 500) {
        collectionChunks.push(collectionsSnap.docs.slice(i, i + 500));
      }

      for (const chunk of collectionChunks) {
        const batch = writeBatch(db);
        chunk.forEach(docSnap => {
          batch.delete(docSnap.ref);
        });
        await batch.commit();
      }
      
      setCustomers([]);
      setCollections([]);
      setMonthlyCollections([]);
      addToast("All accounts and records deleted successfully", "success");
    } catch (error) {
      console.error("Error deleting all customers:", error);
      addToast("Failed to delete all accounts", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingCSV(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const batch = writeBatch(db);
          const newCustomers: Customer[] = [];
          let addedCount = 0;

          results.data.forEach((row: any) => {
            // Find keys case-insensitively to handle different CSV formats
            const keys = Object.keys(row);
            const getVal = (searchTerms: string[]) => {
              const key = keys.find(k => searchTerms.some(term => k.toLowerCase().includes(term)));
              return key ? row[key] : undefined;
            };

            const accountNo = getVal(['account', 'a/c', 'acc']) || Object.values(row)[0];
            const accountName = getVal(['name', 'customer']) || '';
            const amountStr = getVal(['amount', 'denomination', 'value']) || Object.values(row)[1] || Object.values(row)[2];
            
            const amount = parseFloat(String(amountStr || '0').replace(/[^0-9.]/g, ''));
            const acctStr = String(accountNo || '').trim();

            if (acctStr && !isNaN(amount) && amount > 0) {
              // Check if account already exists in current list or in the new batch
              if (!customers.some(c => c.accountNo === acctStr) && !newCustomers.some(c => c.accountNo === acctStr)) {
                const docRef = doc(collection(db, 'customers'));
                batch.set(docRef, {
                  agentId: user.uid,
                  accountNo: acctStr,
                  accountName: String(accountName).trim(),
                  defaultAmount: amount,
                  isFavorite: false,
                  createdAt: serverTimestamp()
                });
                newCustomers.push({
                  id: docRef.id,
                  accountNo: acctStr,
                  accountName: String(accountName).trim(),
                  defaultAmount: amount,
                  isFavorite: false
                });
                addedCount++;
              }
            }
          });

          if (addedCount > 0) {
            await batch.commit();
            setCustomers(prev => [...newCustomers, ...prev]);
            addToast(`Successfully imported ${addedCount} accounts`, "success");
          } else {
            addToast("No valid new accounts found in CSV", "info");
          }
        } catch (error) {
          console.error("Error importing CSV:", error);
          addToast("Failed to import accounts", "error");
        } finally {
          setUploadingCSV(false);
          if (e.target) e.target.value = ''; // reset input
        }
      },
      error: (error) => {
        console.error("CSV Parse Error:", error);
        addToast("Failed to parse CSV file", "error");
        setUploadingCSV(false);
        if (e.target) e.target.value = '';
      }
    });
  };

  const filteredCustomers = customers
    .filter(c => 
      c.accountNo.includes(searchTerm) || 
      c.accountName.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      // Sort favorites first
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      return 0;
    });

  const totalCollected = collections.reduce((sum, c) => sum + c.amount, 0);
  const monthlyTotalCollected = monthlyCollections.reduce((sum, c) => sum + c.amount, 0);

  const handleDownloadPDF = () => {
    if (collections.length === 0) {
      addToast("No collections to download for this date", "info");
      return;
    }

    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(18);
    doc.text('Daily Collection Report', 14, 22);
    
    // Date and Total
    doc.setFontSize(12);
    doc.text(`Date: ${selectedDate}`, 14, 32);
    doc.text(`Total Collection: Rs. ${totalCollected.toLocaleString()}`, 14, 40);
    doc.text(`Total Accounts: ${collections.length}`, 14, 48);

    // Prepare table data
    const tableColumn = ["#", "Account No.", "Name", "Amount (Rs.)", "Months"];
    const tableRows = collections.map((collection, index) => {
      const customer = customers.find(c => c.accountNo === collection.accountNo);
      return [
        index + 1,
        collection.accountNo,
        customer?.accountName || '-',
        collection.amount.toLocaleString(),
        collection.installmentMonths || 1
      ];
    });

    autoTable(doc, {
      startY: 55,
      head: [tableColumn],
      body: tableRows,
      theme: 'striped',
      headStyles: { fillColor: [220, 38, 38] }, // India Post Red
    });

    doc.save(`Collection_Report_${selectedDate}.pdf`);
  };

  const handleDownloadMonthlyPDF = () => {
    if (monthlyCollections.length === 0) {
      addToast("No collections to download for this month", "info");
      return;
    }

    const doc = new jsPDF();
    const monthName = new Date(selectedDate).toLocaleString('default', { month: 'long', year: 'numeric' });
    
    // Title
    doc.setFontSize(18);
    doc.text(`Monthly Collection Report - ${monthName}`, 14, 22);
    
    // Date and Total
    doc.setFontSize(12);
    doc.text(`Total Monthly Collection: Rs. ${monthlyTotalCollected.toLocaleString()}`, 14, 32);
    doc.text(`Total Transactions: ${monthlyCollections.length}`, 14, 40);

    // Prepare table data
    const tableColumn = ["Date", "Account No.", "Name", "Amount (Rs.)", "Months"];
    
    // Sort monthly collections by date
    const sortedMonthly = [...monthlyCollections].sort((a, b) => a.collectionDate.localeCompare(b.collectionDate));

    const tableRows = sortedMonthly.map((collection, index) => {
      const customer = customers.find(c => c.accountNo === collection.accountNo);
      return [
        collection.collectionDate,
        collection.accountNo,
        customer?.accountName || '-',
        collection.amount.toLocaleString(),
        collection.installmentMonths || 1
      ];
    });

    autoTable(doc, {
      startY: 50,
      head: [tableColumn],
      body: tableRows,
      theme: 'striped',
      headStyles: { fillColor: [220, 38, 38] }, // India Post Red
    });

    const currentMonthPrefix = selectedDate.substring(0, 7);
    doc.save(`Monthly_Report_${currentMonthPrefix}.pdf`);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header & Stats */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Daily Collections</h1>
          <p className="text-gray-500">Track your daily RD account collections</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={handleDownloadMonthlyPDF}
            className="flex items-center gap-2 bg-white p-2 px-4 rounded-xl border border-gray-200 shadow-sm hover:bg-gray-50 text-gray-700 font-medium transition-colors"
            title="Download Monthly Report"
          >
            <FileDown className="w-5 h-5 text-red-600" />
            <span className="hidden sm:inline">Monthly PDF</span>
          </button>
          <button 
            onClick={handleDownloadPDF}
            className="flex items-center gap-2 bg-white p-2 px-4 rounded-xl border border-gray-200 shadow-sm hover:bg-gray-50 text-gray-700 font-medium transition-colors"
            title="Download Daily Report"
          >
            <FileDown className="w-5 h-5" />
            <span className="hidden sm:inline">Daily PDF</span>
          </button>
          <CustomCalendar 
            selectedDate={selectedDate} 
            onSelectDate={setSelectedDate} 
            highlightedDates={monthlyCollections.map(c => c.collectionDate)} 
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center text-green-600">
            <IndianRupee className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Daily Total</p>
            <p className="text-2xl font-bold text-gray-900">₹{totalCollected.toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-600">
            <IndianRupee className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Monthly Total</p>
            <p className="text-2xl font-bold text-gray-900">₹{monthlyTotalCollected.toLocaleString()}</p>
          </div>
        </div>
        
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Accounts Ticked</p>
            <p className="text-2xl font-bold text-gray-900">{collections.length} / {customers.length}</p>
          </div>
        </div>

        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-red-600 hover:bg-red-700 text-white rounded-2xl p-6 shadow-sm transition-colors flex flex-col items-center justify-center gap-2 group"
        >
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Plus className="w-6 h-6" />
          </div>
          <span className="font-medium">Add New Account</span>
        </button>

        <button 
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingCSV}
          className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-2xl p-6 shadow-sm transition-colors flex flex-col items-center justify-center gap-2 group disabled:opacity-70"
        >
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center group-hover:scale-110 transition-transform">
            {uploadingCSV ? <Loader2 className="w-6 h-6 animate-spin text-gray-500" /> : <Upload className="w-6 h-6 text-gray-500" />}
          </div>
          <span className="font-medium">{uploadingCSV ? 'Uploading...' : 'Upload CSV'}</span>
        </button>
        <input 
          type="file" 
          accept=".csv" 
          className="hidden" 
          ref={fileInputRef}
          onChange={handleFileUpload}
        />
      </div>

      {/* Main Ledger */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[600px]">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search accounts..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none transition-all text-sm"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button 
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Account</span>
            </button>
            {collections.length > 0 && (
              <button
                onClick={handleResetDailyCollection}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors whitespace-nowrap"
              >
                <RotateCcw className="w-4 h-4" />
                <span className="hidden sm:inline">Reset Day</span>
              </button>
            )}
            {customers.length > 0 && (
              <button
                onClick={handleDeleteAllCustomers}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors whitespace-nowrap"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Delete All</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <Loader2 className="w-8 h-8 animate-spin mb-2 text-red-500" />
              <p>Loading accounts...</p>
            </div>
          ) : customers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8 text-center">
              <UserIcon className="w-12 h-12 mb-3 text-gray-300" />
              <p className="text-lg font-medium text-gray-900 mb-1">No accounts found</p>
              <p className="text-sm mb-4">Add your RD accounts to start tracking daily collections.</p>
              <button 
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 bg-red-50 text-red-600 rounded-lg font-medium hover:bg-red-100 transition-colors"
              >
                Add First Account
              </button>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-white sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100 w-12 text-center">#</th>
                      <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100 w-16 text-center">Fav</th>
                      <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">Status</th>
                      <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">Account No.</th>
                      <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">Name</th>
                      <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">Amount</th>
                      <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100 w-24">Months</th>
                      <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredCustomers.map((customer, index) => {
                      const existingCollection = collections.find(c => c.accountNo === customer.accountNo);
                      const isCollected = !!existingCollection;
                      const isProcessing = processingAccounts.has(customer.accountNo);

                      return (
                        <tr 
                          key={customer.id} 
                          className={`hover:bg-gray-50 transition-colors ${isCollected ? 'bg-green-50/30' : ''}`}
                        >
                          <td className="py-3 px-4 text-sm text-gray-400 font-medium text-center">{index + 1}</td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={(e) => toggleFavorite(e, customer)}
                              className={`p-1.5 rounded-full transition-colors ${
                                customer.isFavorite 
                                  ? 'text-amber-400 hover:bg-amber-50' 
                                  : 'text-gray-300 hover:text-amber-400 hover:bg-gray-100'
                              }`}
                            >
                              <Star className={`w-5 h-5 ${customer.isFavorite ? 'fill-current' : ''}`} />
                            </button>
                          </td>
                          <td className="py-3 px-4 w-16 cursor-pointer" onClick={() => toggleCollection(customer)}>
                            <button 
                              disabled={isProcessing}
                              className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                                isProcessing ? 'text-gray-400' :
                                isCollected ? 'text-green-500 bg-green-100' : 'text-gray-300 hover:text-red-500'
                              }`}
                            >
                              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> :
                               isCollected ? <CheckCircle2 className="w-5 h-5" /> : 
                               <Circle className="w-5 h-5" />}
                            </button>
                          </td>
                          <td className="py-3 px-4 font-mono text-sm text-gray-900 cursor-pointer" onClick={() => toggleCollection(customer)}>{customer.accountNo}</td>
                          <td className="py-3 px-4 text-sm text-gray-600 cursor-pointer" onClick={() => toggleCollection(customer)}>{customer.accountName || '-'}</td>
                          <td className="py-3 px-4 text-sm font-medium text-gray-900 cursor-pointer" onClick={() => toggleCollection(customer)}>
                            ₹{isCollected ? existingCollection.amount : customer.defaultAmount}
                          </td>
                          <td className="py-3 px-4">
                            <select
                              disabled={isCollected || isProcessing}
                              value={isCollected ? (existingCollection.installmentMonths || 1) : 1}
                              onChange={(e) => toggleCollection(customer, parseInt(e.target.value))}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500 disabled:bg-gray-50 disabled:text-gray-500"
                            >
                              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(num => (
                                <option key={num} value={num}>{num} {num === 1 ? 'Month' : 'Months'}</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleDeleteCustomer(customer.id); }}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                              title="Remove Account"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden flex flex-col divide-y divide-gray-100">
                {filteredCustomers.map((customer, index) => {
                  const existingCollection = collections.find(c => c.accountNo === customer.accountNo);
                  const isCollected = !!existingCollection;
                  const isProcessing = processingAccounts.has(customer.accountNo);

                  return (
                    <div 
                      key={customer.id} 
                      className={`p-4 flex flex-col gap-3 transition-colors ${isCollected ? 'bg-green-50/30' : 'bg-white'}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={(e) => toggleFavorite(e, customer)}
                            className={`p-1 rounded-full transition-colors ${
                              customer.isFavorite 
                                ? 'text-amber-400 bg-amber-50' 
                                : 'text-gray-300 bg-gray-50'
                            }`}
                          >
                            <Star className={`w-5 h-5 ${customer.isFavorite ? 'fill-current' : ''}`} />
                          </button>
                          <div>
                            <div className="font-mono font-medium text-gray-900">{customer.accountNo}</div>
                            <div className="text-sm text-gray-500">{customer.accountName || 'No Name'}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900">
                            ₹{isCollected ? existingCollection.amount : customer.defaultAmount}
                          </span>
                          <button 
                            onClick={() => handleDeleteCustomer(customer.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 bg-gray-50 rounded-md transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between gap-3 bg-gray-50/50 p-2 rounded-lg border border-gray-100">
                        <div className="flex items-center gap-2 flex-1">
                          <span className="text-xs font-medium text-gray-500 uppercase">Months:</span>
                          <select
                            disabled={isCollected || isProcessing}
                            value={isCollected ? (existingCollection.installmentMonths || 1) : 1}
                            onChange={(e) => toggleCollection(customer, parseInt(e.target.value))}
                            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500 disabled:bg-gray-100 disabled:text-gray-500 bg-white"
                          >
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(num => (
                              <option key={num} value={num}>{num} {num === 1 ? 'Month' : 'Months'}</option>
                            ))}
                          </select>
                        </div>
                        
                        <button 
                          disabled={isProcessing}
                          onClick={() => toggleCollection(customer)}
                          className={`flex items-center gap-2 px-4 py-1.5 rounded-lg font-medium transition-colors ${
                            isProcessing ? 'bg-gray-100 text-gray-400' :
                            isCollected ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-100'
                          }`}
                        >
                          {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> :
                           isCollected ? (
                             <>
                               <CheckCircle2 className="w-4 h-4" />
                               <span>Saved</span>
                             </>
                           ) : (
                             <>
                               <Circle className="w-4 h-4" />
                               <span>Save</span>
                             </>
                           )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Add Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center shrink-0 bg-white">
              <h3 className="text-lg font-semibold text-gray-900">Add New Account</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddCustomer} className="flex flex-col min-h-0 flex-1">
              <div className="p-6 space-y-4 overflow-y-auto bg-white">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Account Number *</label>
                  <input 
                    type="text" 
                    required
                    value={newAccountNo}
                    onChange={e => setNewAccountNo(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none bg-white text-gray-900"
                    placeholder="Enter RD Account No"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Account Name</label>
                  <input 
                    type="text" 
                    value={newAccountName}
                    onChange={e => setNewAccountName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none bg-white text-gray-900"
                    placeholder="Holder Name (Optional)"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Default Amount (₹) *</label>
                  <input 
                    type="number" 
                    required
                    min="10"
                    value={newAmount}
                    onChange={e => setNewAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none bg-white text-gray-900"
                    placeholder="e.g. 500"
                  />
                </div>
              </div>
              
              <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex gap-3 shrink-0">
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors shadow-sm"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={addingCustomer}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-70 flex items-center justify-center gap-2 shadow-sm"
                >
                  {addingCustomer ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={showDeleteConfirm}
        title="Remove Account"
        message="Are you sure you want to remove this account and all its collection records? This action cannot be undone."
        confirmText="Remove Account"
        onConfirm={confirmDeleteCustomer}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setCustomerToDelete(null);
        }}
      />

      <ConfirmationModal
        isOpen={showDeleteAllConfirm}
        title="Delete ALL Accounts"
        message="Are you sure you want to delete ALL accounts and their collection records? This action is permanent and cannot be undone."
        confirmText="Delete All"
        onConfirm={confirmDeleteAllCustomers}
        onCancel={() => setShowDeleteAllConfirm(false)}
      />

      <ConfirmationModal
        isOpen={showResetConfirm}
        title="Reset Daily Collection"
        message={`Are you sure you want to un-tick all collections for ${selectedDate}? This will reset the daily total to zero.`}
        confirmText="Reset Day"
        onConfirm={confirmResetDailyCollection}
        onCancel={() => setShowResetConfirm(false)}
      />
    </div>
  );
}
