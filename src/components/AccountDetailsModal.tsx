import React, { useState, useEffect } from 'react';
import { X, Trash2, Edit, Plus, Phone, Calendar as CalendarIcon, Hash, Percent, Clock, ShieldCheck, FileText, IndianRupee, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, getDocs, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { User } from 'firebase/auth';
import ConfirmationModal from './ConfirmationModal';

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

interface AccountDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  user: User;
  onEditProfile: (customer: Customer) => void;
  onAddCollection: (customer: Customer) => void;
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
  refreshTrigger: number;
}

export default function AccountDetailsModal({ 
  isOpen, 
  onClose, 
  customer, 
  user,
  onEditProfile,
  onAddCollection,
  addToast,
  refreshTrigger
}: AccountDetailsModalProps) {
  const [collections, setCollections] = useState<CollectionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [collectionToDelete, setCollectionToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && customer) {
      fetchCollections();
    }
  }, [isOpen, customer, refreshTrigger]);

  const fetchCollections = async () => {
    if (!customer) return;
    setLoading(true);
    try {
      const collectionsRef = collection(db, 'collections');
      const q = query(
        collectionsRef, 
        where('agentId', '==', user.uid),
        where('accountNo', '==', customer.accountNo)
      );
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CollectionRecord));
      // Sort by date descending
      data.sort((a, b) => new Date(b.collectionDate).getTime() - new Date(a.collectionDate).getTime());
      setCollections(data);
    } catch (error) {
      console.error("Error fetching collections:", error);
      addToast("Failed to load collection history", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCollection = async () => {
    if (!collectionToDelete) return;
    try {
      await deleteDoc(doc(db, 'collections', collectionToDelete));
      addToast("Collection record deleted", "success");
      setCollections(collections.filter(c => c.id !== collectionToDelete));
    } catch (error) {
      console.error("Error deleting collection:", error);
      addToast("Failed to delete record", "error");
    } finally {
      setShowDeleteConfirm(false);
      setCollectionToDelete(null);
    }
  };

  if (!customer) return null;

  const totalPaid = collections.reduce((sum, c) => sum + Number(c.amount), 0);
  const monthsPaid = collections.length; // Approximate, depends on installmentMonths but let's keep it simple

  // Filter collections by selected month/year
  const filteredCollections = collections.filter(c => {
    const d = new Date(c.collectionDate);
    return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
  });

  const monthCollectedAmount = filteredCollections.reduce((sum, c) => sum + Number(c.amount), 0);

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-hidden">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-slate-50 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200"
          >
            {/* Header */}
            <div className="bg-blue-600 px-6 py-4 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-xl font-bold text-white">{customer.accountName || 'Account Details'}</h2>
                <div className="flex items-center gap-3 mt-1">
                  <p className="text-sm font-medium text-blue-100">#{customer.accountNo}</p>
                  <div className="flex items-center gap-2">
                    <button className="p-1.5 bg-blue-500/50 hover:bg-blue-500 rounded-full text-white transition-colors">
                      <Phone className="w-3.5 h-3.5" />
                    </button>
                    <button className="p-1.5 bg-green-500/80 hover:bg-green-500 rounded-full text-white transition-colors">
                      <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="css-i6dzq1"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                    </button>
                  </div>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 text-blue-100 hover:text-white hover:bg-blue-500 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              
              {/* Top Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Monthly RD</p>
                  <p className="text-lg font-bold text-slate-900 flex items-center"><IndianRupee className="w-4 h-4 mr-1" />{customer.defaultAmount}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Month Paid</p>
                  <p className="text-lg font-bold text-slate-900">{monthsPaid}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hidden sm:block">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Short Code</p>
                  <p className="text-lg font-bold text-slate-900">---</p>
                </div>
              </div>

              {/* Middle Info Grid */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
                  <div className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Maturity Time</p>
                      <p className="text-base font-bold text-slate-900">{customer.maturityTime || '5 Year'}</p>
                    </div>
                    <button className="w-8 h-8 rounded-full bg-brand text-white flex items-center justify-center shadow-sm hover:bg-brand/90 transition-colors">
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="p-4 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-slate-500">Rate:</span>
                      <span className="text-sm font-bold text-slate-900">5.8%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-slate-500">Paid Amount:</span>
                      <span className="text-sm font-bold text-slate-900 flex items-center"><IndianRupee className="w-3 h-3 mr-0.5" />{totalPaid}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-slate-500">Maturity Amount:</span>
                      <span className="text-sm font-bold text-slate-900 flex items-center"><IndianRupee className="w-3 h-3 mr-0.5" />---</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Lower Info Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Mobile Number</p>
                  <p className="text-sm font-bold text-slate-900 truncate">{customer.mobileNumber || '---'}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Next Due Date</p>
                  <p className="text-sm font-bold text-slate-900">---</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Opened On</p>
                  <p className="text-sm font-bold text-slate-900">---</p>
                </div>
              </div>

              {/* Bottom Info Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Deposit</p>
                  <p className="text-lg font-bold text-brand flex items-center"><IndianRupee className="w-4 h-4 mr-1" />{customer.totalDeposit || totalPaid}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Aaslas Number</p>
                  <p className="text-sm font-bold text-slate-900">---</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-center col-span-2 sm:col-span-1">
                  <button className="w-full py-2 bg-cyan-500 hover:bg-cyan-600 text-white font-bold rounded-lg transition-colors shadow-sm uppercase tracking-wider text-sm">
                    Get PIN
                  </button>
                </div>
              </div>

              {/* Collection History Section */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <h3 className="text-lg font-bold text-slate-800">Collection</h3>
                  <div className="flex items-center gap-2">
                    <select 
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(Number(e.target.value))}
                      className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:ring-2 focus:ring-brand/20 outline-none"
                    >
                      {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
                    </select>
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(Number(e.target.value))}
                      className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:ring-2 focus:ring-brand/20 outline-none"
                    >
                      {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 divide-x divide-slate-100 border-b border-slate-100 bg-slate-50">
                  <div className="p-3 text-center">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Collected Amount</p>
                    <p className="text-base font-bold text-slate-900 flex items-center justify-center"><IndianRupee className="w-3.5 h-3.5 mr-0.5" />{customer.collectionAmount || monthCollectedAmount}</p>
                  </div>
                  <div className="p-3 text-center">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Pending Amount</p>
                    <p className="text-base font-bold text-slate-900 flex items-center justify-center"><IndianRupee className="w-3.5 h-3.5 mr-0.5" />{Math.max(0, customer.defaultAmount - monthCollectedAmount)}</p>
                  </div>
                </div>

                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-white border-b border-slate-100">
                        <th className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount Collected</th>
                        <th className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Collection Date</th>
                        <th className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {loading ? (
                        <tr>
                          <td colSpan={3} className="p-8 text-center">
                            <Loader2 className="w-6 h-6 animate-spin text-brand mx-auto" />
                          </td>
                        </tr>
                      ) : filteredCollections.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="p-8 text-center text-slate-500 text-sm font-medium">
                            No collections found for this month.
                          </td>
                        </tr>
                      ) : (
                        filteredCollections.map((record, index) => (
                          <tr key={`${record.id}-${index}-desktop`} className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-3 text-sm font-bold text-slate-900">
                              <div className="flex items-center">
                                <IndianRupee className="w-3.5 h-3.5 mr-1 text-slate-400" />
                                {record.amount}
                              </div>
                            </td>
                            <td className="p-3 text-sm font-medium text-slate-600">
                              {new Date(record.collectionDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                            </td>
                            <td className="p-3 text-center">
                              <button 
                                onClick={() => {
                                  setCollectionToDelete(record.id);
                                  setShowDeleteConfirm(true);
                                }}
                                className="p-1.5 text-slate-400 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="sm:hidden flex flex-col divide-y divide-slate-100">
                  {loading ? (
                    <div className="p-8 text-center">
                      <Loader2 className="w-6 h-6 animate-spin text-brand mx-auto" />
                    </div>
                  ) : filteredCollections.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-sm font-medium">
                      No collections found for this month.
                    </div>
                  ) : (
                    filteredCollections.map((record, index) => (
                      <div key={`${record.id}-${index}-mobile`} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center text-sm font-bold text-slate-900">
                            <IndianRupee className="w-3.5 h-3.5 mr-1 text-slate-400" />
                            {record.amount}
                          </div>
                          <div className="text-xs text-slate-500 font-medium">
                            {new Date(record.collectionDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                          </div>
                        </div>
                        <button 
                          onClick={() => {
                            setCollectionToDelete(record.id);
                            setShowDeleteConfirm(true);
                          }}
                          className="p-2 text-slate-400 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

            {/* Bottom Actions */}
            <div className="bg-white p-4 border-t border-slate-200 flex gap-3 shrink-0">
              <button 
                onClick={() => {
                  onClose();
                  onEditProfile(customer);
                }}
                className="flex-1 py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors shadow-sm text-sm uppercase tracking-wider"
              >
                <Edit className="w-4 h-4" />
                Edit Profile
              </button>
              <button 
                onClick={() => {
                  onClose();
                  onAddCollection(customer);
                }}
                className="flex-1 py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors shadow-sm text-sm uppercase tracking-wider"
              >
                <Plus className="w-4 h-4" />
                Add Collection
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <ConfirmationModal
        isOpen={showDeleteConfirm}
        title="Delete Record"
        message="Are you sure you want to delete this collection record? This action cannot be undone."
        confirmText="Delete"
        onConfirm={handleDeleteCollection}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setCollectionToDelete(null);
        }}
      />
    </AnimatePresence>
  );
}
