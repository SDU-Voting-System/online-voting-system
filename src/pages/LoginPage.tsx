import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, ArrowRight } from 'lucide-react';
import { useElectionStore } from '@/store/electionStore';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { db, auth } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import emailjs from '@emailjs/browser';

// Initialize EmailJS
emailjs.init('5_mAVzeMa2OLfsLk5');

const LoginPage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [matric, setMatric] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [generatedOTP, setGeneratedOTP] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { voters, login } = useElectionStore();

  const handleSendOtp = async () => {
    setError('');
    setLoading(true);
    const matricTrim = matric.trim();
    const emailTrim = email.trim().toLowerCase();

    // Admin bypass (system admin credentials) - Hardcoded and evaluated first
    if (matricTrim.toUpperCase() === 'ADMIN/001' && emailTrim === 'admin@university.edu') {
      // Immediately grant admin access without checking Firestore or voters array
      const adminVoter = {
        matricNumber: 'ADMIN/001',
        fullName: 'System Administrator',
        department: 'Administration',
        faculty: 'Administration',
        email: 'admin@university.edu',
        hasVoted: false,
      };
      login(adminVoter, true);
      navigate('/admin');
      setLoading(false);
      return;
    }

    try {
      // Check eligible_students collection by matric number (doc id)
      const ref = doc(db, 'eligible_students', matricTrim);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        setError('Matric number and email do not match any registered voter.');
        setLoading(false);
        return;
      }
      const data = snap.data() as any;
      if ((data.email || '').toString().toLowerCase() !== emailTrim) {
        setError('Matric number and email do not match any registered voter.');
        setLoading(false);
        return;
      }
      if (data.hasVoted) {
        setError('Your vote has already been recorded');
        setLoading(false);
        return;
      }

      // Generate 6-digit OTP and save to state IMMEDIATELY as string
      const newOtp = Math.floor(100000 + Math.random() * 900000);
      const otpString = String(newOtp);
      setGeneratedOTP(otpString);

      // Send OTP via EmailJS
      await emailjs.send('SDU_online_voting001', 'SDU_online_voting002', {
        to_email: data.email,
        otp_code: otpString,
      });

      // Only transition to OTP screen if email sent successfully
      setStep('otp');
    } catch (err) {
      console.error('Error sending OTP', err);
      setError('Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setError('');
    const userInput = otp.trim();
    
    // Debug log
    console.log('Expected:', generatedOTP, 'Got:', userInput);

    if (userInput.length !== 6) {
      setError('Please enter a valid 6-digit code.');
      return;
    }
    if (!generatedOTP || userInput !== generatedOTP) {
      setError('Invalid OTP.');
      return;
    }

    const matricTrim = matric.trim();
    try {
      const ref = doc(db, 'eligible_students', matricTrim);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        setError('Matric number not found.');
        return;
      }
      const data = snap.data() as any;
      if (data.hasVoted) {
        setError('Your vote has already been recorded');
        return;
      }

      // Sign in anonymously
      await signInAnonymously(auth);

      // Create voter object from Firestore data and log in to local store
      const voter = {
        matricNumber: matricTrim,
        fullName: data.fullName || '',
        department: data.department || '',
        faculty: data.faculty || '',
        email: data.email || '',
        hasVoted: !!data.hasVoted,
      };
      login(voter, false);
      navigate('/vote');
    } catch (err) {
      console.error('Verification error', err);
      setError('Verification failed. Try again later.');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Button
        variant="ghost"
        size="sm"
        className="absolute left-4 top-4"
        onClick={() => navigate('/')}
      >
        <ArrowRight className="mr-1 h-4 w-4 rotate-180" /> Back
      </Button>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary">
            <ShieldCheck className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Student Union Elections</h1>
          <p className="mt-2 font-serif text-muted-foreground">Secure Voter Authentication</p>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <AnimatePresence mode="wait">
            {step === 'credentials' ? (
              <motion.div key="cred" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="matric" className="text-sm font-semibold">Matric Number</Label>
                    <Input
                      id="matric"
                      placeholder="e.g. STU/2023/001"
                      value={matric}
                      onChange={(e) => setMatric(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email" className="text-sm font-semibold">Your Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@university.edu"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <Button onClick={handleSendOtp} disabled={loading} className="w-full font-semibold" size="lg">
                    {loading ? 'Sending...' : 'Send OTP'} {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
                  </Button>
                </div>
                <p className="mt-4 text-center text-xs text-muted-foreground">
                  A one-time code will be sent to your school email.
                </p>
              </motion.div>
            ) : (
              <motion.div key="otp" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <p className="mb-1 text-sm font-semibold">Verification Code</p>
                <p className="mb-4 text-sm text-muted-foreground">Enter the 6-digit code sent to <span className="font-medium text-foreground">{email}</span></p>
                <Input
                  placeholder="000000"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  className="text-center text-xl tracking-[0.5em] font-mono"
                />
                {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
                <Button onClick={handleVerify} className="mt-4 w-full font-semibold" size="lg">
                  Verify & Login
                </Button>
                <button
                  onClick={() => { setStep('credentials'); setOtp(''); setError(''); setGeneratedOTP(null); }}
                  className="mt-3 block w-full text-center text-sm text-muted-foreground hover:text-foreground"
                >
                  ← Back to credentials
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPage;
