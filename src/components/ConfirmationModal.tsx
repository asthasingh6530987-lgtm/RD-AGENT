import React from 'react';
import { AlertTriangle, Info, AlertCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

export default function ConfirmationModal({ 
  isOpen, 
  title, 
  message, 
  onConfirm, 
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'danger'
}: ConfirmationModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 overflow-hidden">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full border border-slate-100 overflow-hidden"
          >
            {/* Background Accents */}
            <div className={`absolute top-0 right-0 w-48 h-48 rounded-full -mr-24 -mt-24 blur-3xl opacity-20 ${
              type === 'danger' ? 'bg-destructive' : 
              type === 'warning' ? 'bg-amber-500' : 
              'bg-blue-500'
            }`}></div>
            <div className={`absolute bottom-0 left-0 w-48 h-48 rounded-full -ml-24 -mb-24 blur-3xl opacity-10 ${
              type === 'danger' ? 'bg-amber-500' : 
              'bg-blue-500'
            }`}></div>

            <button 
              onClick={onCancel}
              className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col items-center text-center relative z-10">
              <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-6 shadow-lg relative ${
                type === 'danger' ? 'bg-destructive/10 text-destructive shadow-destructive/20' : 
                type === 'warning' ? 'bg-amber-500/10 text-amber-500 shadow-amber-500/20' : 
                'bg-blue-500/10 text-blue-500 shadow-blue-500/20'
              }`}>
                <div className="absolute inset-0 rounded-2xl border border-white/50" />
                {type === 'danger' ? <AlertTriangle className="w-10 h-10" /> : 
                 type === 'warning' ? <AlertCircle className="w-10 h-10" /> : 
                 <Info className="w-10 h-10" />}
              </div>
              
              <h3 className="text-2xl font-bold text-slate-800 mb-3">
                {title}
              </h3>
              
              <p className="text-slate-500 font-medium leading-relaxed mb-8 px-2">
                {message}
              </p>
              
              <div className="flex flex-col sm:flex-row gap-3 w-full">
                <button
                  onClick={onCancel}
                  className="flex-1 px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-all shadow-sm"
                >
                  {cancelText}
                </button>
                <button
                  onClick={onConfirm}
                  className={`flex-1 px-6 py-3 text-white rounded-xl font-medium transition-all shadow-sm flex items-center justify-center gap-2 ${
                    type === 'danger' ? 'bg-destructive hover:bg-destructive/90' : 
                    type === 'warning' ? 'bg-amber-500 hover:bg-amber-600' : 
                    'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {confirmText}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
