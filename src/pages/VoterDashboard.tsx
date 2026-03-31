import { useElectionStore } from '@/store/electionStore';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { UserCheck, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect } from 'react';

const VoterDashboard = () => {
  const { currentUser, isAdmin, logout } = useElectionStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser) navigate('/login');
    if (isAdmin) navigate('/admin');
  }, [currentUser, isAdmin, navigate]);

  if (!currentUser) return null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <span className="font-bold">Elections Portal</span>
          </div>
          <button onClick={() => { logout(); navigate('/'); }} className="text-sm text-muted-foreground hover:text-foreground">
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <h1 className="text-2xl font-bold">Voter Dashboard</h1>
          <p className="mt-1 font-serif text-muted-foreground">Your election profile and voting status.</p>

          <div className="mt-8 rounded-lg border bg-card p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
                <UserCheck className="h-6 w-6 text-secondary-foreground" />
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-lg font-bold">{currentUser.fullName}</p>
                <p className="text-sm text-muted-foreground">{currentUser.matricNumber}</p>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-4 border-t pt-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Department</p>
                <p className="mt-1 text-sm font-medium">{currentUser.department}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Faculty</p>
                <p className="mt-1 text-sm font-medium">{currentUser.faculty}</p>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-lg border bg-card p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Voting Status</p>
            {currentUser.hasVoted ? (
              <div className="mt-3 flex items-center gap-2 text-accent">
                <ShieldCheck className="h-5 w-5" />
                <span className="font-semibold">Vote Successfully Cast</span>
              </div>
            ) : (
              <div className="mt-3">
                <p className="text-sm text-muted-foreground">You have not voted yet. Polls are currently open.</p>
                <Button onClick={() => navigate('/vote')} className="mt-4 font-semibold" size="lg">
                  Proceed to Voting Booth
                </Button>
              </div>
            )}
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default VoterDashboard;
