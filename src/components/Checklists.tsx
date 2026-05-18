import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, query, where, orderBy, onSnapshot, 
  doc, setDoc, deleteDoc, updateDoc, serverTimestamp, writeBatch, getDocs
} from 'firebase/firestore';
import { db } from '../firebase';
import { 
  CheckSquare, Plus, Trash2, ArrowLeft, Loader2, Save, X, Edit, Edit2, AlertCircle 
} from 'lucide-react';

interface ChecklistsProps {
  userId: string;
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

interface Checklist {
  id: string;
  userId: string;
  title: string;
  createdAt: any;
  updatedAt: any;
}

interface TaskBlock {
  id: string;
  userId: string;
  checklistId: string;
  groupNumber: number;
  accountsText: string;
  isCompleted: boolean;
  createdAt: any;
  updatedAt: any;
}

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
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {}, // Omitting detailed authInfo for brevity, rules expect to just not fail.
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function Checklists({ userId, addToast }: ChecklistsProps) {
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [activeChecklist, setActiveChecklist] = useState<Checklist | null>(null);
  const [loading, setLoading] = useState(true);

  // New Checklist State
  const [showNewMode, setShowNewMode] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newRawData, setNewRawData] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Active Checklist Data
  const [taskBlocks, setTaskBlocks] = useState<TaskBlock[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  
  // Edit State
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editAccountsText, setEditAccountsText] = useState('');

