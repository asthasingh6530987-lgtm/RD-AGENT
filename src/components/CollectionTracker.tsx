import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, serverTimestamp, orderBy, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { User } from 'firebase/auth';
import { Calendar, CheckCircle2, Circle, IndianRupee, Loader2, Plus, Search, User as UserIcon, Trash2, X, Upload, Star, FileDown, RotateCcw, Save } from 'lucide-react';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ConfirmationModal from './ConfirmationModal';
import CustomCalendar from './CustomCalendar';
import AccountDetailsModal from './AccountDetailsModal';

interface Customer {
  id: string;
  accountNo: string;
  accountName: string;
  defaultAmount: number;
  isFavorite?: boolean;
  mobileNumber?: string;
  maturityTime?: string;
  totalDeposit?: number;
  collectionAmount?: number;
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
  const [newMobileNumber, setNewMobileNumber] = useState('');
  const [newMaturityTime, setNewMaturityTime] = useState('5 Year');
  const [newTotalDeposit, setNewTotalDeposit] = useState('');
  const [newCollectionAmount, setNewCollectionAmount] = useState('');
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [uploadingCSV, setUploadingCSV] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete Confirmation State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<string | null>(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  
  // Manual Collection State
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualAccountNo, setManualAccountNo] = useState('');
  const [manualAccountName, setManualAccountName] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [manualMonths, setManualMonths] = useState('1');
  const [savingManual, setSavingManual] = useState(false);

