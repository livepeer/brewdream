import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Mail, ArrowLeft, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

export function Login() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Check if user is already logged in (anonymous or authenticated)
  useEffect(() => {
    const checkExistingSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // User is already logged in
        const isAnon = session.user.is_anonymous || false;
        setIsAnonymous(isAnon);

        // If they're authenticated (not anonymous), redirect to capture
        if (!isAnon) {
          navigate('/capture');
        }
      }
    };

    checkExistingSession();
  }, [navigate]);

  const handleAnonymousLogin = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInAnonymously();

      if (error) throw error;

      // Store anonymous user in users table (no email)
      if (data.user) {
        await supabase
          .from('users')
          .upsert({
            id: data.user.id,
            email: null
          }, { onConflict: 'id' });
      }

      toast({
        title: 'Welcome!',
        description: 'You can start creating clips right away',
      });

      navigate('/capture');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // If user is anonymous, we need to link their account
      if (isAnonymous) {
        // Update the anonymous user's email
        const { error: updateError } = await supabase.auth.updateUser({ email });
        if (updateError) throw updateError;
      }

      // Store or update user in our custom users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .upsert({ email }, { onConflict: 'email' })
        .select()
        .single();

      if (userError) throw userError;

      // Send magic link (OTP via email)
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/capture`,
        },
      });

      if (error) throw error;

      setOtpSent(true);
      toast({
        title: 'Check your email',
        description: 'We sent you a login code',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'email',
      });

      if (error) throw error;

      // Update users table with email
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('users')
          .upsert({
            id: user.id,
            email: user.email
          }, { onConflict: 'id' });
      }

      toast({
        title: 'Success!',
        description: isAnonymous ? 'Email added to your account' : 'Logged in successfully',
      });

      navigate('/capture');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      <div className="max-w-md w-full space-y-8">
        <Link to="/start" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-smooth">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>

        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-br from-primary to-accent glow-primary mb-4">
            {isAnonymous ? <User className="w-8 h-8 text-white" /> : <Mail className="w-8 h-8 text-white" />}
          </div>
          <h1 className="text-3xl font-bold mb-2">
            {otpSent ? 'Enter code' : isAnonymous ? 'Add your email' : 'Get started'}
          </h1>
          <p className="text-muted-foreground">
            {otpSent
              ? 'Check your email for the login code'
              : isAnonymous
                ? 'Save your clips and get a coffee ticket'
                : 'Create AI video clips in seconds'}
          </p>
        </div>

        {!otpSent ? (
          <div className="space-y-4">
            {/* Anonymous login button (primary CTA when not anonymous) */}
            {!isAnonymous && (
              <>
                <Button
                  onClick={handleAnonymousLogin}
                  disabled={loading}
                  className="w-full h-14 bg-primary text-primary-foreground text-lg font-semibold glow-primary hover:scale-105 transition-smooth"
                >
                  {loading ? 'Loading...' : 'Continue without email'}
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      Or sign in with email
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* Email form */}
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12 bg-card border-border text-foreground"
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className={`w-full h-12 ${isAnonymous ? 'bg-primary text-primary-foreground glow-primary' : 'bg-card border border-border hover:bg-accent'}`}
              >
                {loading
                  ? 'Sending...'
                  : isAnonymous
                    ? 'Add email & get coffee ticket'
                    : 'Send login code'}
              </Button>
            </form>
          </div>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <Input
                type="text"
                placeholder="Enter 6-digit code"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
                maxLength={6}
                className="h-12 bg-card border-border text-center text-2xl tracking-widest"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-primary text-primary-foreground glow-primary"
            >
              {loading ? 'Verifying...' : 'Verify code'}
            </Button>
            <button
              type="button"
              onClick={() => setOtpSent(false)}
              className="w-full text-sm text-muted-foreground hover:text-foreground transition-smooth"
            >
              Use a different email
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
