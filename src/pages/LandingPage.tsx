import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, ArrowRight } from 'lucide-react';
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
        console.log(`✅ Loaded ${data.length} candidates`);
      },
      (err) => console.error('Error loading candidates:', err)
    );
    unsubscribers.push(candUnsub);

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, []);



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


      </div>

      {/* Footer */}
      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        Electoral Commission • Student Union • {new Date().getFullYear()}
      </footer>
    </div>
  );
};

export default LandingPage;
