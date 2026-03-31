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

const defaultVoters: Voter[] = [
  { matricNumber: 'STU/2023/001', fullName: 'Adewale Okonkwo', department: 'Computer Science', faculty: 'Science', email: 'adewale@university.edu', hasVoted: false },
  { matricNumber: 'STU/2023/002', fullName: 'Fatima Ibrahim', department: 'Political Science', faculty: 'Social Sciences', email: 'fatima@university.edu', hasVoted: false },
  { matricNumber: 'STU/2023/003', fullName: 'Chukwuemeka Obi', department: 'Law', faculty: 'Law', email: 'chukwuemeka@university.edu', hasVoted: false },
  { matricNumber: 'STU/2023/004', fullName: 'Ngozi Eze', department: 'Economics', faculty: 'Social Sciences', email: 'ngozi@university.edu', hasVoted: false },
  { matricNumber: 'ADMIN/001', fullName: 'Electoral Admin', department: 'Administration', faculty: 'Registry', email: 'admin@university.edu', hasVoted: false },
];

const defaultCandidates: Candidate[] = [
  { id: 'c1', name: 'Olumide Adeyemi', position: 'president', manifesto: 'I pledge to champion transparency in student governance. My administration will establish an open-budget system, monthly town halls, and a student welfare emergency fund. Together, we will build a union that truly serves every student.', photo: '' },
  { id: 'c2', name: 'Amina Bello', position: 'president', manifesto: 'My vision is a union rooted in academic excellence and social justice. I will advocate for improved library hours, mental health resources, and partnerships with industry to create internship pathways for all faculties.', photo: '' },
  { id: 'c3', name: 'Tunde Bakare', position: 'vice-president', manifesto: 'As Vice President, I will bridge the gap between students and administration. My focus will be on resolving hostel accommodation issues, improving campus security, and ensuring every department has adequate representation.', photo: '' },
  { id: 'c4', name: 'Chidinma Nwosu', position: 'vice-president', manifesto: 'I stand for inclusivity and progress. My plan includes establishing a women\'s safety initiative, creating inter-faculty collaboration programs, and digitizing all union processes for greater accessibility.', photo: '' },
  { id: 'c5', name: 'Emeka Uche', position: 'secretary-general', manifesto: 'Efficiency and accountability will define my tenure. I will digitize all meeting records, ensure timely communication of union decisions, and establish a transparent grievance redressal mechanism.', photo: '' },
  { id: 'c6', name: 'Halima Suleiman', position: 'treasurer', manifesto: 'Financial stewardship is my priority. I will implement quarterly financial reports, establish an audit committee, and create a student entrepreneurship micro-grant programme funded by responsible budgeting.', photo: '' },
  { id: 'c7', name: 'David Okafor', position: 'pro', manifesto: 'I will transform how the union communicates. Expect a revamped social media presence, a weekly digital newsletter, and a dedicated feedback platform where every student voice can be heard and addressed.', photo: '' },
];

const defaultPolls: Poll[] = [
  {
    id: 'poll-1',
    question: 'Should the Student Union extend library hours to midnight?',
    options: ['Yes', 'No', 'Undecided'],
    isActive: true,
    votes: { 'Yes': 24, 'No': 8, 'Undecided': 5 },
  },
];

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