  useEffect(() => {
    const q = query(
      collection(db, 'checklists'),
      where('userId', '==', userId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let results: Checklist[] = [];
      snapshot.forEach((doc) => {
        results.push({ id: doc.id, ...doc.data() } as Checklist);
      });
      // Sort in memory to avoid composite index reqs
      results.sort((a, b) => {
        const timeA = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : 0;
        const timeB = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : 0;
        return timeB - timeA;
      });
      
      setChecklists(results);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'checklists');
      addToast('Failed to load checklists', 'error');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId, addToast]);

  useEffect(() => {
    if (!activeChecklist) {
      setTaskBlocks([]);
      return;
    }

    setLoadingTasks(true);
    const q = query(
      collection(db, 'task_blocks'),
      where('checklistId', '==', activeChecklist.id),
      where('userId', '==', userId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let results: TaskBlock[] = [];
      snapshot.forEach((doc) => {
        results.push({ id: doc.id, ...doc.data() } as TaskBlock);
      });
      // Sort in memory to avoid composite index requirements
      results.sort((a, b) => a.groupNumber - b.groupNumber);
      
      setTaskBlocks(results);
      setLoadingTasks(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'task_blocks');
      addToast('Failed to load tasks', 'error');
      setLoadingTasks(false);
    });

    return () => unsubscribe();
  }, [activeChecklist, addToast]);

  const handleCreateChecklist = async () => {
    if (!newTitle.trim() || !newRawData.trim()) {
      addToast('Please provide a title and paste some data.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const lines = newRawData.split('\n').filter(l => l.trim() !== '');
      const parsedBlocks = [];
      let currentGroup = 1;

      for (let line of lines) {
        // Find format "1. Account, Account"
        const match = line.match(/^(\d+)\.\s*(.*)/);
        if (match) {
          parsedBlocks.push({ groupNumber: parseInt(match[1]), text: match[2] });
          currentGroup = parseInt(match[1]) + 1;
        } else {
           // fallback just add it
           parsedBlocks.push({ groupNumber: currentGroup, text: line.trim() });
           currentGroup++;
        }
      }

      if (parsedBlocks.length === 0) {
        throw new Error("Could not find any groups to extract.");
      }

      const batch = writeBatch(db);
      
      const checklistRef = doc(collection(db, 'checklists'));
      const checklistId = checklistRef.id;

      batch.set(checklistRef, {
        userId,
        title: newTitle.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      for (let block of parsedBlocks) {
        const blockRef = doc(collection(db, 'task_blocks'));
        batch.set(blockRef, {
          userId,
          checklistId,
          groupNumber: block.groupNumber,
          accountsText: block.text,
          isCompleted: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      await batch.commit();
      addToast(`Checklist created with ${parsedBlocks.length} blocks!`, 'success');
      setNewTitle('');
      setNewRawData('');
      setShowNewMode(false);
    } catch (e: any) {
      console.error(e);
      addToast(e.message || 'Error occurred while saving checklist', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteChecklist = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this checklist forever?')) return;
    
    try {
      const q = query(
        collection(db, 'task_blocks'), 
        where('checklistId', '==', id),
        where('userId', '==', userId)
      );
      const snapshot = await getDocs(q);
      
      const batch = writeBatch(db);
      snapshot.forEach(docSnap => {
        batch.delete(docSnap.ref);
      });
      batch.delete(doc(db, 'checklists', id));
      await batch.commit();

      if (activeChecklist?.id === id) {
        setActiveChecklist(null);
      }
      addToast('Checklist deleted', 'success');
    } catch (error: any) {
      addToast(`Error deleting checklist: ${error.message || 'Unknown error'}`, 'error');
      console.error('Checklist delete error:', error);
    }
  };

  const handleDeleteTaskBlock = async (taskId: string) => {
    if (!window.confirm('Are you sure you want to delete this specific lot?')) return;
    try {
      await deleteDoc(doc(db, 'task_blocks', taskId));
      addToast('Lot deleted', 'success');
    } catch (error: any) {
      console.error("Failed to delete task", error);
      addToast(`Failed to delete lot: ${error.message || 'Unknown error'}`, "error");
    }
  };

  const toggleTaskStatus = async (taskId: string, currentStatus: boolean) => {
    try {
      const ref = doc(db, 'task_blocks', taskId);
      await updateDoc(ref, {
        isCompleted: !currentStatus,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
       console.error("Failed to update status", error);
       addToast("Failed to update status", "error");
    }
  };

  const handleDeselectAll = async () => {
    if (!taskBlocks.length) return;
    
    try {
      const batch = writeBatch(db);
      taskBlocks.forEach(block => {
        if (block.isCompleted) {
          const ref = doc(db, 'task_blocks', block.id);
          batch.update(ref, {
            isCompleted: false,
            updatedAt: serverTimestamp()
          });
        }
      });
      await batch.commit();
      addToast('All lots deselected', 'success');
    } catch (error) {
      console.error("Failed to deselect all", error);
      addToast("Failed to deselect all", "error");
    }
  };

  const saveTaskEdit = async (taskId: string) => {
    if (!editAccountsText.trim()) return;
    try {
      const ref = doc(db, 'task_blocks', taskId);
      await updateDoc(ref, {
        accountsText: editAccountsText.trim(),
        updatedAt: serverTimestamp()
      });
      setEditingBlockId(null);
      addToast("Block updated", "success");
    } catch (error) {
      console.error("Failed to update task", error);
      addToast("Failed to update block", "error");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-brand" />
      </div>
    );
  }

  // ACTIVE CHECKLIST VIEW
  if (activeChecklist) {
    const totalCount = taskBlocks.length;
    const completedCount = taskBlocks.filter(t => t.isCompleted).length;
    const progress = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

    return (
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
        <div className="flex items-center gap-4 mb-4">
          <button 
            onClick={() => setActiveChecklist(null)}
            className="w-12 h-12 bg-white border border-slate-200 rounded-2xl flex items-center justify-center hover:bg-slate-50 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">{activeChecklist.title}</h1>
            <p className="text-sm font-medium text-slate-500">{completedCount} of {totalCount} completed</p>
          </div>
          {completedCount > 0 && (
            <button
              onClick={handleDeselectAll}
              className="px-4 py-2 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors"
            >
              <CheckSquare className="w-4 h-4 opacity-50" />
              Deselect All
            </button>
          )}
          <button
            onClick={() => handleDeleteChecklist(activeChecklist.id)}
            className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete All
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
           <div 
             className="h-full bg-brand transition-all duration-500 ease-out"
             style={{ width: `${progress}%` }}
           />
        </div>

        {loadingTasks ? (
          <div className="py-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-brand" /></div>
        ) : (
          <div className="grid gap-3">
            {taskBlocks.map((block) => (
              <div 
                key={block.id} 
                className={`flex gap-4 p-5 rounded-2xl border transition-all ${
                  block.isCompleted ? 'bg-slate-50/80 border-slate-100 opacity-70' : 'bg-white border-slate-200 shadow-sm'
                }`}
              >
                <div className="pt-1 flex-shrink-0">
                  <button 
                    onClick={() => toggleTaskStatus(block.id, block.isCompleted)}
                    className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-colors ${
                      block.isCompleted ? 'bg-brand border-brand text-white' : 'bg-white border-slate-300 hover:border-brand text-transparent'
                    }`}
                  >
                    <CheckSquare className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-black uppercase tracking-widest text-brand">Lot {block.groupNumber}</span>
                    <div className="flex items-center gap-1">
                      <button 
                         onClick={() => {
                           if (editingBlockId === block.id) {
                              saveTaskEdit(block.id);
                           } else {
                              setEditingBlockId(block.id);
                              setEditAccountsText(block.accountsText);
                           }
                         }}
                         className="text-slate-400 hover:text-brand transition-colors p-1"
                      >
                        {editingBlockId === block.id ? <Save className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
                      </button>
                      <button 
                        onClick={() => handleDeleteTaskBlock(block.id)}
                        className="text-slate-400 hover:text-red-500 transition-colors p-1"
                        title="Delete this lot"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  {editingBlockId === block.id ? (
                     <textarea 
                       className="w-full text-sm font-mono p-3 bg-white border border-slate-200 rounded-xl shadow-inner focus:ring-2 focus:ring-brand focus:border-transparent outline-none h-24"
                       value={editAccountsText}
                       onChange={(e) => setEditAccountsText(e.target.value)}
                     />
                  ) : (
                    <p className={`font-mono text-sm leading-relaxed ${block.isCompleted ? 'line-through text-slate-500' : 'text-slate-800'}`}>
                      {block.accountsText}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    );
  }

  // DASHBOARD VIEW
  return (
    <div className="space-y-8">
       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Lot Checklists</h1>
            <p className="text-slate-500 font-medium">Keep track of your grouped lots as you process them.</p>
          </div>
          {!showNewMode && (
            <button
               onClick={() => setShowNewMode(true)}
               className="bg-brand text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-brand-dark transition-colors shadow-premium hover-lift"
            >
              <Plus className="w-5 h-5" />
              New Checklist
            </button>
          )}
       </div>

       <AnimatePresence>
         {showNewMode && (
           <motion.div 
             initial={{ opacity: 0, height: 0 }}
             animate={{ opacity: 1, height: 'auto' }}
             exit={{ opacity: 0, height: 0 }}
             className="overflow-hidden"
           >
             <div className="bg-white p-6 rounded-[2rem] shadow-premium border border-slate-100 space-y-6 mb-8">
                <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                  <h3 className="text-lg font-black text-slate-800">Create new Checklist</h3>
                  <button onClick={() => setShowNewMode(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-colors"><X className="w-5 h-5" /></button>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-black uppercase text-slate-500 ml-1 mb-1 block">Title</label>
                    <input 
                      type="text" 
                      placeholder="e.g. May 2nd Lots" 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-brand outline-none transition-all"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-end mb-1">
                      <label className="text-xs font-black uppercase text-slate-500 ml-1 mb-1 block">Paste AI Grouping Text</label>
                    </div>
                    <textarea 
                      placeholder="1. 1009033, 10030044&#10;2. 5003344"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono h-40 focus:bg-white focus:ring-2 focus:ring-brand outline-none transition-all"
                      value={newRawData}
                      onChange={(e) => setNewRawData(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                   <button 
                     onClick={() => setShowNewMode(false)}
                     className="px-6 py-3 font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                   >
                     Cancel
                   </button>
                   <button 
                     onClick={handleCreateChecklist}
                     disabled={isSaving}
                     className="px-6 py-3 bg-brand text-white font-bold rounded-xl shadow-md hover:bg-brand-dark transition-colors flex items-center gap-2"
                   >
                     {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                     Create Checklist
                   </button>
                </div>
             </div>
           </motion.div>
         )}
       </AnimatePresence>

       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {checklists.map((list) => (
             <div 
               key={list.id} 
               onClick={() => setActiveChecklist(list)}
               className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-premium transition-all cursor-pointer group flex flex-col hover:-translate-y-1"
             >
               <div className="flex justify-between items-start mb-4">
                 <div className="w-12 h-12 bg-brand/10 text-brand rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <CheckSquare className="w-6 h-6" />
                 </div>
                 <button 
                   onClick={(e) => handleDeleteChecklist(list.id, e)}
                   className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                 >
                    <Trash2 className="w-4 h-4" />
                 </button>
               </div>
               <h3 className="text-xl font-black text-slate-800 mb-2 truncate">{list.title}</h3>
               <p className="text-xs text-slate-400 font-medium uppercase tracking-widest mt-auto pt-4 border-t border-slate-50">
                 {list.createdAt ? new Date(list.createdAt.toDate()).toLocaleDateString() : 'Just now'}
               </p>
             </div>
          ))}

          {checklists.length === 0 && !showNewMode && (
            <div className="col-span-full py-16 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-[2rem] bg-slate-50/50">
               <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                 <CheckSquare className="w-10 h-10 text-slate-300" />
               </div>
               <h3 className="text-xl font-black text-slate-700 mb-2">No Checklists Yet</h3>
               <p className="text-slate-500 font-medium pb-6">Create one to start tracking your process.</p>
               <button 
                 onClick={() => setShowNewMode(true)}
                 className="px-6 py-2 bg-white text-slate-800 font-bold border border-slate-200 rounded-xl shadow-sm hover:border-brand hover:text-brand transition-colors"
               >
                 Create New
               </button>
            </div>
          )}
       </div>
    </div>
  );
}
