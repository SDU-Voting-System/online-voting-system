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

export interface Poll {
  id: string;
  question: string;
  options: string[];
  isActive: boolean;
  votes: Record<string, number>; // option -> count
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

  // Polls
  polls: Poll[];
  addPoll: (question: string, options: string[]) => void;
  updatePoll: (id: string, question: string, options: string[]) => void;
  togglePollActive: (id: string) => void;
  deletePoll: (id: string) => void;
  votePoll: (pollId: string, option: string) => void;
}

const defaultPositions: Position[] = [
  { id: 'president', title: 'President' },
  { id: 'vice-president', title: 'Vice President' },
  { id: 'secretary-general', title: 'Secretary General' },
  { id: 'treasurer', title: 'Treasurer' },
  { id: 'pro', title: 'Public Relations Officer' },
];

const defaultVoters: Voter[] = [];

const defaultCandidates: Candidate[] = [];

const defaultPolls: Poll[] = [];

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

export const useElectionStore = create<ElectionStore>((set, get) => ({
  currentUser: null,
  isAdmin: false,
  login: (voter, admin = false) => set({ currentUser: voter, isAdmin: admin }),
  logout: () => set({ currentUser: null, isAdmin: false }),

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

  // Polls
  polls: defaultPolls,
  addPoll: (question, options) => set((s) => ({
    polls: [...s.polls, { id: genId(), question, options, isActive: false, votes: Object.fromEntries(options.map(o => [o, 0])) }],
  })),
  updatePoll: (id, question, options) => set((s) => ({
    polls: s.polls.map(p => p.id === id ? { ...p, question, options, votes: Object.fromEntries(options.map(o => [o, p.votes[o] || 0])) } : p),
  })),
  togglePollActive: (id) => set((s) => ({
    polls: s.polls.map(p => p.id === id ? { ...p, isActive: !p.isActive } : p),
  })),
  deletePoll: (id) => set((s) => ({ polls: s.polls.filter(p => p.id !== id) })),
  votePoll: (pollId, option) => set((s) => ({
    polls: s.polls.map(p => p.id === pollId ? { ...p, votes: { ...p.votes, [option]: (p.votes[option] || 0) + 1 } } : p),
  })),
}));
