import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Download, 
  Trash2, 
  Search, 
  FileCheck, 
  Save, 
  Users, 
  Calendar, 
  IndianRupee, 
  Globe, 
  FileDown, 
  ClipboardList,
  ChevronRight,
  Loader2,
  Table as TableIcon,
  Info,
  X,
  CheckSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../firebase';
import { collection, query, getDocs, addDoc, serverTimestamp, where, doc, deleteDoc, updateDoc, writeBatch } from 'firebase/firestore';

interface LotCustomer {
  id: string;
  accountNo: string;
  name: string;
  amount: number;
}

interface BatchLot {
  id: string;
  customers: LotCustomer[];
  totalAmount: number;
  createdAt: any;
}

export default function LotMaker({ userId, addToast }: { userId: string, addToast: any }) {
  const [customers, setCustomers] = useState<LotCustomer[]>([]);
  const [selectedCustomers, setSelectedCustomers] = useState<LotCustomer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const handlePortalImport = async () => {
    if (!importText.trim()) {
      addToast("Please paste data from the portal", "error");
      return;
    }

    setIsImporting(true);
    try {
      const lines = importText.split('\n');
      const newCustomers: any[] = [];
      
      lines.forEach(line => {
        const accMatch = line.match(/\d{10}/);
        if (accMatch) {
          const accNo = accMatch[0];
          const parts = line.split(/\t|\s{2,}/).filter(p => p.trim());
          
          if (parts.length >= 3) {
            const name = parts.find(p => isNaN(Number(p)) && p.length > 3) || "Imported Account";
            const amountPart = parts.find((p) => !isNaN(Number(p)) && Number(p) % 10 === 0 && Number(p) >= 10);
            const amount = Number(amountPart) || 100;

            newCustomers.push({
              userId,
              accountNo: accNo,
              name: name.trim(),
              amount: amount,
              createdAt: serverTimestamp()
            });
          }
        }
      });

      if (newCustomers.length === 0) {
        addToast("No valid accounts found in the pasted text", "error");
        return;
      }

      for (const cust of newCustomers) {
        await addDoc(collection(db, 'lot_customers'), cust);
      }

      addToast(`Successfully imported ${newCustomers.length} accounts`, "success");
      setShowImport(false);
      setImportText('');
      fetchCustomers();
    } catch (error) {
      console.error("Import error:", error);
      addToast("Failed to process portal data", "error");
    } finally {
      setIsImporting(false);
    }
  };
  
  // New Customer Form
  const [newAccNo, setNewAccNo] = useState('');
  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState<number>(100);

  useEffect(() => {
    fetchCustomers();
  }, [userId]);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'lot_customers'), where('userId', '==', userId));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LotCustomer));
      setCustomers(data);
    } catch (error) {
      console.error("Error fetching customers:", error);
      addToast("Failed to load customer list", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccNo || !newName || newAmount <= 0) {
      addToast("Please fill all fields correctly", "error");
      return;
    }

    setSaving(true);
    try {
      const docRef = await addDoc(collection(db, 'lot_customers'), {
        userId,
        accountNo: newAccNo,
        name: newName,
        amount: newAmount,
        createdAt: serverTimestamp()
      });
      
      const newCust = { id: docRef.id, accountNo: newAccNo, name: newName, amount: newAmount };
      setCustomers(prev => [...prev, newCust]);
      setNewAccNo('');
      setNewName('');
      addToast("Account added successfully", "success");
    } catch (error) {
      console.error("Error adding customer:", error);
      addToast("Failed to add account", "error");
    } finally {
      setSaving(false);
    }
  };

  const toggleSelectCustomer = (cust: LotCustomer) => {
    if (selectedCustomers.find(c => c.id === cust.id)) {
      setSelectedCustomers(prev => prev.filter(c => c.id !== cust.id));
    } else {
      // Rule: In India Post RD lot, normally max amount is 20k or 50 accounts
      // We will just warn if it exceeds 20k
      const currentTotal = selectedCustomers.reduce((sum, c) => sum + c.amount, 0);
      if (currentTotal + cust.amount > 20000) {
        addToast("Note: This lot exceeds ₹20,000. It might need splitting.", "info");
      }
      setSelectedCustomers(prev => [...prev, cust]);
    }
  };

  const removeCustomer = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'lot_customers', id));
      setCustomers(prev => prev.filter(c => c.id !== id));
      setSelectedCustomers(prev => prev.filter(c => c.id !== id));
      addToast("Account removed", "success");
    } catch (error) {
      addToast("Failed to remove account", "error");
    }
  };

  const removeAllCustomers = async () => {
    if (customers.length === 0) return;
    if (!window.confirm("Are you sure you want to delete ALL accounts from your ledger? This action cannot be undone.")) return;
    
    try {
      const batch = writeBatch(db);
      customers.forEach(cust => {
        batch.delete(doc(db, 'lot_customers', cust.id));
      });
      await batch.commit();
      
      setCustomers([]);
      setSelectedCustomers([]);
      addToast("All accounts removed successfully", "success");
    } catch (error) {
      console.error(error);
      addToast("Failed to remove all accounts", "error");
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.accountNo.includes(searchTerm)
  );

  const selectedTotal = selectedCustomers.reduce((sum, c) => sum + c.amount, 0);

  const downloadLotFile = () => {
    if (selectedCustomers.length === 0) {
      addToast("Please select accounts first", "error");
      return;
    }

    // India Post Agent Lot Portal format usually expects a simple CSV or text file
    // The exact format can vary by office but often it is: AccountNo,Amount,0,0
    let content = "Account Number,Amount,Reference\n";
    selectedCustomers.forEach(c => {
      content += `${c.accountNo},${c.amount},AUTO\n`;
    });

    const element = document.createElement("a");
    const file = new Blob([content], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `RD_LOT_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(element);
    element.click();
    addToast("Lot file downloaded successfully", "success");
  };

  return (
    <div className="space-y-8 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-5xl font-black tracking-tighter text-slate-900 mb-2">
            Lot <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand to-gold">Maker</span>
          </h2>
          <p className="text-slate-500 font-medium text-lg">Professional RD schedule generator and batch manager.</p>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
           <button 
             onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'checklists' }))} 
             className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-800 rounded-2xl text-xs font-black uppercase tracking-widest hover:border-brand hover:text-brand transition-all shadow-sm group"
           >
             <CheckSquare className="w-4 h-4 text-brand" />
             Lot Checklists
           </button>
           <button 
             onClick={() => setShowImport(true)}
             className="flex items-center gap-2 px-6 py-3 bg-brand text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-brand-dark transition-all shadow-lg shadow-brand/20"
           >
             <Download className="w-4 h-4" />
             Import from Portal
           </button>
           <button 
             onClick={() => window.open('https://dopagent.indiapost.gov.in/', '_blank')}
             className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-100 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-600 hover:text-brand hover:border-brand/20 transition-all shadow-sm"
           >
             <Globe className="w-4 h-4" />
             DOP Portal
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Account Management */}
        <div className="lg:col-span-8 space-y-8">
          {/* Add New Account */}
          <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-premium relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-brand/5 rounded-full -mr-32 -mt-32 blur-3xl" />
            
            <div className="flex items-center gap-3 mb-8 relative z-10">
              <div className="w-12 h-12 bg-brand/10 rounded-2xl flex items-center justify-center">
                <Plus className="w-6 h-6 text-brand" />
              </div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Add New Account</h3>
            </div>

            <form onSubmit={handleAddCustomer} className="grid grid-cols-1 md:grid-cols-4 gap-4 relative z-10">
              <div className="md:col-span-1 space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Account No</label>
                <input 
                  type="text" 
                  placeholder="1234567890"
                  value={newAccNo}
                  onChange={(e) => setNewAccNo(e.target.value)}
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/5 outline-none font-bold transition-all"
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Customer Name</label>
                <input 
                  type="text" 
                  placeholder="Enter Name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/5 outline-none font-bold transition-all"
                />
              </div>
              <div className="md:col-span-1 space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Amount</label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <IndianRupee className="w-4 h-4" />
                  </div>
                  <input 
                    type="number" 
                    value={newAmount}
                    onChange={(e) => setNewAmount(Number(e.target.value))}
                    className="w-full pl-10 pr-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/5 outline-none font-bold transition-all"
                  />
                </div>
              </div>
              <div className="md:col-span-4 mt-2">
                <button 
                  type="submit"
                  disabled={saving}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-lg shadow-slate-200 flex items-center justify-center gap-3 hover:bg-slate-800 transition-all disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  Save Account to Database
                </button>
              </div>
            </form>
          </div>

          {/* Account Lists */}
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-premium overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4">
                <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                  <Users className="w-6 h-6 text-brand" />
                  Agent Ledger
                </h3>
                <div className="bg-slate-200 h-6 w-px mx-2" />
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{customers.length} ACCOUNTS</span>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="relative w-64">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Search ledger..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-brand focus:ring-4 focus:ring-brand/5 transition-all"
                  />
                </div>
                {customers.length > 0 && (
                  <button
                    onClick={removeAllCustomers}
                    className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 bg-white border border-slate-200 rounded-xl transition-all shadow-sm group"
                    title="Delete All Accounts"
                  >
                    <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4 text-slate-400">
                  <Loader2 className="w-12 h-12 animate-spin text-brand" />
                  <p className="font-bold animate-pulse">Loading ledger...</p>
                </div>
              ) : filteredCustomers.length > 0 ? (
                <div className="divide-y divide-slate-50">
                  {filteredCustomers.map((cust) => (
                    <div 
                      key={cust.id} 
                      className={`flex items-center justify-between p-6 transition-all group ${
                        selectedCustomers.find(c => c.id === cust.id) ? 'bg-brand/5' : 'hover:bg-slate-50/50'
                      }`}
                    >
                      <div className="flex items-center gap-6">
                        <button 
                          onClick={() => toggleSelectCustomer(cust)}
                          className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center transition-all ${
                            selectedCustomers.find(c => c.id === cust.id)
                              ? 'bg-brand border-brand text-white shadow-lg shadow-brand/20'
                              : 'border-slate-100 text-transparent hover:border-brand/30'
                          }`}
                        >
                          <FileCheck className="w-5 h-5" />
                        </button>
                        <div>
                          <p className="font-black text-slate-900 tracking-tight text-lg group-hover:text-brand transition-colors">{cust.name}</p>
                          <p className="text-xs font-mono text-slate-400 flex items-center gap-2">
                             {cust.accountNo}
                             <span className="w-1 h-1 bg-slate-300 rounded-full" />
                             ₹{cust.amount.toLocaleString()} Monthly
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <button 
                          onClick={() => removeCustomer(cust.id)}
                          className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                        <div className="p-3 bg-slate-50 rounded-xl font-black text-brand text-sm shadow-sm">
                           ₹{cust.amount.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-24 text-center">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-200">
                    <Users className="w-10 h-10" />
                  </div>
                  <h4 className="text-slate-400 font-black uppercase text-xs tracking-widest mb-2">No Records Found</h4>
                  <p className="text-slate-300 text-sm">Add accounts to start building your lot.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Lot Summary & Export */}
        <div className="lg:col-span-4 space-y-8">
           <div className="sticky top-8 space-y-8">
              {/* Lot Summary Card */}
              <div className="glass-card-gold p-8 rounded-[2.5rem] border border-gold/20 shadow-premium overflow-hidden relative">
                 <div className="absolute top-0 right-0 w-48 h-48 bg-brand/5 rounded-full -mr-24 -mt-24 blur-3xl" />
                 
                 <div className="relative z-10 space-y-8">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-white rounded-2xl shadow-premium border border-gold/30 flex items-center justify-center">
                          <ClipboardList className="w-6 h-6 text-brand" />
                        </div>
                        <div>
                          <h3 className="text-xl font-black text-slate-900 tracking-tight">Active Lot</h3>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Schedule Summary</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setSelectedCustomers([])}
                        className="text-[10px] font-black text-slate-400 hover:text-red-500 transition-colors uppercase tracking-widest"
                      >
                        Clear All
                      </button>
                    </div>

                    <div className="space-y-6">
                      <div className="p-6 bg-white/40 rounded-3xl border border-white">
                        <span className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Total Lot Amount</span>
                        <div className={`text-4xl font-black tabular-nums tracking-tighter ${selectedTotal > 20000 ? 'text-red-600' : 'text-slate-900'}`}>
                           ₹{selectedTotal.toLocaleString()}
                        </div>
                        {selectedTotal > 20000 && (
                          <p className="text-[10px] font-black text-red-500 uppercase mt-2 flex items-center gap-1">
                            <ShieldAlert className="w-3 h-3" /> Exceeds ₹20,000 Portal Limit
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between px-2">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lot Size</span>
                          <span className="text-lg font-black text-slate-900">{selectedCustomers.length} Accounts</span>
                        </div>
                        <div className="text-right flex flex-col">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Date</span>
                          <span className="text-lg font-black text-slate-900">{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                        </div>
                      </div>

                      <button 
                        onClick={downloadLotFile}
                        disabled={selectedCustomers.length === 0}
                        className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 disabled:opacity-50"
                      >
                        <FileDown className="w-5 h-5" />
                        Download Lot File
                      </button>
                    </div>
                 </div>
              </div>

              {/* Instructions / Help */}
              <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl">
                 <div className="absolute bottom-0 right-0 w-64 h-64 bg-brand/10 rounded-full -mr-32 -mb-32 blur-3xl opacity-50" />
                 
                 <h3 className="text-lg font-black tracking-tight mb-6 flex items-center gap-3">
                    <Info className="w-6 h-6 text-gold" />
                    How to Import Lot
                 </h3>
                 
                 <div className="space-y-4">
                    {[
                      "Prepare your lot by selecting accounts from your ledger.",
                      "Verify that the total amount is within ₹20,000 limits.",
                      "Download the Lot File using the black button above.",
                      "Log in to the India Post Agent Portal (DOP Agent).",
                      "Go to 'Reports' -> 'Bulk Upload' and upload the downloaded file."
                    ].map((step, i) => (
                      <div key={i} className="flex gap-4">
                        <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-black shrink-0">
                          {i + 1}
                        </div>
                        <p className="text-sm text-slate-400 font-medium leading-relaxed">
                          {step}
                        </p>
                      </div>
                    ))}
                 </div>
              </div>
           </div>
        </div>
      </div>

      {/* Import Modal */}
      <AnimatePresence>
        {showImport && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowImport(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-brand/10 rounded-2xl flex items-center justify-center">
                    <Download className="w-6 h-6 text-brand" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900">Import from Portal</h3>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">DOP Agent Data Sync</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowImport(false)}
                  className="p-3 text-slate-400 hover:text-red-500 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                  <h4 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-brand" />
                    Instructions
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed font-medium">
                    1. Log in to the India Post Agent Portal.<br />
                    2. Go to the <span className="text-brand font-bold">List of Accounts</span> or <span className="text-brand font-bold">Reports</span> section.<br />
                    3. Copy the table data (Select accounts, Ctrl+C).<br />
                    4. Paste it into the box below (Ctrl+V).
                  </p>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Paste Portal Data Here</label>
                  <textarea 
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder="Example: 1 1234567890 John Doe 500.00 ..."
                    className="w-full h-48 px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/5 outline-none font-medium text-sm transition-all"
                  />
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={() => setShowImport(false)}
                    className="flex-1 py-4 border-2 border-slate-100 text-slate-600 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handlePortalImport}
                    disabled={isImporting || !importText.trim()}
                    className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 disabled:opacity-50"
                  >
                    {isImporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileCheck className="w-5 h-5" />}
                    Process and Save Accounts
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ShieldAlert(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </svg>
  );
}
