import { useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, ArrowRight, BarChart3 } from 'lucide-react';
import { useElectionStore } from '@/store/electionStore';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const LandingPage = () => {
  const { currentUser, polls, votePoll } = useElectionStore();
  const navigate = useNavigate();
  const [votedPolls, setVotedPolls] = useState<Set<string>>(new Set());

  const activePolls = polls.filter((p) => p.isActive);

  const handlePollVote = (pollId: string, option: string) => {
    if (votedPolls.has(pollId)) return;
    votePoll(pollId, option);
    setVotedPolls((prev) => new Set(prev).add(pollId));
  };

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

        {/* Active Polls */}
        {activePolls.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="mt-16 w-full max-w-lg"
          >
            {activePolls.map((poll) => {
              const totalVotes = Object.values(poll.votes).reduce((a, b) => a + b, 0);
              const hasVoted = votedPolls.has(poll.id);
              return (
                <div key={poll.id} className="rounded-lg border bg-card p-6 shadow-sm">
                  <div className="mb-4 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Live Poll</span>
                  </div>
                  <p className="text-lg font-bold">{poll.question}</p>
                  <div className="mt-4 space-y-2">
                    {poll.options.map((option) => {
                      const count = poll.votes[option] || 0;
                      const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                      return (
                        <button
                          key={option}
                          disabled={hasVoted}
                          onClick={() => handlePollVote(poll.id, option)}
                          className={`relative w-full overflow-hidden rounded-md border px-4 py-3 text-left text-sm font-medium transition-colors ${
                            hasVoted
                              ? 'cursor-default'
                              : 'cursor-pointer hover:border-primary hover:bg-primary/5'
                          }`}
                        >
                          {hasVoted && (
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.5 }}
                              className="absolute inset-y-0 left-0 bg-primary/10"
                            />
                          )}
                          <span className="relative z-10 flex items-center justify-between">
                            <span>{option}</span>
                            {hasVoted && (
                              <span className="text-xs text-muted-foreground">{pct}%</span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {hasVoted && (
                    <p className="mt-3 text-center text-xs text-muted-foreground">{totalVotes} total votes</p>
                  )}
                </div>
              );
            })}
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
