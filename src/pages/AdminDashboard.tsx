import { useState, useEffect, useMemo, useRef } from 'react';
import { useElectionStore, Candidate, Position, Voter } from '@/store/electionStore';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { db } from '@/firebase';
import { sanitizeMatricForFirestore, normalizeEmail } from '@/lib/utils';
import { writeBatch, doc, setDoc, deleteDoc, onSnapshot, collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import {
  Settings, Users, UserCheck, BarChart3, Plus, Trash2, Search, Upload, Edit2, ShieldCheck, LogOut, Save, Power, AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Tab = 'voters' | 'candidates' | 'positions' | 'analytics';

interface FirebaseVote {
  id?: string;
  studentId: string;
  positionId: string;
  candidateId: string;
  timestamp?: any;
}

const formatDateTimeLocal = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// Firestore Collection Constants
const COLLECTIONS = {
  POSITIONS: 'positions',
  CANDIDATES: 'candidates',
  ELIGIBLE_STUDENTS: 'eligible_students',
  VOTES: 'votes',
} as const;

const AdminDashboard = () => {
  const store = useElectionStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('voters');
  const [search, setSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Candidate form with preview/staging
  const [showCandidateForm, setShowCandidateForm] = useState(false);
  const [newCandidate, setNewCandidate] = useState({ name: '', position: '', manifesto: '', photo: '' });

  // Position form with preview/staging
  const [showPositionForm, setShowPositionForm] = useState(false);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [positionTitle, setPositionTitle] = useState('');
  const [stagedPosition, setStagedPosition] = useState<Position | null>(null);

  // Candidate form with preview/staging
  const [stagedCandidate, setStagedCandidate] = useState<Candidate | null>(null);
  useEffect(() => {
    if (!store.currentUser || !store.isAdmin) navigate('/login');
  }, [store.currentUser, store.isAdmin, navigate]);

  const [firestoreVoters, setFirestoreVoters] = useState<Voter[]>([]);
  const [firestoreVotes, setFirestoreVotes] = useState<any[]>([]);
  const [firestorePositions, setFirestorePositions] = useState<Position[]>([]);
  const [firestoreCandidates, setFirestoreCandidates] = useState<Candidate[]>([]);

  // ===== CONSOLIDATED REAL-TIME LISTENERS =====
  useEffect(() => {
    console.log('🔄 Setting up Firestore real-time listeners...');

    // Listener 1: eligible_students
    const votersUnsub = onSnapshot(collection(db, COLLECTIONS.ELIGIBLE_STUDENTS), (snap) => {
      const mapped: Voter[] = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          matricNumber: data.matricNumber || d.id,
          fullName: data.fullName || '',
          department: data.department || '',
          faculty: data.faculty || '',
          email: data.email || '',
          hasVoted: !!data.hasVoted,
        };
      });
      setFirestoreVoters(mapped);
      console.log(`✅ Synced ${mapped.length} voters from ${COLLECTIONS.ELIGIBLE_STUDENTS}`);
    }, (err) => {
      console.error(`Firestore Error [${err.code}]:`, err.message, err);
    });

    // Listener 2: votes
    const votesUnsub = onSnapshot(collection(db, COLLECTIONS.VOTES), (snap) => {
      const votes = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      }));
      setFirestoreVotes(votes);
      console.log(`✅ Synced ${votes.length} votes from ${COLLECTIONS.VOTES}`);
    }, (err) => {
      console.error(`Firestore Error [${err.code}]:`, err.message, err);
    });

    // Listener 3: positions
    const positionsUnsub = onSnapshot(collection(db, COLLECTIONS.POSITIONS), (snap) => {
      const positions: Position[] = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          title: data.title || '',
        };
      });
      setFirestorePositions(positions);
      console.log(`✅ Synced ${positions.length} positions from ${COLLECTIONS.POSITIONS}`);
    }, (err) => {
      console.error(`Firestore Error [${err.code}]:`, err.message, err);
    });

    // Listener 4: candidates
    const candidatesUnsub = onSnapshot(collection(db, COLLECTIONS.CANDIDATES), (snap) => {
      const candidates: Candidate[] = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          name: data.name || '',
          position: data.position || '',
          manifesto: data.manifesto || '',
          photo: data.photo || '',
        };
      });
      setFirestoreCandidates(candidates);
      console.log(`✅ Synced ${candidates.length} candidates from ${COLLECTIONS.CANDIDATES}`);
    }, (err) => {
      console.error(`Firestore Error [${err.code}]:`, err.message, err);
    });

    // Cleanup on unmount
    return () => {
      console.log('🔄 Cleaning up Firestore listeners...');
      votersUnsub();
      votesUnsub();
      positionsUnsub();
      candidatesUnsub();
    };
  }, []);

  const filteredVoters = useMemo(() => {
    const source = firestoreVoters.length ? firestoreVoters : store.voters;
    if (!search) return source;
    const q = search.toLowerCase();
    return source.filter(
      (v) => v.fullName.toLowerCase().includes(q) || v.matricNumber.toLowerCase().includes(q) || v.department.toLowerCase().includes(q)
    );
  }, [firestoreVoters, store.voters, search]);

  const handleAddCandidate = async () => {
    // Auth check: use store admin state instead of Firebase auth
    if (!store.isAdmin) {
      console.error('❌ Admin not authenticated. Cannot add candidate.');
      toast.error('Admin authorization required');
      return;
    }

    if (!newCandidate.name || !newCandidate.position) {
      toast.error('Please fill in all required fields');
      return;
    }

    const id = `cand-${Date.now()}`;
    const candidate = { ...newCandidate, id } as Candidate;
    // Stage candidate for preview before saving
    setStagedCandidate(candidate);
    console.log(`📋 Staging candidate for preview:`, candidate);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (< 1MB)
    const MAX_SIZE = 1048576; // 1MB in bytes
    if (file.size > MAX_SIZE) {
      alert('Image must be less than 1MB');
      return;
    }

    // Convert to Base64
    const reader = new FileReader();
    reader.onload = (evt) => {
      const base64String = evt.target?.result as string;
      setNewCandidate((p) => ({ ...p, photo: base64String }));
      toast.success('Photo selected and ready to upload');
    };
    reader.onerror = () => {
      toast.error('Failed to read image file');
    };
    reader.readAsDataURL(file);

    // Reset input
    e.target.value = '';
  };

  const handleResetElection = async () => {
    // Auth check for reset
    if (!store.isAdmin) {
      toast.error('Only admin can reset election');
      return;
    }

    const confirmed = window.confirm(
      'Are you sure you want to reset the election? This will permanently delete all positions, candidates, votes, and the uploaded student master list.'
    );

    if (!confirmed) return;

    try {
      console.log('🔄 Starting election reset...');

      // Delete positions collection
      console.log(`Deleting ${COLLECTIONS.POSITIONS}...`);
      const positionsDocs = await getDocs(collection(db, COLLECTIONS.POSITIONS));
      let positionCount = 0;
      if (positionsDocs.docs.length > 0) {
        let batch = writeBatch(db);
        let batchCount = 0;
        positionsDocs.docs.forEach((docSnap) => {
          batch.delete(docSnap.ref);
          batchCount++;
          positionCount++;
          if (batchCount === 500) {
            batch.commit();
            batch = writeBatch(db);
            batchCount = 0;
          }
        });
        if (batchCount > 0) await batch.commit();
      }
      console.log(`✅ Deleted ${positionCount} positions`);

      // Delete eligible_students collection
      console.log(`Deleting ${COLLECTIONS.ELIGIBLE_STUDENTS}...`);
      const studentsDocs = await getDocs(collection(db, COLLECTIONS.ELIGIBLE_STUDENTS));
      let studentCount = 0;
      if (studentsDocs.docs.length > 0) {
        let batch = writeBatch(db);
        let batchCount = 0;
        studentsDocs.docs.forEach((docSnap) => {
          batch.delete(docSnap.ref);
          batchCount++;
          studentCount++;
          if (batchCount === 500) {
            batch.commit();
            batch = writeBatch(db);
            batchCount = 0;
          }
        });
        if (batchCount > 0) await batch.commit();
      }
      console.log(`✅ Deleted ${studentCount} student records`);

      // Delete candidates collection
      console.log(`Deleting ${COLLECTIONS.CANDIDATES}...`);
      const candidatesDocs = await getDocs(collection(db, COLLECTIONS.CANDIDATES));
      let candidateCount = 0;
      if (candidatesDocs.docs.length > 0) {
        let batch = writeBatch(db);
        let batchCount = 0;
        candidatesDocs.docs.forEach((docSnap) => {
          batch.delete(docSnap.ref);
          batchCount++;
          candidateCount++;
          if (batchCount === 500) {
            batch.commit();
            batch = writeBatch(db);
            batchCount = 0;
          }
        });
        if (batchCount > 0) await batch.commit();
      }
      console.log(`✅ Deleted ${candidateCount} candidates`);

      // Delete votes collection
      console.log(`Deleting ${COLLECTIONS.VOTES}...`);
      const votesDocs = await getDocs(collection(db, COLLECTIONS.VOTES));
      let voteCount = 0;
      if (votesDocs.docs.length > 0) {
        let batch = writeBatch(db);
        let batchCount = 0;
        votesDocs.docs.forEach((docSnap) => {
          batch.delete(docSnap.ref);
          batchCount++;
          voteCount++;
          if (batchCount === 500) {
            batch.commit();
            batch = writeBatch(db);
            batchCount = 0;
          }
        });
        if (batchCount > 0) await batch.commit();
      }
      console.log(`✅ Deleted ${voteCount} votes`);

      // Clear local state
      store.voters.length = 0;
      store.candidates.length = 0;
      store.votes.length = 0;
      store.positions.length = 0;
      setFirestoreVoters([]);
      setFirestoreVotes([]);
      setFirestorePositions([]);
      setFirestoreCandidates([]);
      setParsedVoters([]);
      setSearch('');
      setActiveTab('voters');

      console.log('✅ Election reset complete!');
      toast.success(`Election reset successfully. Deleted ${positionCount} positions, ${studentCount} students, ${candidateCount} candidates, and ${voteCount} votes.`);
    } catch (err) {
      const error = err as any;
      console.error(`Firestore Error [${error.code}]:`, error.message, error);
      toast.error(`Failed to reset election: ${error.message}`);
    }
  };

  const handleSavePosition = async () => {
    // Auth check: use store admin state instead of Firebase auth
    if (!store.isAdmin) {
      console.error('❌ Admin not authenticated. Cannot add position.');
      toast.error('Admin authorization required');
      return;
    }

    if (!positionTitle.trim()) {
      toast.error('Please enter a position title');
      return;
    }

    // Stage position for preview before saving
    const id = editingPosition?.id || `pos-${Date.now()}`;
    setStagedPosition({ id, title: positionTitle });
    console.log(`📋 Staging position for preview:`, { id, title: positionTitle });
  };

  const [parsedVoters, setParsedVoters] = useState<Voter[]>([]);
  const [showSaveBtn, setShowSaveBtn] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    import('exceljs').then((ExcelJSModule) => {
      const ExcelJS = (ExcelJSModule && (ExcelJSModule.default || ExcelJSModule)) as any;
      const reader = new FileReader();
      reader.onload = (evt) => {
        const arrayBuffer = evt.target?.result as ArrayBuffer;
        const workbook = new ExcelJS.Workbook();
        workbook.xlsx.load(arrayBuffer).then(() => {
          const worksheet = workbook.worksheets[0];
          const headerRow = worksheet.getRow(1);
          const headers: string[] = (headerRow.values || []).slice(1).map((h: any) => (h == null ? '' : String(h).trim()));
          const rows: Record<string, string>[] = [];
          worksheet.eachRow((row: any, rowNumber: number) => {
            if (rowNumber === 1) return;
            const obj: Record<string, string> = {};
            row.eachCell({ includeEmpty: true }, (cell: any, colNumber: number) => {
              const header = headers[colNumber - 1] || `col${colNumber}`;
              let val = cell && cell.value;
              if (val && typeof val === 'object' && 'text' in val) val = (val as any).text;
              obj[header] = val == null ? '' : String(val);
            });
            rows.push(obj);
          });
          // helper to get header value case-insensitively
          const getVal = (row: Record<string, string>, key: string) => {
            const found = Object.keys(row).find((k) => k.toLowerCase() === key.toLowerCase());
            return found ? row[found] : '';
          };

          const mapped: Voter[] = rows
            .filter((r) => getVal(r, 'MatricNumber') && getVal(r, 'FullName'))
            .map((r) => ({
              matricNumber: getVal(r, 'MatricNumber'),
              fullName: getVal(r, 'FullName'),
              department: getVal(r, 'Department') || '',
              faculty: getVal(r, 'Faculty') || '',
              email: getVal(r, 'Email') || '',
              hasVoted: false,
            }));

          setParsedVoters(mapped);
          store.addVoters(mapped);

          setShowSaveBtn(true);
        }).catch((err: any) => {
          console.error('Failed to parse Excel file via exceljs', err);
          toast.error('Failed to parse Excel file');
        });
      };
      reader.readAsArrayBuffer(file);
    }).catch((err) => {
      console.error('Failed to load exceljs module:', err);
      toast.error('Unable to load Excel parser');
    });
    e.target.value = '';
  };

  const handleSaveToDatabase = async () => {
    // Auth check: use store admin state instead of Firebase auth
    if (!store.isAdmin) {
      console.error('❌ Admin not authenticated. Cannot save students.');
      toast.error('Admin authorization required');
      return;
    }

    try {
      console.log(`📝 Admin authenticated. Preparing to batch write ${parsedVoters.length} students to ${COLLECTIONS.ELIGIBLE_STUDENTS}...`);
      
      // Normalize and deduplicate voters
      const normalizedVoters = new Map<string, Voter>();
      const duplicates: string[] = [];
      
      parsedVoters.forEach((v) => {
        // Normalize both matric and email for consistent storage and lookup
        const normalizedMatric = sanitizeMatricForFirestore(v.matricNumber);
        const normalizedEmail = normalizeEmail(v.email);
        const dedupeKey = `${normalizedMatric}|${normalizedEmail}`;
        
        if (normalizedVoters.has(dedupeKey)) {
          console.warn(`⚠️ Duplicate voter detected: ${v.matricNumber} → ${normalizedMatric}`);
          duplicates.push(v.matricNumber);
        } else {
          normalizedVoters.set(dedupeKey, {
            matricNumber: normalizedMatric,
            fullName: (v.fullName || '').trim(),
            department: (v.department || '').trim(),
            faculty: (v.faculty || '').trim(),
            email: normalizedEmail,
            hasVoted: false,
          });
        }
      });
      
      if (duplicates.length > 0) {
        console.warn(`⚠️ Found ${duplicates.length} duplicate voters, skipping them`);
        toast.warning(`Skipped ${duplicates.length} duplicate voter(s)`);
      }
      
      const votersToSave = Array.from(normalizedVoters.values());
      console.log(`📝 Batch writing ${votersToSave.length} unique students to ${COLLECTIONS.ELIGIBLE_STUDENTS}...`);
      
      const batch = writeBatch(db);
      votersToSave.forEach((v) => {
        const docId = v.matricNumber;
        const ref = doc(db, COLLECTIONS.ELIGIBLE_STUDENTS, docId);
        
        batch.set(ref, {
          matricNumber: v.matricNumber,
          fullName: v.fullName,
          department: v.department,
          faculty: v.faculty,
          email: v.email,
          hasVoted: false,
        });
        
        console.log(`  📌 Queued: ${v.matricNumber} (${v.email})`);
      });
      
      await batch.commit();
      console.log(`✅ Batch commit successful: ${votersToSave.length} students saved to Firestore`);
      toast.success(`Saved ${votersToSave.length} students to ${COLLECTIONS.ELIGIBLE_STUDENTS}`);
      setParsedVoters([]);
      setShowSaveBtn(false);
    } catch (err) {
      const error = err as any;
      console.error(`Firestore Error [${error.code}]:`, error.message, error);
      toast.error(`Failed to save students: ${error.message}`);
    }
  };

  const handleSavePositionToFirestore = async () => {
    if (!stagedPosition) return;
    if (!store.isAdmin) {
      toast.error('Admin authorization required');
      return;
    }

    try {
      console.log(`📝 Saving position to ${COLLECTIONS.POSITIONS}:`, stagedPosition);
      await setDoc(doc(db, COLLECTIONS.POSITIONS, stagedPosition.id), {
        id: stagedPosition.id,
        title: stagedPosition.title,
      });
      console.log(`✅ Position saved successfully: ${stagedPosition.id}`);
      toast.success(editingPosition ? 'Position updated' : 'Position added');
      setStagedPosition(null);
      setPositionTitle('');
      setEditingPosition(null);
      setShowPositionForm(false);
    } catch (err) {
      const error = err as any;
      console.error(`Firestore Error [${error.code}]:`, error.message, error);
      toast.error(`Failed to save position: ${error.message}`);
    }
  };

  const handleSaveCandidateToFirestore = async () => {
    if (!stagedCandidate) return;
    if (!store.isAdmin) {
      toast.error('Admin authorization required');
      return;
    }

    try {
      console.log(`📝 Saving candidate to ${COLLECTIONS.CANDIDATES}:`, stagedCandidate);
      await setDoc(doc(db, COLLECTIONS.CANDIDATES, stagedCandidate.id), stagedCandidate);
      console.log(`✅ Candidate saved successfully: ${stagedCandidate.id}`);
      toast.success('Candidate added');
      setStagedCandidate(null);
      setNewCandidate({ name: '', position: '', manifesto: '', photo: '' });
      setShowCandidateForm(false);
    } catch (err) {
      const error = err as any;
      console.error(`Firestore Error [${error.code}]:`, error.message, error);
      toast.error(`Failed to save candidate: ${error.message}`);
    }
  };

  const handleAddCandidateClose = () => {
    setStagedCandidate(null);
    setNewCandidate({ name: '', position: '', manifesto: '', photo: '' });
    setShowCandidateForm(false);
  };

  const handleAddPositionClose = () => {
    setStagedPosition(null);
    setPositionTitle('');
    setEditingPosition(null);
    setShowPositionForm(false);
  };

  // Analytics - Aggregate from Firestore votes and positions/candidates
  const tallyByPosition = useMemo(() => {
    return firestorePositions.map((pos) => {
      const posCandidates = firestoreCandidates.filter((c) => c.position === pos.id);
      const tallies = posCandidates.map((c) => {
        // Count votes from Firestore votes collection
        const count = firestoreVotes.filter((v) => v.candidateId === c.id).length;
        return { candidate: c, count };
      });
      return { position: pos, tallies };
    });
  }, [firestorePositions, firestoreCandidates, firestoreVotes]);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'voters', label: 'Voters', icon: <Users className="h-4 w-4" /> },
    { id: 'candidates', label: 'Candidates', icon: <UserCheck className="h-4 w-4" /> },
    { id: 'positions', label: 'Positions', icon: <Settings className="h-4 w-4" /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="h-4 w-4" /> },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background lg:flex-row">
      {/* Sidebar */}
      <aside className="border-b bg-card lg:w-60 lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-2 px-4 py-4 lg:px-6 lg:py-6">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <span className="font-bold">Admin Panel</span>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 lg:flex-col lg:px-3 lg:pb-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="px-3 pb-2 pt-2 lg:pb-4 lg:pt-6 space-y-2">
          <button
            onClick={() => { store.logout(); navigate('/'); }}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4" /> <span className="hidden lg:inline">Sign out</span>
          </button>
          <button
            onClick={handleResetElection}
            className="flex items-center gap-2 text-sm text-destructive hover:text-destructive/80"
          >
            <AlertTriangle className="h-4 w-4" /> <span className="hidden lg:inline">Reset Election</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
        <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
          {/* VOTERS TAB */}
          {activeTab === 'voters' && (
            <div>
               <div className="flex flex-wrap items-center justify-between gap-4">
                 <h2 className="text-xl font-bold">Voter Management</h2>
                 <div className="flex gap-2">
                   <input
                     ref={fileInputRef}
                     type="file"
                     accept=".xlsx,.xls,.csv"
                     className="hidden"
                     onChange={handleFileUpload}
                   />
                   <Button onClick={() => fileInputRef.current?.click()} variant="outline" size="sm">
                     <Upload className="mr-2 h-4 w-4" /> Upload Excel
                   </Button>
                   {showSaveBtn && (
                     <Button onClick={handleSaveToDatabase} size="sm">
                       <Save className="mr-2 h-4 w-4" /> Save to Database
                     </Button>
                   )}
                 </div>
              </div>
              <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name, matric, or department..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              {/* Show preview of uploaded voters before saving */}
              {showSaveBtn && parsedVoters.length > 0 && (
                <div className="mt-6 rounded-lg border bg-secondary p-4">
                  <p className="text-sm font-semibold">📋 Preview: {parsedVoters.length} voter(s) ready to save</p>
                  <p className="mt-1 text-xs text-muted-foreground">Review the data below, then click "Save to Database" to persist to Firestore.</p>
                  <div className="mt-4 overflow-x-auto rounded border">
                    <table className="w-full bg-background text-xs">
                      <thead>
                        <tr className="border-b bg-muted">
                          <th className="px-3 py-2 text-left">Matric No.</th>
                          <th className="px-3 py-2 text-left">Full Name</th>
                          <th className="hidden px-3 py-2 text-left sm:table-cell">Email</th>
                          <th className="hidden px-3 py-2 text-left md:table-cell">Dept</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedVoters.slice(0, 5).map((v, idx) => (
                          <tr key={idx} className="border-b last:border-b-0">
                            <td className="px-3 py-2 font-mono text-xs">{v.matricNumber}</td>
                            <td className="px-3 py-2">{v.fullName}</td>
                            <td className="hidden px-3 py-2 text-xs sm:table-cell">{v.email}</td>
                            <td className="hidden px-3 py-2 md:table-cell">{v.department}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {parsedVoters.length > 5 && (
                    <p className="mt-2 text-xs text-muted-foreground">... and {parsedVoters.length - 5} more</p>
                  )}
                </div>
              )}

              {firestoreVoters.length === 0 ? (
                <div className="mt-8 rounded-lg border border-dashed bg-card p-8 text-center">
                  <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-3 text-sm font-medium">No voters found.</p>
                  <p className="mt-1 text-xs text-muted-foreground">Please upload or add student voter data to begin.</p>
                </div>
              ) : (
                <>
              <div className="mt-4 overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-secondary">
                      <th className="px-4 py-3 text-left font-semibold">Matric No.</th>
                      <th className="px-4 py-3 text-left font-semibold">Full Name</th>
                      <th className="hidden px-4 py-3 text-left font-semibold sm:table-cell">Email</th>
                      <th className="hidden px-4 py-3 text-left font-semibold md:table-cell">Dept</th>
                      <th className="hidden px-4 py-3 text-left font-semibold lg:table-cell">Faculty</th>
                      <th className="px-4 py-3 text-left font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVoters.map((v) => (
                      <tr key={v.matricNumber} className="border-b last:border-b-0">
                        <td className="px-4 py-3 font-mono text-xs">{v.matricNumber}</td>
                        <td className="px-4 py-3 font-medium">{v.fullName}</td>
                        <td className="hidden px-4 py-3 text-xs sm:table-cell">{v.email}</td>
                        <td className="hidden px-4 py-3 md:table-cell">{v.department}</td>
                        <td className="hidden px-4 py-3 lg:table-cell">{v.faculty}</td>
                        <td className="px-4 py-3">
                          {v.hasVoted ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-accent">
                              <ShieldCheck className="h-3 w-3" /> Verified
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Pending</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{filteredVoters.length} voter(s) found</p>
                </>
              )}
            </div>
          )}

          {/* CANDIDATES TAB */}
          {activeTab === 'candidates' && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-xl font-bold">Candidate Management</h2>
                <Button onClick={() => setShowCandidateForm(true)} size="sm">
                  <Plus className="mr-2 h-4 w-4" /> Add New Candidate
                </Button>
              </div>
              {firestoreCandidates.length === 0 ? (
                <div className="mt-8 rounded-lg border border-dashed bg-card p-8 text-center">
                  <UserCheck className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-3 text-sm font-medium">No candidates registered yet.</p>
                  <p className="mt-1 text-xs text-muted-foreground">Add positions first, then register candidates for each position.</p>
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  {firestorePositions.map((pos) => {
                    const posCandidates = firestoreCandidates.filter((c) => c.position === pos.id);
                    if (posCandidates.length === 0) return null;
                    return (
                      <div key={pos.id}>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{pos.title}</p>
                        <div className="mt-2 space-y-2">
                          {posCandidates.map((c) => (
                            <div key={c.id} className="flex items-center justify-between rounded-lg border bg-card p-4">
                              <div className="flex items-center gap-3">
                                {c.photo ? (
                                  <img src={c.photo} alt={c.name} className="h-10 w-10 rounded-full object-cover" />
                                ) : (
                                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
                                    <UserCheck className="h-5 w-5 text-muted-foreground" />
                                  </div>
                                )}
                                <div>
                                  <p className="font-medium">{c.name}</p>
                                  <p className="text-xs text-muted-foreground">{pos.title}</p>
                                </div>
                              </div>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={async () => {
                                  try {
                                    console.log(`🗑️ Deleting candidate ${c.id} from ${COLLECTIONS.CANDIDATES}`);
                                    await deleteDoc(doc(db, COLLECTIONS.CANDIDATES, c.id));
                                    console.log(`✅ Candidate deleted: ${c.id}`);
                                    toast.success('Candidate deleted');
                                  } catch (err) {
                                    const error = err as any;
                                    console.error(`Firestore Error [${error.code}]:`, error.message, error);
                                    toast.error(`Failed to delete candidate: ${error.message}`);
                                  }
                                }}
                              >
                                <Trash2 className="mr-1 h-3 w-3" /> Delete
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* POSITIONS TAB */}
          {activeTab === 'positions' && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-xl font-bold">Position Management</h2>
                <Button onClick={() => { setEditingPosition(null); setPositionTitle(''); setShowPositionForm(true); }} size="sm">
                  <Plus className="mr-2 h-4 w-4" /> Add Position
                </Button>
              </div>
              {firestorePositions.length === 0 ? (
                <div className="mt-8 rounded-lg border border-dashed bg-card p-8 text-center">
                  <Settings className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-3 text-sm font-medium">No positions found.</p>
                  <p className="mt-1 text-xs text-muted-foreground">Please add or upload positions to begin the voting setup.</p>
                </div>
              ) : (
                <div className="mt-6 space-y-2">
                  {firestorePositions.map((pos) => (
                    <div key={pos.id} className="flex items-center justify-between rounded-lg border bg-card p-4">
                      <p className="font-medium">{pos.title}</p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { setEditingPosition(pos); setPositionTitle(pos.title); setShowPositionForm(true); }}
                        >
                          <Edit2 className="mr-1 h-3 w-3" /> Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={async () => {
                            try {
                              console.log(`🗑️ Deleting position ${pos.id} from ${COLLECTIONS.POSITIONS}`);
                              await deleteDoc(doc(db, COLLECTIONS.POSITIONS, pos.id));
                              console.log(`✅ Position deleted: ${pos.id}`);
                              toast.success('Position deleted');
                            } catch (err) {
                              const error = err as any;
                              console.error(`Firestore Error [${error.code}]:`, error.message, error);
                              toast.error(`Failed to delete position: ${error.message}`);
                            }
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ANALYTICS TAB */}
          {activeTab === 'analytics' && (
            <div>
              <h2 className="text-xl font-bold">Live Analytics</h2>
              <p className="mt-1 text-sm text-muted-foreground">Real-time vote tallies by position.</p>
              <div className="mt-6 space-y-8">
                {tallyByPosition.map(({ position, tallies }) => {
                  const maxCount = Math.max(...tallies.map((t) => t.count), 1);
                  return (
                    <div key={position.id}>
                      <p className="text-sm font-bold">{position.title}</p>
                      <div className="mt-3 space-y-2">
                        {tallies.map(({ candidate, count }) => (
                          <div key={candidate.id} className="flex items-center gap-3">
                            <span className="w-32 truncate text-sm">{candidate.name}</span>
                            <div className="flex-1">
                              <div className="h-6 rounded bg-secondary">
                                <motion.div
                                  className="flex h-6 items-center rounded bg-primary px-2 text-xs font-bold text-primary-foreground"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${Math.max((count / maxCount) * 100, count > 0 ? 10 : 0)}%` }}
                                  transition={{ duration: 0.5 }}
                                >
                                  {count}
                                </motion.div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-8 rounded-lg border bg-card p-4">
                <p className="text-sm font-semibold">Summary</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Total votes cast: {firestoreVotes.length} • 
                  Voters participated: {firestoreVoters.filter(v => v.hasVoted).length} / {firestoreVoters.length}
                </p>
              </div>
            </div>
          )}
        </motion.div>
      </main>

      {/* Add Candidate Dialog */}
      <Dialog open={showCandidateForm} onOpenChange={setShowCandidateForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Candidate</DialogTitle>
          </DialogHeader>
          {!stagedCandidate ? (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-semibold">Full Name</Label>
                <Input
                  value={newCandidate.name}
                  onChange={(e) => setNewCandidate((p) => ({ ...p, name: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm font-semibold">Position</Label>
                <Select
                  value={newCandidate.position}
                  onValueChange={(v) => setNewCandidate((p) => ({ ...p, position: v }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select position" />
                  </SelectTrigger>
                  <SelectContent>
                    {firestorePositions.map((pos) => (
                      <SelectItem key={pos.id} value={pos.id}>{pos.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-semibold">Manifesto</Label>
                <Textarea
                  value={newCandidate.manifesto}
                  onChange={(e) => setNewCandidate((p) => ({ ...p, manifesto: e.target.value }))}
                  className="mt-1"
                  rows={4}
                />
              </div>
              <div>
                <Label className="text-sm font-semibold">Photo</Label>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
                <Button variant="outline" size="sm" className="mt-1 w-full" onClick={() => photoInputRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" /> {newCandidate.photo ? 'Photo Added ✓' : 'Add Photo'}
                </Button>
              </div>
              <Button onClick={handleAddCandidate} className="w-full font-semibold">
                Preview & Continue
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border bg-secondary p-4">
                <p className="text-xs font-semibold text-muted-foreground">PREVIEW</p>
                <p className="mt-2 text-sm font-semibold">{stagedCandidate.name}</p>
                <p className="text-xs text-muted-foreground">
                  {firestorePositions.find(p => p.id === stagedCandidate.position)?.title || 'Position'}
                </p>
                {stagedCandidate.manifesto && (
                  <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{stagedCandidate.manifesto}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStagedCandidate(null)} className="w-full">
                  Back & Edit
                </Button>
                <Button onClick={handleSaveCandidateToFirestore} className="w-full font-semibold">
                  <Save className="mr-2 h-4 w-4" /> Save to Database
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Position Dialog */}
      <Dialog open={showPositionForm} onOpenChange={setShowPositionForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPosition ? 'Edit Position' : 'Add New Position'}</DialogTitle>
          </DialogHeader>
          {!stagedPosition ? (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-semibold">Position Title</Label>
                <Input
                  value={positionTitle}
                  onChange={(e) => setPositionTitle(e.target.value)}
                  placeholder="e.g. Director of Sports"
                  className="mt-1"
                />
              </div>
              <Button onClick={handleSavePosition} className="w-full font-semibold">
                Preview & Continue
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border bg-secondary p-4">
                <p className="text-xs font-semibold text-muted-foreground">PREVIEW</p>
                <p className="mt-2 text-lg font-semibold">{stagedPosition.title}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleAddPositionClose} className="w-full">
                  Back & Edit
                </Button>
                <Button onClick={handleSavePositionToFirestore} className="w-full font-semibold">
                  <Save className="mr-2 h-4 w-4" /> Save to Database
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
