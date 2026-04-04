import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, ArrowRight } from 'lucide-react';
import { useElectionStore } from '@/store/electionStore';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { db } from '@/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { sanitizeMatricForFirestore, normalizeEmail } from '@/lib/utils';
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
  const [isAdmin, setIsAdmin] = useState(false);
  const { voters, login } = useElectionStore();

  // Hardcoded admin credentials
  const ADMIN_MATRIC = 'ADMIN/001';
  const ADMIN_EMAIL = 'admin.university.edu@gmail.com';

  const handleSendOtp = async () => {
    setError('');
    setLoading(true);
    const matricTrim = matric.trim();
    const emailTrim = email.trim().toLowerCase();

    // Check if credentials match admin (exact match required)
    const isAdminAttempt = matricTrim.toUpperCase() === ADMIN_MATRIC && emailTrim === ADMIN_EMAIL;

    try {
      if (isAdminAttempt) {
        // ===== ADMIN OTP FLOW =====
        console.log('🔐 Admin OTP flow triggered for ADMIN/001');
        
        // Generate 6-digit OTP for admin
        const newOtp = Math.floor(100000 + Math.random() * 900000);
        const otpString = String(newOtp);
        setGeneratedOTP(otpString);
        setIsAdmin(true);

        // Send OTP via EmailJS to admin email
        console.log(`📧 Sending OTP to ${ADMIN_EMAIL}...`);
        await emailjs.send('SDU_online_voting001', 'SDU_online_voting002', {
          to_email: ADMIN_EMAIL,
          otp_code: otpString,
        });

        console.log('✅ OTP sent successfully. Waiting for admin to enter OTP.');
        setStep('otp');
      } else {
        // ===== STUDENT OTP FLOW =====
        console.log(`📧 Student OTP flow for matric: ${matricTrim}`);
        
        // Normalize inputs for consistent lookup
        const normalizedMatric = sanitizeMatricForFirestore(matricTrim);
        const normalizedEmail = normalizeEmail(emailTrim);
        
        console.log(`🔍 Querying eligible_students: matricNumber="${normalizedMatric}", email="${normalizedEmail}"`);
        
        // Query by fields for resilient lookup
        const q = query(
          collection(db, 'eligible_students'),
          where('matricNumber', '==', normalizedMatric),
          where('email', '==', normalizedEmail)
        );
        
        const querySnap = await getDocs(q);
        console.log(`  ✅ Query returned ${querySnap.docs.length} document(s)`);
        
        if (querySnap.docs.length === 0) {
          console.error(`❌ No voter found with matric="${normalizedMatric}" and email="${normalizedEmail}"`);
          setError('Matric number and email do not match any registered voter.');
          setLoading(false);
          return;
        }
        
        if (querySnap.docs.length > 1) {
          console.warn(`⚠️ Multiple voters found (${querySnap.docs.length}), using first match`);
        }
        
        const data = querySnap.docs[0].data() as any;
        
        if (data.hasVoted) {
          console.warn(`⚠️ Student already voted: ${normalizedMatric}`);
          setError('Your vote has already been recorded');
          setLoading(false);
          return;
        }
        
        console.log(`✅ Voter found and validated: ${data.fullName}`);

        // Generate 6-digit OTP for student
        const newOtp = Math.floor(100000 + Math.random() * 900000);
        const otpString = String(newOtp);
        setGeneratedOTP(otpString);
        setIsAdmin(false);

        // Send OTP via EmailJS
        console.log(`📧 Sending OTP to ${data.email}...`);
        await emailjs.send('SDU_online_voting001', 'SDU_online_voting002', {
          to_email: data.email,
          otp_code: otpString,
        });

        console.log('✅ OTP sent successfully. Waiting for student to enter OTP.');
        setStep('otp');
      }
    } catch (err: any) {
      console.error('❌ OTP Send Error:', err.code || err.message || err);
      
      // Better error messages
      if (err.code === 'permission-denied') {
        setError('Permission denied. Check Firestore rules.');
      } else if (err.code === 'not-found') {
        setError('Collection or document not found.');
      } else if (err.message?.includes('Invalid document reference')) {
        setError('Invalid matric format.');
      } else {
        setError(`OTP send failed: ${err.message || 'Unknown error'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setError('');
    const userInput = otp.trim();
    
    if (userInput.length !== 6) {
      setError('Please enter a valid 6-digit code.');
      return;
    }
    if (!generatedOTP || userInput !== generatedOTP) {
      setError('Invalid OTP.');
      return;
    }

    setLoading(true);

    if (isAdmin) {
      // ===== ADMIN OTP VERIFICATION =====
      console.log('✅ Admin OTP verified successfully');
      try {
        const adminVoter = {
          matricNumber: ADMIN_MATRIC,
          fullName: 'System Administrator',
          department: 'Administration',
          faculty: 'Administration',
          email: ADMIN_EMAIL,
          hasVoted: false,
        };

        console.log('🔐 Access granted to admin');
        login(adminVoter, true);
        navigate('/admin');
      } catch (err: any) {
        console.error('❌ Admin access failed:', err.message);
        setError(`Access failed: ${err.message}`);
        setLoading(false);
      }
    } else {
      // ===== STUDENT OTP VERIFICATION =====
      const matricTrim = matric.trim();
      const normalizedMatric = sanitizeMatricForFirestore(matricTrim);
      const normalizedEmail = normalizeEmail(email.trim());
      
      console.log(`✅ Student OTP verified for matric: ${normalizedMatric}`);
      try {
        // Query using same normalized fields as OTP send
        const q = query(
          collection(db, 'eligible_students'),
          where('matricNumber', '==', normalizedMatric),
          where('email', '==', normalizedEmail)
        );
        
        const querySnap = await getDocs(q);
        
        if (querySnap.docs.length === 0) {
          console.error(`❌ Student ${normalizedMatric} not found during verification`);
          setError('Student record not found.');
          setLoading(false);
          return;
        }
        
        const data = querySnap.docs[0].data() as any;
        if (data.hasVoted) {
          console.warn(`⚠️ Student already voted: ${normalizedMatric}`);
          setError('Your vote has already been recorded');
          setLoading(false);
          return;
        }

        // Create voter object from Firestore data
        const voter = {
          matricNumber: data.matricNumber,  // Use stored normalized matric
          fullName: data.fullName || '',
          department: data.department || '',
          faculty: data.faculty || '',
          email: data.email || '',
          hasVoted: !!data.hasVoted,
        };
        
        console.log('🔐 Access granted to student');
        login(voter, false);
        navigate('/vote');
      } catch (err: any) {
        console.error('❌ Verification error:', err.message || err);
        if (err.code === 'permission-denied') {
          setError('Verification permission denied. Contact admin.');
        } else {
          setError(`Verification failed: ${err.message || 'Unknown error'}`);
        }
        setLoading(false);
      }
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
