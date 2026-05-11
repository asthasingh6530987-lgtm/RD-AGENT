import React, { useState, useEffect } from 'react';
import { 
  Calculator, 
  Percent, 
  TrendingUp, 
  Briefcase, 
  CalendarDays, 
  Info, 
  Clock, 
  Wallet, 
  ChevronRight, 
  ArrowRight,
  Zap,
  ShieldCheck,
  Heart,
  Baby,
  Building2,
  BadgePercent,
  Coins,
  History,
  Save,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type SchemeType = 
  | 'normal' 
  | 'rd' 
  | 'td' 
  | 'mis' 
  | 'scss' 
  | 'ssa' 
  | 'nsc' 
  | 'ppf' 
  | 'kvp' 
  | 'mssc' 
  | 'sb'
  | 'agent';

interface SchemeInfo {
  id: SchemeType;
  name: string;
  rate: number;
  description: string;
  compounding?: 'monthly' | 'quarterly' | 'annually' | 'none';
  icon: React.ReactNode;
}

const SCHEMES: SchemeInfo[] = [
  { id: 'normal', name: 'General FD', rate: 7.0, description: 'Universal Fixed Deposit calculator with custom rates.', icon: <Calculator className="w-5 h-5" /> },
  { id: 'rd', name: 'PO RD', rate: 6.7, description: 'Recurring Deposit: 5-year term, quarterly compounding.', icon: <Clock className="w-5 h-5" /> },
  { id: 'td', name: 'PO TD', rate: 7.5, description: 'Time Deposit: 1 to 5 year fixed terms.', icon: <CalendarDays className="w-5 h-5" /> },
  { id: 'mis', name: 'PO MIS', rate: 7.4, description: 'Monthly Income Scheme: Regular monthly interest payout.', icon: <Wallet className="w-5 h-5" /> },
  { id: 'scss', name: 'PO SCSS', rate: 8.2, description: 'Senior Citizen Savings Scheme: High yield for seniors.', icon: <ShieldCheck className="w-5 h-5" /> },
  { id: 'agent', name: 'Agent Calc', rate: 4.0, description: 'Commission calculator for monthly collection volumes.', icon: <Briefcase className="w-5 h-5" /> },
  { id: 'ssa', name: 'PO SSY', rate: 8.2, description: 'Sukanya Samriddhi: Empowering the girl child.', icon: <Baby className="w-5 h-5" /> },
  { id: 'nsc', name: 'PO NSC', rate: 7.7, description: 'National Savings Certificate: 5-year tax-saving bond.', icon: <Building2 className="w-5 h-5" /> },
  { id: 'ppf', name: 'PO PPF', rate: 7.1, description: 'Public Provident Fund: Long-term tax-free wealth.', icon: <TrendingUp className="w-5 h-5" /> },
  { id: 'kvp', name: 'PO KVP', rate: 7.5, description: 'Kisan Vikas Patra: Double your investment.', icon: <Zap className="w-5 h-5" /> },
  { id: 'mssc', name: 'PO MSSC', rate: 7.5, description: 'Mahila Samman: Special scheme for women.', icon: <Heart className="w-5 h-5" /> },
  { id: 'sb', name: 'PO SB', rate: 4.0, description: 'Savings Account: Flexible daily balance interest.', icon: <Coins className="w-5 h-5" /> },
];

interface SavedCalculation {
  id: string;
  schemeId: SchemeType;
  schemeName: string;
  principal: number;
  monthlyInstallment?: number;
  rate: number;
  tenure: number;
  maturityValue: number;
  totalInterest: number;
  date: string;
}

export default function FinanceCalculator() {
  const [activeTab, setActiveTab] = useState<SchemeType>(() => {
    return (localStorage.getItem('fcalc_active_tab') as SchemeType) || 'rd';
  });
  const [principal, setPrincipal] = useState<number | string>(() => {
    return Number(localStorage.getItem('fcalc_principal')) || 10000;
  });
  const [monthlyInstallment, setMonthlyInstallment] = useState<number | string>(() => {
    return Number(localStorage.getItem('fcalc_monthly')) || 1000;
  });
  const [rate, setRate] = useState<number | string>(6.7);
  const [tenure, setTenure] = useState<number | string>(5); // years
  const [tenureMonths, setTenureMonths] = useState<number | string>(60);
  const [results, setResults] = useState<any>(null);
  const [history, setHistory] = useState<SavedCalculation[]>(() => {
    const saved = localStorage.getItem('fcalc_history');
    return saved ? JSON.parse(saved) : [];
  });

  // Persist basic inputs
  useEffect(() => {
    localStorage.setItem('fcalc_active_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem('fcalc_principal', principal.toString());
  }, [principal]);

  useEffect(() => {
    localStorage.setItem('fcalc_monthly', monthlyInstallment.toString());
  }, [monthlyInstallment]);

  useEffect(() => {
    localStorage.setItem('fcalc_history', JSON.stringify(history));
  }, [history]);

  // Sync rate when tab changes
  useEffect(() => {
    const scheme = SCHEMES.find(s => s.id === activeTab);
    if (scheme) {
      setRate(scheme.rate);
      // Auto-set tenure for fixed schemes
      if (activeTab === 'rd' || activeTab === 'nsc') {
        setTenure(5);
        setTenureMonths(60);
      } else if (activeTab === 'mis') {
        setTenure(5);
      } else if (activeTab === 'mssc') {
        setTenure(2);
      } else if (activeTab === 'scss') {
        setTenure(5);
      } else if (activeTab === 'agent') {
        setTenureMonths(12);
      } else if (activeTab === 'ppf' || activeTab === 'ssa') {
        setTenure(15);
      }
    }
  }, [activeTab]);

  useEffect(() => {
    calculate();
  }, [activeTab, principal, monthlyInstallment, rate, tenure, tenureMonths]);

  const calculate = () => {
    const p = Number(principal) || 0;
    const mi = Number(monthlyInstallment) || 0;
    const r = Number(rate) || 0;
    const t = Number(tenure) || 0;
    const tm = Number(tenureMonths) || 0;

    let maturityValue = 0;
    let totalInvestment = 0;
    let totalInterest = 0;
    let monthlyIncome = 0;
    let quarterlyIncome = 0;

    switch (activeTab) {
      case 'rd': {
        totalInvestment = mi * tm;
        const i = r / 400; // quarterly rate
        const n = tm / 3; // number of quarters
        // Post Office Formula for RD Maturity:
        // P * ( (1+i)^n - 1 ) / (1 - (1+i)^(-1/3))
        if (i !== 0 && Math.pow(1 + i, -1 / 3) !== 1) {
            maturityValue = mi * (Math.pow(1 + i, n) - 1) / (1 - Math.pow(1 + i, -1 / 3));
        } else {
            maturityValue = totalInvestment;
        }
        totalInterest = maturityValue - totalInvestment;
        break;
      }
      case 'td':
      case 'normal': {
        totalInvestment = p;
        // PO TD compounded quarterly
        const quarters = t * 4;
        maturityValue = p * Math.pow(1 + (r / 400), quarters);
        totalInterest = maturityValue - totalInvestment;
        break;
      }
      case 'mis': {
        totalInvestment = p;
        monthlyIncome = (p * r) / 1200;
        maturityValue = p; // Principal paid back at end
        totalInterest = monthlyIncome * (t * 12);
        break;
      }
      case 'scss': {
        totalInvestment = p;
        quarterlyIncome = (p * r) / 400;
        maturityValue = p;
        totalInterest = quarterlyIncome * (t * 4);
        break;
      }
      case 'nsc':
      case 'mssc': {
        totalInvestment = p;
        // Compounded annually (NSC) or quarterly (MSSC)
        const compoundingFrequency = (activeTab === 'mssc') ? 4 : 1;
        const n = t * compoundingFrequency;
        const rateCalc = r / (compoundingFrequency * 100);
        maturityValue = p * Math.pow(1 + rateCalc, n);
        totalInterest = maturityValue - totalInvestment;
        break;
      }
      case 'ppf':
      case 'ssa': {
        // Typically these are calculated based on regular yearly investments
        totalInvestment = p * t;
        const rateCalc = r / 100;
        // Future Value of Annuity Due formula
        maturityValue = p * ((Math.pow(1 + rateCalc, t) - 1) / rateCalc) * (1 + rateCalc);
        totalInterest = maturityValue - totalInvestment;
        break;
      }
      case 'kvp': {
        totalInvestment = p;
        // KVP doubles usually, but based on current rate 7.5%
        // Doubling time = 72 / rate (rule of 72) or more accurately ln(2)/ln(1+r)
        // Current KVP doubles in 115 months
        const monthsKVP = 115;
        maturityValue = p * 2;
        totalInterest = p;
        break;
      }
      case 'sb': {
        totalInvestment = p;
        maturityValue = p + (p * r * t) / 100;
        totalInterest = maturityValue - totalInvestment;
        break;
      }
      case 'agent': {
        // Agent Calculation: 
        // 1. Total Collection Volume
        totalInvestment = mi * tm;
        // 2. Monthly Commission
        monthlyIncome = (mi * r) / 100;
        // 3. Total Commission (Maturity in this perspective)
        maturityValue = monthlyIncome * tm;
        totalInterest = maturityValue;
        break;
      }
    }

    setResults({
      maturityValue,
      totalInvestment,
      totalInterest,
      monthlyIncome,
      quarterlyIncome,
      agentCommission: activeTab === 'rd' ? totalInvestment * 0.04 : 0
    });
  };

  const handleSaveCalculation = () => {
    if (!results) return;
    const scheme = SCHEMES.find(s => s.id === activeTab);
    const newCalc: SavedCalculation = {
      id: Date.now().toString(),
      schemeId: activeTab,
      schemeName: scheme?.name || activeTab,
      principal: activeTab === 'rd' ? Number(monthlyInstallment) || 0 : Number(principal) || 0,
      monthlyInstallment: activeTab === 'rd' ? Number(monthlyInstallment) || 0 : undefined,
      rate: Number(rate) || 0,
      tenure: activeTab === 'rd' ? Number(tenureMonths) || 0 : Number(tenure) || 0,
      maturityValue: results.maturityValue,
      totalInterest: results.totalInterest,
      date: new Date().toLocaleString()
    };
    setHistory(prev => [newCalc, ...prev].slice(0, 10)); // Keep last 10
  };

  const removeHistoryItem = (id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val).replace('₹', 'Rs. ');
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-5xl font-black tracking-tighter text-slate-900 mb-2">
            Finance <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand to-gold">Calculators</span>
          </h2>
          <p className="text-slate-500 font-medium text-lg">Professional interest and maturity calculation suite for Post Office schemes.</p>
        </div>
        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
          <div className="p-2.5 bg-brand/10 text-brand rounded-xl">
            <BadgePercent className="w-5 h-5" />
          </div>
          <div className="pr-4">
            <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Current Highest</span>
            <span className="block text-slate-900 font-black tracking-tight">8.2% p.a.</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:col-span-12 gap-8">
        {/* Sidebar Tabs */}
        <div className="lg:col-span-4 space-y-3">
          <div className="glass-card-gold p-6 rounded-[2.5rem] border border-gold/20 shadow-premium overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gold/5 rounded-full -mr-16 -mt-16 blur-2xl" />
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
              <div className="w-6 h-1 bg-brand rounded-full" /> Select Scheme
            </h3>
            <div className="grid grid-cols-1 gap-2">
              {SCHEMES.map((scheme) => (
                <button
                  key={scheme.id}
                  onClick={() => setActiveTab(scheme.id)}
                  className={`group flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 relative overflow-hidden ${
                    activeTab === scheme.id 
                      ? 'bg-slate-900 text-white shadow-xl scale-[1.02] z-10' 
                      : 'bg-white/50 text-slate-600 hover:bg-white hover:text-brand border border-transparent hover:border-gold/30'
                  }`}
                >
                  <div className={`p-2 rounded-xl transition-all duration-500 ${
                    activeTab === scheme.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-brand/10 group-hover:text-brand'
                  }`}>
                    {scheme.icon}
                  </div>
                  <div className="flex flex-col items-start min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm tracking-tight truncate uppercase">{scheme.name}</span>
                      <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                        activeTab === scheme.id ? 'bg-white/10 text-gold' : 'bg-slate-100 text-slate-500'
                      }`}>{scheme.rate}%</span>
                    </div>
                    <span className={`text-[10px] font-medium leading-tight truncate w-full ${
                      activeTab === scheme.id ? 'text-slate-400' : 'text-slate-400 group-hover:text-slate-500'
                    }`}>{scheme.description}</span>
                  </div>
                  <ChevronRight className={`ml-auto w-4 h-4 transition-all duration-500 ${
                    activeTab === scheme.id ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'
                  }`} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Calculator Body */}
        <div className="lg:col-span-8 flex flex-col gap-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Input Panel */}
            <div className="glass-card p-8 rounded-[2.5rem] border border-slate-100 shadow-premium space-y-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-32 h-32 bg-brand/5 rounded-full -ml-16 -mt-16 blur-2xl" />
              
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                  <Calculator className="w-6 h-6 text-brand" />
                  Parameters
                </h3>
                <span className="text-[10px] font-black text-brand bg-brand/10 px-3 py-1.5 rounded-full uppercase tracking-widest">
                  Live Mode
                </span>
              </div>

              <div className="space-y-6">
                {activeTab === 'rd' || activeTab === 'agent' ? (
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      {activeTab === 'agent' ? 'Monthly Collection Volume' : 'Monthly Deposit'}
                    </label>
                    <div className="relative group">
                      <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand transition-colors">
                        <Wallet className="w-5 h-5" />
                      </div>
                      <input 
                        type="number" 
                        value={monthlyInstallment === 0 ? '' : monthlyInstallment} 
                        onChange={(e) => setMonthlyInstallment(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full pl-14 pr-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/5 outline-none font-black text-lg transition-all"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      {activeTab === 'ppf' || activeTab === 'ssa' ? 'Yearly Deposit' : 'Investment Amount'}
                    </label>
                    <div className="relative group">
                      <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand transition-colors">
                        <Wallet className="w-5 h-5" />
                      </div>
                      <input 
                        type="number" 
                        value={principal === 0 ? '' : principal} 
                        onChange={(e) => setPrincipal(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full pl-14 pr-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/5 outline-none font-black text-lg transition-all"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      {activeTab === 'agent' ? 'Commission Rate (%)' : 'Interest Rate (%)'}
                    </label>
                    <div className="relative group">
                      <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand transition-colors">
                        <Percent className="w-4 h-4" />
                      </div>
                      <input 
                        type="number" 
                        step="0.1"
                        value={rate === 0 ? '' : rate} 
                        onChange={(e) => setRate(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/5 outline-none font-black transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      {activeTab === 'rd' || activeTab === 'agent' ? 'Tenure (Months)' : 'Tenure (Years)'}
                    </label>
                    <div className="relative group">
                      <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand transition-colors">
                        <Clock className="w-4 h-4" />
                      </div>
                      {activeTab === 'rd' || activeTab === 'agent' ? (
                        <input 
                          type="number" 
                          value={tenureMonths === 0 ? '' : tenureMonths} 
                          onChange={(e) => setTenureMonths(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/5 outline-none font-black transition-all"
                        />
                      ) : (
                        <input 
                          type="number" 
                          value={tenure === 0 ? '' : tenure} 
                          onChange={(e) => setTenure(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/5 outline-none font-black transition-all"
                        />
                      )}
                    </div>
                  </div>
                </div>

                {activeTab === 'rd' && (
                  <div className="p-4 bg-gold-light/10 border border-gold/20 rounded-2xl flex items-start gap-3">
                    <Info className="w-5 h-5 text-gold shrink-0 mt-0.5" />
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                      RD agent commission is calculated at <span className="font-bold text-brand">4%</span> of the total collection.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Results Panel */}
            <div className="glass-card-gold p-8 rounded-[2.5rem] border border-gold/20 shadow-premium flex flex-col justify-between relative overflow-hidden">
               <div className="absolute top-0 right-0 w-48 h-48 bg-brand/5 rounded-full -mr-24 -mt-24 blur-3xl" />
               
               <div className="relative z-10">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-12 h-12 bg-white rounded-2xl shadow-premium border border-gold/30 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-brand" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">
                      {activeTab === 'agent' ? 'Total Earnings' : 'Est. Maturity'}
                    </h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      {activeTab === 'agent' ? 'Commission Projection' : 'Growth Projection'}
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <span className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 px-1">
                      {activeTab === 'agent' ? 'Total Accrued Commission' : 'Total Maturity Volume'}
                    </span>
                    <div className="text-5xl font-black text-slate-900 tracking-tighter tabular-nums mb-1">
                      {formatCurrency(results?.maturityValue || 0)}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/40 p-5 rounded-3xl border border-white space-y-1">
                      <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {activeTab === 'agent' ? 'Total Collection' : 'Investment'}
                      </span>
                      <span className="block text-slate-900 font-black tracking-tight text-lg">
                        {formatCurrency(results?.totalInvestment || 0)}
                      </span>
                    </div>
                    <div className="bg-white/40 p-5 rounded-3xl border border-white space-y-1">
                      <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {activeTab === 'agent' ? 'Total Payout' : 'Interest Earned'}
                      </span>
                      <span className="block text-brand font-black tracking-tight text-lg">
                        {formatCurrency(results?.totalInterest || 0)}
                      </span>
                    </div>
                  </div>

                  <button 
                    onClick={handleSaveCalculation}
                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
                  >
                    <Save className="w-4 h-4" />
                    Save to Local History
                  </button>
                </div>
               </div>

               {activeTab === 'agent' && (
                 <div className="mt-8 pt-8 border-t border-gold/20 relative z-10">
                   <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-4">Monthly Potential Breakdown</h4>
                   <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                     {[...Array(Math.min(tenureMonths, 12))].map((_, i) => (
                       <div key={i} className="flex items-center justify-between p-3 bg-white/30 rounded-xl border border-white/50 text-[10px] font-black group hover:bg-white/50 transition-all">
                        <span className="text-slate-400 group-hover:text-brand transition-colors">MONTH {i + 1}</span>
                        <div className="text-right">
                          <span className="block text-slate-900">{formatCurrency(Number(monthlyInstallment) || 0)} VOLUME</span>
                          <span className="block text-brand">+{formatCurrency(((Number(monthlyInstallment) || 0) * (Number(rate) || 0)) / 100)} COMM.</span>
                        </div>
                       </div>
                     ))}
                     {tenureMonths > 12 && (
                       <div className="text-center py-2">
                         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">... + {tenureMonths - 12} more months</span>
                       </div>
                     )}
                   </div>
                 </div>
               )}

               {results?.agentCommission > 0 && activeTab === 'rd' && (
                 <div className="mt-8 pt-8 border-t border-gold/20 relative z-10">
                   <div className="flex items-center justify-between">
                     <div className="flex items-center gap-3">
                       <div className="w-10 h-10 bg-indigo-600/10 text-indigo-600 rounded-xl flex items-center justify-center">
                         <Briefcase className="w-5 h-5" />
                       </div>
                       <span className="text-sm font-black text-slate-700 tracking-tight">Agent Earnings (4%)</span>
                     </div>
                     <span className="text-xl font-black text-indigo-600">{formatCurrency(results.agentCommission)}</span>
                   </div>
                 </div>
               )}

               {results?.monthlyIncome > 0 && (
                 <div className="mt-8 pt-8 border-t border-gold/20 relative z-10">
                   <div className="flex items-center justify-between">
                     <div className="flex items-center gap-3">
                       <div className="w-10 h-10 bg-emerald-600/10 text-emerald-600 rounded-xl flex items-center justify-center">
                         <Wallet className="w-5 h-5" />
                       </div>
                       <span className="text-sm font-black text-slate-700 tracking-tight">Monthly Payout</span>
                     </div>
                     <span className="text-xl font-black text-emerald-600">{formatCurrency(results.monthlyIncome)}</span>
                   </div>
                 </div>
               )}

               {results?.quarterlyIncome > 0 && (
                 <div className="mt-8 pt-8 border-t border-gold/20 relative z-10">
                   <div className="flex items-center justify-between">
                     <div className="flex items-center gap-3">
                       <div className="w-10 h-10 bg-emerald-600/10 text-emerald-600 rounded-xl flex items-center justify-center">
                         <CalendarDays className="w-5 h-5" />
                       </div>
                       <span className="text-sm font-black text-slate-700 tracking-tight">Quarterly Payout</span>
                     </div>
                     <span className="text-xl font-black text-emerald-600">{formatCurrency(results.quarterlyIncome)}</span>
                   </div>
                 </div>
               )}
            </div>
          </div>

          {/* History Panel */}
          {history.length > 0 && (
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-premium overflow-hidden">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                  <History className="w-6 h-6 text-brand" />
                  Recent Local History
                </h3>
              </div>
              <div className="divide-y divide-slate-50">
                {history.map((item) => (
                  <div key={item.id} className="p-6 hover:bg-slate-50/50 transition-all flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-brand/10 group-hover:text-brand transition-colors">
                        {SCHEMES.find(s => s.id === item.schemeId)?.icon || <Calculator className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900 uppercase text-xs tracking-tight">{item.schemeName}</span>
                          <span className="text-[10px] font-medium text-slate-400">{item.date}</span>
                        </div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                          {formatCurrency(item.principal)} @ {item.rate}% for {item.tenure} {item.schemeId === 'rd' ? 'Months' : 'Years'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <span className="block text-sm font-black text-slate-900">{formatCurrency(item.maturityValue)}</span>
                        <span className="block text-[10px] font-black text-emerald-600 uppercase tracking-widest">Gain: +{formatCurrency(item.totalInterest)}</span>
                      </div>
                      <button 
                        onClick={() => removeHistoryItem(item.id)}
                        className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Scheme Details Table / Info */}
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-premium overflow-hidden">
             <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                  <Info className="w-6 h-6 text-brand" />
                  Scheme Compounding Reference
                </h3>
             </div>
             <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Scheme Names</th>
                      <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Compounding</th>
                      <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Interest Rate</th>
                      <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Term (Fixed)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    <tr className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-5 font-black text-slate-900 text-sm">Post Office RD</td>
                      <td className="px-8 py-5 text-slate-500 font-medium">Quarterly</td>
                      <td className="px-8 py-5 font-black text-brand tracking-tighter">6.7%</td>
                      <td className="px-8 py-5 text-slate-400 text-xs font-black">5 Years</td>
                    </tr>
                    <tr className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-5 font-black text-slate-900 text-sm">Agent Commission</td>
                      <td className="px-8 py-5 text-slate-500 font-medium whitespace-nowrap">Monthly Payout</td>
                      <td className="px-8 py-5 font-black text-brand tracking-tighter">4.0% (Standard)</td>
                      <td className="px-8 py-5 text-slate-400 text-xs font-black">Flexible</td>
                    </tr>
                    <tr className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-5 font-black text-slate-900 text-sm">PO MIS / SCSS</td>
                      <td className="px-8 py-5 text-slate-500 font-medium whitespace-nowrap">None (Regular Payout)</td>
                      <td className="px-8 py-5 font-black text-brand tracking-tighter">7.4% - 8.2%</td>
                      <td className="px-8 py-5 text-slate-400 text-xs font-black">5 Years</td>
                    </tr>
                    <tr className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-5 font-black text-slate-900 text-sm">NSC / MSSC</td>
                      <td className="px-8 py-5 text-slate-500 font-medium">Quarterly / Annual</td>
                      <td className="px-8 py-5 font-black text-brand tracking-tighter">7.7% - 7.5%</td>
                      <td className="px-8 py-5 text-slate-400 text-xs font-black">5 / 2 Years</td>
                    </tr>
                    <tr className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-5 font-black text-slate-900 text-sm">PPF / SSY</td>
                      <td className="px-8 py-5 text-slate-500 font-medium">Annually</td>
                      <td className="px-8 py-5 font-black text-brand tracking-tighter">7.1% - 8.2%</td>
                      <td className="px-8 py-5 text-slate-400 text-xs font-black">15 / 21 Years</td>
                    </tr>
                  </tbody>
                </table>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
