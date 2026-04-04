import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, ArrowRight, TrendingUp } from 'lucide-react';
import { useElectionStore } from '@/store/electionStore';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { db } from '@/firebase';
import { collection, onSnapshot } from 'firebase/firestore';

const COLLECTIONS = {
  POSITIONS: 'positions',
  CANDIDATES: 'candidates',
  VOTES: 'votes',
} as const;

const LandingPage = () => {
  const { currentUser } = useElectionStore();
  const navigate = useNavigate();
  
  // Firestore real-time state
  const [positions, setPositions] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [votes, setVotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Real-time listeners for Firestore
  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    // Listen to positions
    const posUnsub = onSnapshot(
      collection(db, COLLECTIONS.POSITIONS),
      (snap) => {
        const data = snap.docs.map((d) => ({
          id: d.id,
          title: d.data().title || '',
        }));
        setPositions(data);
        console.log(`✅ Loaded ${data.length} positions for results`);
      },
      (err) => console.error('Error loading positions:', err)
    );
    unsubscribers.push(posUnsub);

    // Listen to candidates
    const candUnsub = onSnapshot(
      collection(db, COLLECTIONS.CANDIDATES),
      (snap) => {
        const data = snap.docs.map((d) => ({
          id: d.id,
          name: d.data().name || '',
          position: d.data().position || '',
        }));
        setCandidates(data);
        console.log(`✅ Loaded ${data.length} candidates for results`);
      },
      (err) => console.error('Error loading candidates:', err)
    );
    unsubscribers.push(candUnsub);

    // Listen to votes (real-time updates)
    const votesUnsub = onSnapshot(
      collection(db, COLLECTIONS.VOTES),
      (snap) => {
        const data = snap.docs.map((d) => ({
          id: d.id,
          positionId: d.data().positionId,
          candidateId: d.data().candidateId,
        }));
        setVotes(data);
        console.log(`📊 Real-time vote update: ${data.length} total votes`);
        setLoading(false);
      },
      (err) => {
        console.error('Error loading votes:', err);
        setLoading(false);
      }
    );
    unsubscribers.push(votesUnsub);

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, []);

  // Compute vote tallies per position (same as AdminDashboard)
  const tallyByPosition = useMemo(() => {
    return positions.map((pos) => {
      const posCandidates = candidates.filter((c) => c.position === pos.id);
      const tallies = posCandidates.map((c) => {
        const count = votes.filter((v) => v.candidateId === c.id).length;
        return { candidate: c, count };
      });
      const totalVotes = tallies.reduce((sum, t) => sum + t.count, 0);
      return { position: pos, tallies, totalVotes };
    });
  }, [positions, candidates, votes]);

  // Check if there are any positions with votes
  const hasResults = tallyByPosition.some((item) => item.totalVotes > 0);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Hero */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary">
            <ShieldCheck className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            Student Union<br />General Elections
          </h1>
          <p className="mx-auto mt-4 max-w-lg font-serif text-lg text-muted-foreground">
            Your vote is your voice. Participate in shaping the future of our student community through a secure and transparent electoral process.
          </p>
        </motion.div>


        {/* CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="mt-12"
        >
          <Button
            size="lg"
            className="px-8 text-base font-bold"
            onClick={() => navigate(currentUser ? '/dashboard' : '/login')}
          >
            {currentUser ? 'Go to Dashboard' : 'Authenticate to Vote'}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </motion.div>

        {/* Live Election Results */}
        {!loading && hasResults && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="mt-16 w-full max-w-2xl"
          >
            <div className="rounded-lg border bg-card p-8 shadow-sm">
              <div className="mb-6 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-bold">Live Election Results</h2>
              </div>
              
              <div className="space-y-10">
                {tallyByPosition
                  .filter((item) => item.totalVotes > 0)
                  .map(({ position, tallies, totalVotes }) => {
                    const maxCount = Math.max(...tallies.map((t) => t.count), 1);
                    return (
                      <div key={position.id}>
                        <div className="mb-4">
                          <p className="text-lg font-bold">{position.title}</p>
                          <p className="text-xs text-muted-foreground">Total votes: {totalVotes}</p>
                        </div>
                        <div className="space-y-3">
                          {tallies
                            .sort((a, b) => b.count - a.count)
                            .map(({ candidate, count }) => {
                              const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                              return (
                                <div key={candidate.id} className="space-y-1">
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="font-medium">{candidate.name}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {count} vote{count !== 1 ? 's' : ''} ({pct}%)
                                    </span>
                                  </div>
                                  <div className="h-3 overflow-hidden rounded-full bg-secondary">
                                    <motion.div
                                      className="h-full bg-primary"
                                      initial={{ width: 0 }}
                                      animate={{ width: `${Math.max(pct, count > 0 ? 5 : 0)}%` }}
                                      transition={{ duration: 0.6 }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    );
                  })}
              </div>

              <div className="mt-8 border-t pt-6">
                <p className="text-sm text-muted-foreground">
                  💾 Results update in real-time as votes are cast
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        Electoral Commission • Student Union • {new Date().getFullYear()}
      </footer>
    </div>
  );
};

export default LandingPage;
