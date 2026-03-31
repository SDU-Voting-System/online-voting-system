import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useElectionStore, Candidate } from '@/store/electionStore';
import { db } from '@/firebase';
import { collection, getDocs, doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { UserCheck, ChevronRight, ChevronLeft, FileText, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const VotingBooth = () => {
  const { currentUser, positions: storePositions, candidates: storeCandidates, castVotes, markVoted } = useElectionStore();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [manifestoCandidate, setManifestoCandidate] = useState<Candidate | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [positions, setPositions] = useState(storePositions);
  const [candidates, setCandidates] = useState(storeCandidates);

  useEffect(() => {
    if (!currentUser) navigate('/login');
    if (currentUser?.hasVoted) navigate('/dashboard');
  }, [currentUser, navigate]);

  useEffect(() => {
    // fetch positions and candidates from Firestore, fallback to store
    let mounted = true;
    (async () => {
      try {
        const posSnap = await getDocs(collection(db, 'positions'));
        const candSnap = await getDocs(collection(db, 'candidates'));
        if (!mounted) return;
        const ps = posSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })).sort((a, b) => (a.title > b.title ? 1 : -1));
        const cs = candSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        if (ps.length) setPositions(ps as any);
        if (cs.length) setCandidates(cs as any);
      } catch (err) {
        console.error('Failed to load positions/candidates from Firestore', err);
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (!currentUser) return null;

  const isReview = currentStep === positions.length;
  const currentPosition = positions[currentStep];
  const positionCandidates = currentPosition
    ? candidates.filter((c) => c.position === currentPosition.id)
    : [];

  const handleSelect = (candidateId: string) => {
    setSelections((prev) => ({ ...prev, [currentPosition.id]: candidateId }));
  };

  const handleSubmit = async () => {
    if (!currentUser) return;
    setSubmitting(true);
    try {
      await runTransaction(db, async (transaction) => {
        const studentRef = doc(db, 'eligible_students', currentUser.matricNumber);
        const studentSnap = await transaction.get(studentRef);
        if (!studentSnap.exists()) throw new Error('Student record not found');
        const studentData = studentSnap.data() as any;
        if (studentData.hasVoted) throw new Error('Student has already voted');

        // create vote documents for each selection
        Object.entries(selections).forEach(([positionId, candidateId]) => {
          const voteRef = doc(collection(db, 'votes'));
          transaction.set(voteRef, {
            studentId: currentUser.matricNumber,
            positionId,
            candidateId,
            timestamp: serverTimestamp(),
          });
        });

        // mark student as hasVoted
        transaction.update(studentRef, { hasVoted: true });
      });

      // update local state/store after successful transaction
      castVotes(selections);
      markVoted(currentUser.matricNumber);
      setSubmitted(true);
    } catch (err: any) {
      console.error('Failed to submit ballot', err);
      alert(err?.message || 'Failed to submit ballot');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-accent/10">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <path
                d="M12 25L20 33L36 15"
                stroke="hsl(var(--accent))"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="100"
                className="animate-check-draw"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold">Vote Successfully Cast</h1>
          <p className="mt-2 font-serif text-muted-foreground">
            Your ballot has been recorded. Thank you for participating.
          </p>
          <Button
            variant="outline"
            className="mt-8"
            onClick={() => navigate('/dashboard')}
          >
            Return to Dashboard
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Stepper header */}
      <div className="border-b bg-card">
        <div className="mx-auto max-w-2xl px-4 py-4">
          <div className="flex items-center gap-1 overflow-x-auto">
            {positions.map((pos, i) => (
              <div key={pos.id} className="flex items-center">
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    i < currentStep
                      ? 'bg-accent text-accent-foreground'
                      : i === currentStep && !isReview
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-muted-foreground'
                  }`}
                >
                  {i < currentStep ? '✓' : i + 1}
                </div>
                {i < positions.length - 1 && (
                  <div className={`mx-1 h-px w-6 ${i < currentStep ? 'bg-accent' : 'bg-border'}`} />
                )}
              </div>
            ))}
            <div className="flex items-center">
              <div className="mx-1 h-px w-6 bg-border" />
              <div
                className={`flex h-7 shrink-0 items-center rounded-full px-2 text-xs font-bold ${
                  isReview ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
                }`}
              >
                Review
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <AnimatePresence mode="wait">
          {!isReview ? (
            <motion.div
              key={currentPosition.id}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
            >
              <h2 className="text-xl font-bold">{currentPosition.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">Select one candidate for this position.</p>

              <div className="mt-6 space-y-4">
                {positionCandidates.map((candidate) => {
                  const isSelected = selections[currentPosition.id] === candidate.id;
                  return (
                    <div
                      key={candidate.id}
                      onClick={() => handleSelect(candidate.id)}
                      className={`cursor-pointer rounded-lg border-2 bg-card p-5 transition-colors ${
                        isSelected ? 'border-primary shadow-sm' : 'border-transparent hover:border-border'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-secondary">
                          <UserCheck className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div className="flex-1">
                          <p className="font-bold">{candidate.name}</p>
                          <button
                            onClick={(e) => { e.stopPropagation(); setManifestoCandidate(candidate); }}
                            className="mt-1 flex items-center gap-1 text-sm text-primary hover:underline"
                          >
                            <FileText className="h-3 w-3" /> View Manifesto
                          </button>
                        </div>
                        <div
                          className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                            isSelected ? 'border-primary bg-primary' : 'border-border'
                          }`}
                        >
                          {isSelected && <div className="h-2 w-2 rounded-full bg-primary-foreground" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="review"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
            >
              <h2 className="text-xl font-bold">Review Your Ballot</h2>
              <p className="mt-1 font-serif text-sm text-muted-foreground">
                Please review your selections carefully. This action is final and irreversible.
              </p>

              <div className="mt-6 space-y-4">
                {positions.map((pos) => {
                  const selected = candidates.find((c) => c.id === selections[pos.id]);
                  return (
                    <div key={pos.id} className="rounded-lg border bg-card p-5">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{pos.title}</p>
                      {selected ? (
                        <div className="mt-2 flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
                            <UserCheck className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <p className="font-bold">{selected.name}</p>
                        </div>
                      ) : (
                        <p className="mt-2 text-sm italic text-muted-foreground">No selection</p>
                      )}
                    </div>
                  );
                })}
              </div>

              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="mt-8 w-full text-base font-bold"
                size="lg"
              >
                {submitting ? 'Submitting...' : 'Submit Ballot'}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Navigation */}
      {!isReview && (
        <div className="border-t bg-card">
          <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
            <Button
              variant="outline"
              onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
              disabled={currentStep === 0}
            >
              <ChevronLeft className="mr-1 h-4 w-4" /> Previous
            </Button>
            <Button
              onClick={() => setCurrentStep((s) => s + 1)}
              disabled={!selections[currentPosition.id]}
            >
              {currentStep === positions.length - 1 ? 'Review Ballot' : 'Next Position'}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {isReview && (
        <div className="border-t bg-card">
          <div className="mx-auto flex max-w-2xl px-4 py-4">
            <Button variant="outline" onClick={() => setCurrentStep(positions.length - 1)}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Back
            </Button>
          </div>
        </div>
      )}

      {/* Manifesto Modal */}
      <Dialog open={!!manifestoCandidate} onOpenChange={() => setManifestoCandidate(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
                <UserCheck className="h-5 w-5 text-muted-foreground" />
              </div>
              {manifestoCandidate?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Manifesto</p>
            <p className="mt-2 font-serif leading-relaxed text-foreground">
              {manifestoCandidate?.manifesto}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VotingBooth;