  // Edit Customer State
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editAccountNo, setEditAccountNo] = useState('');
  const [editAccountName, setEditAccountName] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editMobileNumber, setEditMobileNumber] = useState('');
  const [editMaturityTime, setEditMaturityTime] = useState('');
  const [editTotalDeposit, setEditTotalDeposit] = useState('');
  const [editCollectionAmount, setEditCollectionAmount] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Account Details State
  const [showAccountDetails, setShowAccountDetails] = useState(false);
  const [selectedAccountDetails, setSelectedAccountDetails] = useState<Customer | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Loading states for individual checkboxes
  const [processingAccounts, setProcessingAccounts] = useState<Set<string>>(new Set());
  const [pendingCollections, setPendingCollections] = useState<CollectionRecord[]>([]);

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
      setRefreshTrigger(prev => prev + 1);
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
        mobileNumber: newMobileNumber,
        maturityTime: newMaturityTime,
        totalDeposit: Number(newTotalDeposit) || 0,
        collectionAmount: Number(newCollectionAmount) || 0,
        isFavorite: false,
        createdAt: serverTimestamp()
      });

      const newCustomer: Customer = {
        id: docRef.id,
        accountNo: newAccountNo,
        accountName: newAccountName,
        defaultAmount: Number(newAmount),
        mobileNumber: newMobileNumber,
        maturityTime: newMaturityTime,
        totalDeposit: Number(newTotalDeposit) || 0,
        collectionAmount: Number(newCollectionAmount) || 0,
        isFavorite: false
      };

      setCustomers([newCustomer, ...customers]);
      setShowAddModal(false);
      setNewAccountNo('');
      setNewAccountName('');
      setNewAmount('');
      setNewMobileNumber('');
      setNewMaturityTime('5 Year');
      setNewTotalDeposit('');
      setNewCollectionAmount('');
      addToast("Account added successfully", "success");
    } catch (error) {
      console.error("Error adding customer:", error);
      addToast("Failed to add account", "error");
    } finally {
      setAddingCustomer(false);
    }
  };

  const handleEditCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer || !editAccountNo || !editAmount) {
      addToast("Account Number and Amount are required", "error");
      return;
    }

    setSavingEdit(true);
    try {
      const { updateDoc } = await import('firebase/firestore');
      await updateDoc(doc(db, 'customers', editingCustomer.id), {
        accountNo: editAccountNo,
        accountName: editAccountName,
        defaultAmount: Number(editAmount),
        mobileNumber: editMobileNumber,
        maturityTime: editMaturityTime,
        totalDeposit: Number(editTotalDeposit) || 0,
        collectionAmount: Number(editCollectionAmount) || 0,
      });

      setCustomers(customers.map(c => 
        c.id === editingCustomer.id 
          ? { 
              ...c, 
              accountNo: editAccountNo, 
              accountName: editAccountName, 
              defaultAmount: Number(editAmount),
              mobileNumber: editMobileNumber,
              maturityTime: editMaturityTime,
              totalDeposit: Number(editTotalDeposit) || 0,
              collectionAmount: Number(editCollectionAmount) || 0,
            } 
          : c
      ));
      
      setEditingCustomer(null);
      addToast("Account updated successfully", "success");
    } catch (error) {
      console.error("Error updating customer:", error);
      addToast("Failed to update account", "error");
    } finally {
      setSavingEdit(false);
    }
  };

  const toggleCollection = async (customer: Customer, months: number = 1) => {
    if (processingAccounts.has(customer.accountNo)) return;

    setProcessingAccounts(prev => new Set(prev).add(customer.accountNo));

    const existingCollection = collections.find(c => c.accountNo === customer.accountNo);
    const pendingCollection = pendingCollections.find(c => c.accountNo === customer.accountNo);

    try {
      if (existingCollection) {
        // Un-tick: Delete collection
        await deleteDoc(doc(db, 'collections', existingCollection.id));
        setCollections(collections.filter(c => c.id !== existingCollection.id));
        setMonthlyCollections(monthlyCollections.filter(c => c.id !== existingCollection.id));
      } else if (pendingCollection) {
        // Un-tick: Remove from pending
        setPendingCollections(pendingCollections.filter(c => c.accountNo !== customer.accountNo));
      } else {
        // Tick: Add to pending
        const totalAmount = customer.defaultAmount * months;
        const newRecord: CollectionRecord = {
          id: 'pending-' + customer.accountNo,
          accountNo: customer.accountNo,
          amount: totalAmount,
          collectionDate: selectedDate,
          installmentMonths: months
        };
        setPendingCollections([...pendingCollections, newRecord]);
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

  const saveAllCollections = async () => {
    if (pendingCollections.length === 0) return;
    setLoading(true);
    try {
      const batch = writeBatch(db);
      pendingCollections.forEach(c => {
        const docRef = doc(collection(db, 'collections'));
        batch.set(docRef, {
          agentId: user.uid,
          accountNo: c.accountNo,
          amount: c.amount,
          collectionDate: c.collectionDate,
          installmentMonths: c.installmentMonths,
          createdAt: serverTimestamp()
        });
      });
      await batch.commit();
      
      // Refresh data
      await fetchData();
      setPendingCollections([]);
      addToast("All collections saved successfully", "success");
    } catch (error) {
      console.error("Error saving all collections:", error);
      addToast("Failed to save collections", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = () => {
    const uncollectedFiltered = filteredCustomers.filter(customer => 
      !collections.some(c => c.accountNo === customer.accountNo)
    );
    
    if (uncollectedFiltered.length === 0) return;

    const allSelected = uncollectedFiltered.every(customer => 
      pendingCollections.some(p => p.accountNo === customer.accountNo)
    );

    if (allSelected) {
      // Deselect all pending from the current filtered list
      const filteredAccountNos = new Set(filteredCustomers.map(c => c.accountNo));
      setPendingCollections(pendingCollections.filter(p => !filteredAccountNos.has(p.accountNo)));
    } else {
      // Select all uncollected
      const newPending = [...pendingCollections];
      uncollectedFiltered.forEach(customer => {
        if (!newPending.some(p => p.accountNo === customer.accountNo)) {
          newPending.push({
            id: 'pending-' + customer.accountNo,
            accountNo: customer.accountNo,
            amount: customer.defaultAmount,
            collectionDate: selectedDate,
            installmentMonths: 1
          });
        }
      });
      setPendingCollections(newPending);
    }
  };

  const handleCollectAllAndSave = async () => {
    const uncollected = customers.filter(customer => 
      !collections.some(c => c.accountNo === customer.accountNo)
    );

    if (uncollected.length === 0) {
      addToast("All accounts are already collected", "info");
      return;
    }

    setLoading(true);
    try {
      const batch = writeBatch(db);
      uncollected.forEach(c => {
        const docRef = doc(collection(db, 'collections'));
        batch.set(docRef, {
          agentId: user.uid,
          accountNo: c.accountNo,
          amount: c.defaultAmount,
          collectionDate: selectedDate,
          installmentMonths: 1,
          createdAt: serverTimestamp()
        });
      });
      await batch.commit();
      
      await fetchData();
      setPendingCollections([]);
      addToast(`Successfully collected all ${uncollected.length} accounts`, "success");
    } catch (error) {
      console.error("Error collecting all:", error);
      addToast("Failed to collect all accounts", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleManualCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualAccountNo || !manualAmount) {
      addToast("Account Number and Amount are required", "error");
      return;
    }

    setSavingManual(true);
    try {
      await addDoc(collection(db, 'collections'), {
        agentId: user.uid,
        accountNo: manualAccountNo,
        amount: Number(manualAmount),
        collectionDate: selectedDate,
        installmentMonths: Number(manualMonths),
        createdAt: serverTimestamp()
      });

      // If this account exists in customers, we might want to update its name if it was empty
      const existingCustomer = customers.find(c => c.accountNo === manualAccountNo);
      if (existingCustomer && !existingCustomer.accountName && manualAccountName) {
        const { updateDoc } = await import('firebase/firestore');
        await updateDoc(doc(db, 'customers', existingCustomer.id), {
          accountName: manualAccountName
        });
      }

      await fetchData();
      setShowManualModal(false);
      setManualAccountNo('');
      setManualAccountName('');
      setManualAmount('');
      setManualMonths('1');
      addToast("Collection saved successfully", "success");
    } catch (error) {
      console.error("Error saving manual collection:", error);
      addToast("Failed to save collection", "error");
    } finally {
      setSavingManual(false);
    }
  };

  const saveSingleCollection = async (customer: Customer, months: number = 1) => {
    if (processingAccounts.has(customer.accountNo)) return;

    setProcessingAccounts(prev => new Set(prev).add(customer.accountNo));
    try {
      const totalAmount = customer.defaultAmount * months;
      await addDoc(collection(db, 'collections'), {
        agentId: user.uid,
        accountNo: customer.accountNo,
        amount: totalAmount,
        collectionDate: selectedDate,
        installmentMonths: months,
        createdAt: serverTimestamp()
      });

      // Remove from pending if it was there
      setPendingCollections(prev => prev.filter(p => p.accountNo !== customer.accountNo));
      
      await fetchData();
      addToast(`Collection for ${customer.accountNo} saved`, "success");
    } catch (error) {
      console.error("Error saving single collection:", error);
      addToast("Failed to save collection", "error");
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
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Daily Collections</h1>
          <p className="text-slate-500 font-medium mt-1">Track your daily RD account collections</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={handleDownloadMonthlyPDF}
            className="flex items-center gap-2 bg-white p-2.5 px-4 rounded-2xl border border-slate-200/60 shadow-sm hover:bg-slate-50 hover:border-slate-300 text-slate-700 font-semibold transition-all group"
            title="Download Monthly Report"
          >
            <FileDown className="w-4 h-4 text-slate-400 group-hover:text-brand transition-colors" />
            <span className="hidden sm:inline text-sm">Monthly PDF</span>
          </button>
          <button 
            onClick={handleDownloadPDF}
            className="flex items-center gap-2 bg-white p-2.5 px-4 rounded-2xl border border-slate-200/60 shadow-sm hover:bg-slate-50 hover:border-slate-300 text-slate-700 font-semibold transition-all group"
            title="Download Daily Report"
          >
            <FileDown className="w-4 h-4 text-slate-400 group-hover:text-gold transition-colors" />
            <span className="hidden sm:inline text-sm">Daily PDF</span>
          </button>
          <CustomCalendar 
            selectedDate={selectedDate} 
            onSelectDate={setSelectedDate} 
            highlightedDates={monthlyCollections.map(c => c.collectionDate)} 
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
        <div className="bg-white rounded-3xl p-6 border border-slate-200/60 shadow-sm flex flex-col justify-center gap-4 group hover:shadow-md hover:border-brand/30 transition-all duration-300">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-brand/5 flex items-center justify-center text-brand group-hover:bg-brand group-hover:text-white transition-colors duration-300">
              <IndianRupee className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Daily Total</p>
              <p className="text-2xl font-bold text-slate-900 mt-0.5">₹{totalCollected.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-200/60 shadow-sm flex flex-col justify-center gap-4 group hover:shadow-md hover:border-gold/30 transition-all duration-300">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gold/5 flex items-center justify-center text-gold group-hover:bg-gold group-hover:text-white transition-colors duration-300">
              <IndianRupee className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Monthly Total</p>
              <p className="text-2xl font-bold text-slate-900 mt-0.5">₹{monthlyTotalCollected.toLocaleString()}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-3xl p-6 border border-slate-200/60 shadow-sm flex flex-col justify-center gap-4 group hover:shadow-md hover:border-info/30 transition-all duration-300">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-info/5 flex items-center justify-center text-info group-hover:bg-info group-hover:text-white transition-colors duration-300">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Progress</p>
              <p className="text-2xl font-bold text-slate-900 mt-0.5">{collections.length} <span className="text-slate-400 text-lg font-medium">/ {customers.length}</span></p>
            </div>
          </div>
        </div>

        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-brand hover:bg-brand/90 text-white rounded-3xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col items-center justify-center gap-3 group hover:-translate-y-1"
        >
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Plus className="w-6 h-6" />
          </div>
          <span className="font-semibold text-sm">Add Account</span>
        </button>

        <button 
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingCSV}
          className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/60 rounded-3xl p-6 shadow-sm transition-all flex flex-col items-center justify-center gap-3 group disabled:opacity-70 hover:shadow-md hover:border-slate-300 hover:-translate-y-1"
        >
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center group-hover:scale-110 transition-transform">
            {uploadingCSV ? <Loader2 className="w-6 h-6 animate-spin text-slate-500" /> : <Upload className="w-6 h-6 text-slate-500" />}
          </div>
          <span className="font-semibold text-sm text-slate-700">{uploadingCSV ? 'Uploading...' : 'Upload CSV'}</span>
        </button>

        {pendingCollections.length > 0 && (
          <>
            <button 
              onClick={saveAllCollections}
              disabled={loading}
              className="bg-gradient-to-br from-brand to-red-600 text-white rounded-3xl p-6 shadow-lg shadow-brand/20 transition-all flex flex-col items-center justify-center gap-3 group disabled:opacity-70 hover:shadow-xl hover:-translate-y-1 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out"></div>
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform relative z-10 backdrop-blur-sm">
                {loading ? <Loader2 className="w-6 h-6 animate-spin text-white" /> : <Save className="w-6 h-6 text-white" />}
              </div>
              <div className="relative z-10 flex flex-col items-center">
                <span className="font-bold text-sm">{loading ? 'Saving...' : 'Save Pending'}</span>
                <span className="text-[11px] font-medium text-white/90 mt-1 bg-black/20 px-2.5 py-0.5 rounded-full backdrop-blur-md">
                  {pendingCollections.length} {pendingCollections.length === 1 ? 'Account' : 'Accounts'}
                </span>
              </div>
            </button>
            <button 
              onClick={() => setPendingCollections([])}
              disabled={loading}
              className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/60 rounded-3xl p-6 shadow-sm transition-all flex flex-col items-center justify-center gap-3 group disabled:opacity-70 hover:shadow-md hover:border-slate-300 hover:-translate-y-1"
            >
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                <RotateCcw className="w-6 h-6 text-slate-500 group-hover:text-slate-700 transition-colors" />
              </div>
              <span className="font-semibold text-sm text-slate-700">Reset Pending</span>
            </button>
          </>
        )}

        <button 
          onClick={() => setShowManualModal(true)}
          className="bg-slate-900 hover:bg-slate-800 text-white rounded-3xl p-6 shadow-sm transition-all flex flex-col items-center justify-center gap-3 group hover:shadow-md hover:-translate-y-1"
        >
          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Calendar className="w-6 h-6" />
          </div>
          <span className="font-semibold text-sm">Manual Entry</span>
        </button>

        {customers.length > 0 && collections.length < customers.length && (
          <button 
            onClick={handleCollectAllAndSave}
            disabled={loading}
            className="bg-gold hover:bg-gold/90 text-white rounded-3xl p-6 shadow-sm transition-all flex flex-col items-center justify-center gap-3 group disabled:opacity-70 hover:shadow-md hover:-translate-y-1"
          >
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              {loading ? <Loader2 className="w-6 h-6 animate-spin text-white" /> : <CheckCircle2 className="w-6 h-6 text-white" />}
            </div>
            <span className="font-semibold text-sm">{loading ? 'Saving...' : 'Collect All'}</span>
          </button>
        )}

        <input 
          type="file" 
          accept=".csv" 
          className="hidden" 
          ref={fileInputRef}
          onChange={handleFileUpload}
        />
      </div>

      {/* Main Ledger */}
      <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden flex flex-col h-[600px]">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search accounts..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 rounded-2xl border border-slate-200 focus:border-brand focus:ring-4 focus:ring-brand/10 outline-none transition-all text-sm font-medium bg-slate-50/50 focus:bg-white"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 hover:text-slate-600 transition-colors"
                title="Reset Search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {filteredCustomers.length > 0 && (
              <button
                onClick={handleSelectAll}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 rounded-xl transition-all border border-slate-200 shadow-sm"
              >
                <CheckCircle2 className="w-4 h-4 text-slate-400" />
                <span className="hidden sm:inline">
                  {filteredCustomers.filter(c => !collections.some(col => col.accountNo === c.accountNo)).every(c => pendingCollections.some(p => p.accountNo === c.accountNo)) ? 'Deselect All' : 'Select All'}
                </span>
              </button>
            )}
            <button 
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-brand hover:bg-brand/90 rounded-xl transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Account</span>
            </button>
            {collections.length > 0 && (
              <button
                onClick={handleResetDailyCollection}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 rounded-xl transition-all border border-slate-200 shadow-sm"
              >
                <RotateCcw className="w-4 h-4 text-slate-400" />
                <span className="hidden sm:inline">Reset Day</span>
              </button>
            )}
            {customers.length > 0 && (
              <button
                onClick={handleDeleteAllCustomers}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-all border border-red-100"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Delete All</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-slate-50/30">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin mb-3 text-brand" />
              <p className="font-medium">Loading accounts...</p>
            </div>
          ) : customers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 p-8 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <UserIcon className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-lg font-semibold text-slate-900 mb-1">No accounts found</p>
              <p className="text-sm mb-5 max-w-sm">Add your RD accounts to start tracking daily collections seamlessly.</p>
              <button 
                onClick={() => setShowAddModal(true)}
                className="px-5 py-2.5 bg-brand text-white rounded-xl font-medium hover:bg-brand/90 transition-colors shadow-sm"
              >
                Add First Account
              </button>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50/80 backdrop-blur-md sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="py-3.5 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 w-12 text-center">#</th>
                      <th className="py-3.5 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 w-16 text-center">Fav</th>
                      <th className="py-3.5 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">Status</th>
                      <th className="py-3.5 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">Account No.</th>
                      <th className="py-3.5 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">Name</th>
                      <th className="py-3.5 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">Amount</th>
                      <th className="py-3.5 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 w-24">Months</th>
                      <th className="py-3.5 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredCustomers.map((customer, index) => {
                      const existingCollection = collections.find(c => c.accountNo === customer.accountNo);
                      const isCollected = !!existingCollection;
                      const isPending = pendingCollections.some(c => c.accountNo === customer.accountNo);
                      const isProcessing = processingAccounts.has(customer.accountNo);

                      return (
                        <tr 
                          key={`${customer.id}-${index}-desktop`} 
                          className={`group hover:bg-slate-50/80 transition-all ${isCollected ? 'bg-success/5' : isPending ? 'bg-info/5' : ''}`}
                        >
                          <td className="py-3.5 px-4 text-xs text-slate-500 font-medium text-center">{index + 1}</td>
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={(e) => toggleFavorite(e, customer)}
                              className={`p-1.5 rounded-full transition-all ${
                                customer.isFavorite 
                                  ? 'text-gold bg-gold/10' 
                                  : 'text-slate-300 hover:text-gold hover:bg-gold/5'
                              }`}
                            >
                              <Star className={`w-4 h-4 ${customer.isFavorite ? 'fill-current' : ''}`} />
                            </button>
                          </td>
                          <td className="py-3.5 px-4 w-16 cursor-pointer" onClick={() => toggleCollection(customer)}>
                            <button 
                              disabled={isProcessing}
                              className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                                isProcessing ? 'text-slate-400' :
                                isCollected ? 'text-success bg-success/10' : 
                                isPending ? 'text-info bg-info/10' : 'text-slate-300 group-hover:text-brand'
                              }`}
                            >
                              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> :
                               isCollected ? <CheckCircle2 className="w-5 h-5" /> : 
                               isPending ? <CheckCircle2 className="w-5 h-5" /> :
                               <Circle className="w-5 h-5" />}
                            </button>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-sm font-medium text-slate-700 cursor-pointer group-hover:text-brand transition-colors" onClick={() => toggleCollection(customer)}>{customer.accountNo}</td>
                          <td 
                            className="py-3.5 px-4 text-sm font-semibold text-slate-900 cursor-pointer hover:text-brand transition-colors" 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAccountDetails(customer);
                              setShowAccountDetails(true);
                            }}
                          >
                            {customer.accountName || '-'}
                          </td>
                          <td className="py-3.5 px-4 text-sm font-bold text-slate-800 cursor-pointer" onClick={() => toggleCollection(customer)}>
                            ₹{isCollected ? existingCollection.amount : customer.defaultAmount}
                          </td>
                          <td className="py-3.5 px-4">
                            <select
                              disabled={isCollected || isProcessing}
                              value={isCollected ? (existingCollection.installmentMonths || 1) : 1}
                              onChange={(e) => toggleCollection(customer, parseInt(e.target.value))}
                              className="w-full px-2.5 py-1.5 text-xs font-medium border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none disabled:bg-slate-50 disabled:text-slate-400 transition-all bg-white"
                            >
                              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(num => (
                                <option key={num} value={num}>{num} {num === 1 ? 'Month' : 'Months'}</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  if (!isCollected) {
                                    saveSingleCollection(customer, collections.find(c => c.accountNo === customer.accountNo)?.installmentMonths || 1); 
                                  }
                                }}
                                disabled={isProcessing || isCollected}
                                className={`p-1.5 rounded-lg transition-all ${
                                  isCollected 
                                    ? 'text-success bg-success/10' 
                                    : isPending 
                                      ? 'text-info hover:bg-info/10' 
                                      : 'text-slate-400 hover:text-brand hover:bg-brand/10'
                                }`}
                                title={isCollected ? "Saved" : "Save Collection Now"}
                              >
                                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : isCollected ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleDeleteCustomer(customer.id); }}
                                className="p-1.5 text-slate-400 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all"
                                title="Remove Account"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden flex flex-col divide-y divide-slate-100 bg-slate-50/30">
                {filteredCustomers.map((customer, index) => {
                  const existingCollection = collections.find(c => c.accountNo === customer.accountNo);
                  const isCollected = !!existingCollection;
                  const isPending = pendingCollections.some(c => c.accountNo === customer.accountNo);
                  const isProcessing = processingAccounts.has(customer.accountNo);

                  return (
                    <div 
                      key={`${customer.id}-${index}-mobile`} 
                      className={`p-4 flex flex-col gap-3 transition-colors ${isCollected ? 'bg-success/5' : isPending ? 'bg-info/5' : 'bg-white hover:bg-slate-50/50'}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={(e) => toggleFavorite(e, customer)}
                            className={`p-1.5 rounded-full transition-all ${
                              customer.isFavorite 
                                ? 'text-gold bg-gold/10' 
                                : 'text-slate-300 hover:text-gold hover:bg-gold/5'
                            }`}
                          >
                            <Star className={`w-5 h-5 ${customer.isFavorite ? 'fill-current' : ''}`} />
                          </button>
                          <div>
                            <div className="font-mono font-medium text-slate-700 text-sm mb-0.5">{customer.accountNo}</div>
                            <div 
                              className="text-sm text-slate-900 font-semibold cursor-pointer hover:text-brand transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedAccountDetails(customer);
                                setShowAccountDetails(true);
                              }}
                            >
                              {customer.accountName || 'No Name'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800">
                            ₹{isCollected ? existingCollection.amount : customer.defaultAmount}
                          </span>
                          <button 
                            onClick={() => handleDeleteCustomer(customer.id)}
                            className="p-1.5 text-slate-400 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100 mt-1">
                        <div className="flex items-center gap-2 flex-1">
                          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Months:</span>
                          <select
                            disabled={isCollected || isProcessing}
                            value={isCollected ? (existingCollection.installmentMonths || 1) : 1}
                            onChange={(e) => toggleCollection(customer, parseInt(e.target.value))}
                            className="flex-1 px-2.5 py-1.5 text-xs font-medium border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none disabled:bg-slate-100 disabled:text-slate-400 bg-white transition-all"
                          >
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(num => (
                              <option key={num} value={num}>{num} {num === 1 ? 'Month' : 'Months'}</option>
                            ))}
                          </select>
                        </div>
                        
                        <button 
                          disabled={isProcessing}
                          onClick={() => toggleCollection(customer)}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                            isProcessing ? 'bg-slate-100 text-slate-400' :
                            isCollected ? 'bg-success/10 text-success border border-success/20' : 
                            isPending ? 'bg-info/10 text-info border border-info/20' : 'bg-white text-slate-600 border border-slate-200 hover:border-brand hover:text-brand shadow-sm'
                          }`}
                        >
                          {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> :
                           isCollected ? (
                             <>
                               <CheckCircle2 className="w-4 h-4" />
                               <span>Saved</span>
                             </>
                           ) : isPending ? (
                             <>
                               <CheckCircle2 className="w-4 h-4" />
                               <span>Pending</span>
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] border border-slate-100">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center shrink-0 bg-white">
              <h3 className="text-lg font-bold text-slate-800">Add New Account</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddCustomer} className="flex flex-col min-h-0 flex-1">
              <div className="p-6 space-y-5 overflow-y-auto bg-white">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider ml-0.5">Account Number *</label>
                  <input 
                    type="text" 
                    required
                    value={newAccountNo}
                    onChange={e => setNewAccountNo(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none bg-white text-slate-900 font-medium transition-all"
                    placeholder="Enter RD Account No"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider ml-0.5">Account Name</label>
                  <input 
                    type="text" 
                    value={newAccountName}
                    onChange={e => setNewAccountName(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none bg-white text-slate-900 font-medium transition-all"
                    placeholder="Holder Name (Optional)"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider ml-0.5">Default Amount (₹) *</label>
                  <input 
                    type="number" 
                    required
                    min="10"
                    value={newAmount}
                    onChange={e => setNewAmount(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none bg-white text-slate-900 font-medium transition-all"
                    placeholder="e.g. 500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider ml-0.5">Mobile Number</label>
                    <input 
                      type="text" 
                      value={newMobileNumber}
                      onChange={e => setNewMobileNumber(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none bg-white text-slate-900 font-medium transition-all"
                      placeholder="Mobile No"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider ml-0.5">Maturity Time</label>
                    <select
                      value={newMaturityTime}
                      onChange={e => setNewMaturityTime(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none bg-white text-slate-900 font-medium transition-all"
                    >
                      <option value="1 Year">1 Year</option>
                      <option value="2 Year">2 Year</option>
                      <option value="3 Year">3 Year</option>
                      <option value="5 Year">5 Year</option>
                      <option value="10 Year">10 Year</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider ml-0.5">Total Deposit (₹)</label>
                    <input 
                      type="number" 
                      value={newTotalDeposit}
                      onChange={e => setNewTotalDeposit(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none bg-white text-slate-900 font-medium transition-all"
                      placeholder="Opening Balance"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider ml-0.5">Collection (₹)</label>
                    <input 
                      type="number" 
                      value={newCollectionAmount}
                      onChange={e => setNewCollectionAmount(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none bg-white text-slate-900 font-medium transition-all"
                      placeholder="Collection"
                    />
                  </div>
                </div>
              </div>
              
              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex gap-3 shrink-0">
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 bg-white text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-all shadow-sm"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={addingCustomer}
                  className="flex-1 px-4 py-2.5 bg-brand text-white rounded-xl font-medium hover:bg-brand/90 transition-all disabled:opacity-70 flex items-center justify-center gap-2 shadow-sm"
                >
                  {addingCustomer ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Collection Modal */}
      {showManualModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] border border-slate-100">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center shrink-0 bg-white">
              <h3 className="text-lg font-bold text-slate-800">Manual Entry</h3>
              <button onClick={() => setShowManualModal(false)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleManualCollection} className="flex flex-col min-h-0 flex-1">
              <div className="p-6 space-y-5 overflow-y-auto bg-white">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider ml-0.5">Account Number *</label>
                  <input 
                    type="text" 
                    required
                    value={manualAccountNo}
                    onChange={e => {
                      const val = e.target.value;
                      setManualAccountNo(val);
                      // Auto-fill name and amount if account exists
                      const cust = customers.find(c => c.accountNo === val);
                      if (cust) {
                        setManualAccountName(cust.accountName || '');
                        setManualAmount(cust.defaultAmount.toString());
                      }
                    }}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-gold/20 focus:border-gold outline-none bg-white text-slate-900 font-medium transition-all"
                    placeholder="Enter RD Account No"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider ml-0.5">Account Name</label>
                  <input 
                    type="text" 
                    value={manualAccountName}
                    onChange={e => setManualAccountName(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-gold/20 focus:border-gold outline-none bg-white text-slate-900 font-medium transition-all"
                    placeholder="Holder Name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider ml-0.5">Amount (₹) *</label>
                    <input 
                      type="number" 
                      required
                      min="1"
                      value={manualAmount}
                      onChange={e => setManualAmount(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-gold/20 focus:border-gold outline-none bg-white text-slate-900 font-medium transition-all"
                      placeholder="e.g. 500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider ml-0.5">Months *</label>
                    <select
                      value={manualMonths}
                      onChange={e => setManualMonths(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-gold/20 focus:border-gold outline-none bg-white text-slate-900 font-medium transition-all"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(num => (
                        <option key={num} value={num}>{num} {num === 1 ? 'Month' : 'Months'}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="p-4 bg-gold/5 rounded-xl border border-gold/20">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-gold-dark uppercase tracking-wider">Total to Save:</span>
                    <span className="text-gold-dark font-bold text-xl">₹{(Number(manualAmount) * Number(manualMonths)).toLocaleString()}</span>
                  </div>
                </div>
              </div>
              
              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex gap-3 shrink-0">
                <button 
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 bg-white text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-all shadow-sm"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={savingManual}
                  className="flex-1 px-4 py-2.5 bg-gold text-white rounded-xl font-medium hover:bg-gold/90 transition-all disabled:opacity-70 flex items-center justify-center gap-2 shadow-sm"
                >
                  {savingManual ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Collection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {editingCustomer && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] border border-slate-100">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center shrink-0 bg-white">
              <h3 className="text-lg font-bold text-slate-800">Edit Account Details</h3>
              <button onClick={() => setEditingCustomer(null)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleEditCustomer} className="flex flex-col min-h-0 flex-1">
              <div className="p-6 space-y-5 overflow-y-auto bg-white">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider ml-0.5">Account Number *</label>
                  <input 
                    type="text" 
                    required
                    value={editAccountNo}
                    onChange={e => setEditAccountNo(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none bg-white text-slate-900 font-medium transition-all"
                    placeholder="Enter RD Account No"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider ml-0.5">Account Name</label>
                  <input 
                    type="text" 
                    value={editAccountName}
                    onChange={e => setEditAccountName(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none bg-white text-slate-900 font-medium transition-all"
                    placeholder="Holder Name (Optional)"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider ml-0.5">Default Amount (₹) *</label>
                  <input 
                    type="number" 
                    required
                    min="10"
                    value={editAmount}
                    onChange={e => setEditAmount(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none bg-white text-slate-900 font-medium transition-all"
                    placeholder="e.g. 500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider ml-0.5">Mobile Number</label>
                    <input 
                      type="text" 
                      value={editMobileNumber}
                      onChange={e => setEditMobileNumber(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none bg-white text-slate-900 font-medium transition-all"
                      placeholder="Mobile No"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider ml-0.5">Maturity Time</label>
                    <select
                      value={editMaturityTime}
                      onChange={e => setEditMaturityTime(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none bg-white text-slate-900 font-medium transition-all"
                    >
                      <option value="1 Year">1 Year</option>
                      <option value="2 Year">2 Year</option>
                      <option value="3 Year">3 Year</option>
                      <option value="5 Year">5 Year</option>
                      <option value="10 Year">10 Year</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider ml-0.5">Total Deposit (₹)</label>
                    <input 
                      type="number" 
                      value={editTotalDeposit}
                      onChange={e => setEditTotalDeposit(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none bg-white text-slate-900 font-medium transition-all"
                      placeholder="Total Deposit"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider ml-0.5">Collection (₹)</label>
                    <input 
                      type="number" 
                      value={editCollectionAmount}
                      onChange={e => setEditCollectionAmount(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none bg-white text-slate-900 font-medium transition-all"
                      placeholder="Collection"
                    />
                  </div>
                </div>
              </div>
              
              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex gap-3 shrink-0">
                <button 
                  type="button"
                  onClick={() => setEditingCustomer(null)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 bg-white text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-all shadow-sm"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={savingEdit}
                  className="flex-1 px-4 py-2.5 bg-brand text-white rounded-xl font-medium hover:bg-brand/90 transition-all disabled:opacity-70 flex items-center justify-center gap-2 shadow-sm"
                >
                  {savingEdit ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Changes'}
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

      <AccountDetailsModal
        isOpen={showAccountDetails}
        onClose={() => {
          setShowAccountDetails(false);
          setSelectedAccountDetails(null);
        }}
        customer={selectedAccountDetails}
        user={user}
        refreshTrigger={refreshTrigger}
        addToast={addToast}
        onEditProfile={(customer) => {
          setEditingCustomer(customer);
          setEditAccountNo(customer.accountNo);
          setEditAccountName(customer.accountName);
          setEditAmount(customer.defaultAmount.toString());
          setEditMobileNumber(customer.mobileNumber || '');
          setEditMaturityTime(customer.maturityTime || '5 Year');
          setEditTotalDeposit(customer.totalDeposit?.toString() || '');
          setEditCollectionAmount(customer.collectionAmount?.toString() || '');
        }}
        onAddCollection={(customer) => {
          setManualAccountNo(customer.accountNo);
          setManualAccountName(customer.accountName);
          setManualAmount(customer.defaultAmount.toString());
          setManualMonths('1');
          setShowManualModal(true);
        }}
      />
    </div>
  );
}
