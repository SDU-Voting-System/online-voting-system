import { create } from 'zustand';

export interface Voter {
  matricNumber: string;
  fullName: string;
  department: string;
  faculty: string;
  email: string;
  hasVoted: boolean;
}

export interface Candidate {
  id: string;
  name: string;
  position: string;
  manifesto: string;
  photo?: string;
}

export interface Position {
  id: string;
  title: string;
}

export interface Vote {
  positionId: string;
  candidateId: string;
}

interface ElectionStore {
  // Auth
  currentUser: Voter | null;
  isAdmin: boolean;
  login: (voter: Voter, admin?: boolean) => void;
  logout: () => void;

  // Voters
  voters: Voter[];
  addVoters: (voters: Voter[]) => void;

  // Positions
  positions: Position[];
  addPosition: (title: string, id?: string) => void;
  updatePosition: (id: string, title: string) => void;
  deletePosition: (id: string) => void;

  // Candidates
  candidates: Candidate[];
  addCandidate: (candidate: Omit<Candidate, 'id'> & { id?: string }) => void;
  deleteCandidate: (id: string) => void;

  // Votes
  votes: Vote[];
  castVotes: (selections: Record<string, string>) => void;
  markVoted: (matricNumber: string) => void;

  // Election config
  electionEndDate: Date;
  setElectionEndDate: (date: Date) => void;
  countdownEnabled: boolean;
  setCountdownEnabled: (enabled: boolean) => void;
}

const defaultPositions: Position[] = [];

const defaultVoters: Voter[] = [];

const defaultCandidates: Candidate[] = [];

let idCounter = 100;
const genId = () => `gen-${++idCounter}`;

const loadElectionEndDate = (): Date => {
  const stored = localStorage.getItem('electionEndDate');
  if (stored) {
    const date = new Date(stored);
    if (!isNaN(date.getTime())) return date;
  }
  return new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
};

const loadCountdownEnabled = (): boolean => {
  const stored = localStorage.getItem('countdownEnabled');
  if (stored !== null) return stored === 'true';
  return true;
};

const loadAdminState = (): { currentUser: Voter | null; isAdmin: boolean } => {
  try {
    const stored = localStorage.getItem('adminState');
    if (stored) {
      const parsed = JSON.parse(stored);
      return { currentUser: parsed.currentUser || null, isAdmin: !!parsed.isAdmin };
    }
  } catch (e) {
    console.error('Failed to load admin state:', e);
  }
  return { currentUser: null, isAdmin: false };
};

const saveAdminState = (currentUser: Voter | null, isAdmin: boolean) => {
  try {
    if (currentUser && isAdmin) {
      localStorage.setItem('adminState', JSON.stringify({ currentUser, isAdmin }));
      console.log('✅ Admin state persisted to localStorage');
    } else {
      localStorage.removeItem('adminState');
    }
  } catch (e) {
    console.error('Failed to save admin state:', e);
  }
};

export const useElectionStore = create<ElectionStore>((set, get) => {
  const initialAdmin = loadAdminState();
  
  return {
    currentUser: initialAdmin.currentUser,
    isAdmin: initialAdmin.isAdmin,
    login: (voter, admin = false) => {
      saveAdminState(voter, admin);
      set({ currentUser: voter, isAdmin: admin });
    },
    logout: () => {
      saveAdminState(null, false);
      set({ currentUser: null, isAdmin: false });
    },

  voters: defaultVoters,
  addVoters: (newVoters) => set((s) => ({ voters: [...s.voters, ...newVoters] })),

  positions: defaultPositions,
  addPosition: (title, id) => set((s) => ({ positions: [...s.positions, { id: id ?? genId(), title }] })),
  updatePosition: (id, title) => set((s) => ({ positions: s.positions.map(p => p.id === id ? { ...p, title } : p) })),
  deletePosition: (id) => set((s) => ({ positions: s.positions.filter(p => p.id !== id) })),

  candidates: defaultCandidates,
  addCandidate: (c) => set((s) => ({ candidates: [...s.candidates, { ...c, id: c.id ?? genId() }] })),
  deleteCandidate: (id) => set((s) => ({ candidates: s.candidates.filter(c => c.id !== id) })),

  votes: [],
  castVotes: (selections) => {
    const newVotes = Object.entries(selections).map(([positionId, candidateId]) => ({ positionId, candidateId }));
    set((s) => ({ votes: [...s.votes, ...newVotes] }));
  },
  markVoted: (matricNumber) => set((s) => ({
    voters: s.voters.map(v => v.matricNumber === matricNumber ? { ...v, hasVoted: true } : v),
    currentUser: s.currentUser?.matricNumber === matricNumber ? { ...s.currentUser, hasVoted: true } : s.currentUser,
  })),

  electionEndDate: loadElectionEndDate(),
  setElectionEndDate: (date) => {
    localStorage.setItem('electionEndDate', date.toISOString());
    set({ electionEndDate: date });
  },
  countdownEnabled: loadCountdownEnabled(),
  setCountdownEnabled: (enabled) => {
    localStorage.setItem('countdownEnabled', String(enabled));
    set({ countdownEnabled: enabled });
  },
  };
});
