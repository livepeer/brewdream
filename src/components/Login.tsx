import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
// shadcn "pin" input
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Mail, RotateCw, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function Login() {
  const [email, setEmail] = useState("");
  const [anonLoading, setAnonLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);

  // OTP flow
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [justResent, setJustResent] = useState(false);
  const cooldownTimerRef = useRef<number | null>(null);

  const navigate = useNavigate();
  const { toast } = useToast();

  // Check existing session
  useEffect(() => {
    const checkExistingSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        const isAnon = (session.user as any)?.is_anonymous || false;
        setIsAnonymous(isAnon);
        if (!isAnon) navigate("/capture");
      }
    };
    checkExistingSession();
  }, [navigate]);

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) window.clearInterval(cooldownTimerRef.current);
    };
  }, []);

  const startResendCooldown = (secs = 60) => {
    setResendCooldown(secs);
    if (cooldownTimerRef.current) window.clearInterval(cooldownTimerRef.current);
    cooldownTimerRef.current = window.setInterval(() => {
      setResendCooldown((s) => {
        if (s <= 1) {
          if (cooldownTimerRef.current) window.clearInterval(cooldownTimerRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  const handleAnonymousLogin = async () => {
    setAnonLoading(true);
    try {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) throw error;

      if (data.user) {
        const { error: insertError } = await supabase
          .from("users")
          .upsert({ id: data.user.id, email: null }, { onConflict: "id" });
        if (insertError) throw insertError;
      }

      toast({ title: "Welcome!", description: "You can start creating clips right away" });
      navigate("/capture");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setAnonLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const currentUserId = session?.user?.id;

      // Check if email already exists (for anonymous users upgrading)
      if (currentUserId) {
        const { data: existingUser } = await supabase
          .from("users")
          .select("id")
          .eq("email", email)
          .single();

        if (existingUser) {
          toast({
            title: "Email already exists",
            description: "There is another account with this email. You'll switch to that account with the magic link we just sent you.",
            variant: "destructive"
          });
        }
      }

      if (isAnonymous && currentUserId) {
        // Link email to the existing anonymous account (triggers email change OTP)
        const { error: updateError } = await supabase.auth.updateUser({ email });
        if (updateError) throw updateError;
      } else {
        // Send OTP for passwordless sign-in
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: true },
        });
        if (error) throw error;
      }

      setOtpSent(true);
      setOtpCode("");
      startResendCooldown(60);

      toast({
        title: "OTP sent",
        description: "Check your email for a 6-digit code.",
      });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setEmailLoading(false);
    }
  };

  const handleVerifyOtp = async (code: string) => {
    setVerifying(true);
    try {
      if (isAnonymous) {
        // Confirm email change on the existing session
        const { data, error } = await supabase.auth.verifyOtp({
          email,
          token: code,
          type: "email_change",
        });
        if (error) throw error;

        // Refresh session and upsert users.email_verified = true
        const {
          data: { session: newSession },
        } = await supabase.auth.getSession();
        const userId = newSession?.user?.id;
        const userEmail = newSession?.user?.email;
        if (userId) {
          const { error: upsertError } = await supabase
            .from("users")
            .upsert({ id: userId, email: userEmail || email, email_verified: true }, { onConflict: "id" });
          if (upsertError) {
            console.error("Failed to update user record:", upsertError);
            toast({
              title: "Error",
              description: "Email verified but couldn't save user data. Please try again.",
              variant: "destructive"
            });
            setVerifying(false);
            return;
          }

          // Wait a bit for database replication before checking
          await new Promise(resolve => setTimeout(resolve, 500));

          // Verify the update was successful by re-querying
          const { data: verifyData, error: verifyError } = await supabase
            .from("users")
            .select("email_verified")
            .eq("id", userId)
            .single();

          if (verifyError || !verifyData?.email_verified) {
            console.error("Email verification not confirmed:", verifyError);
            toast({
              title: "Error",
              description: "Email verification not confirmed. Please try again.",
              variant: "destructive"
            });
            setVerifying(false);
            return;
          }
        }

        toast({
          title: "Success!",
          description: "Email added to your account",
        });
        navigate("/capture");
      } else {
        // Verify sign-in OTP
        const { data, error } = await supabase.auth.verifyOtp({
          email,
          token: code,
          type: "email",
        });
        if (error) throw error;

        // Upsert users.email_verified = true
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        const userEmail = session?.user?.email || email;

        if (userId) {
          const { error: upsertError } = await supabase
            .from("users")
            .upsert({ id: userId, email: userEmail, email_verified: true }, { onConflict: "id" });
          if (upsertError) {
            console.error("Failed to update user record:", upsertError);
            toast({
              title: "Error",
              description: "Logged in but couldn't save user data. Please try again.",
              variant: "destructive"
            });
            setVerifying(false);
            return;
          }

          // Wait a bit for database replication before checking
          await new Promise(resolve => setTimeout(resolve, 500));

          // Verify the update was successful by re-querying
          const { data: verifyData, error: verifyError } = await supabase
            .from("users")
            .select("email_verified")
            .eq("id", userId)
            .single();

          if (verifyError || !verifyData?.email_verified) {
            console.error("Email verification not confirmed:", verifyError);
            toast({
              title: "Error",
              description: "Email verification not confirmed. Please try again.",
              variant: "destructive"
            });
            setVerifying(false);
            return;
          }
        }

        toast({
          title: "Logged in!",
          description: "OTP verified successfully",
        });
        navigate("/capture");
      }
    } catch (error: any) {
      setOtpCode("");
      toast({ title: "Invalid code", description: error.message || "Please try again.", variant: "destructive" });
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || !email) return;
    try {
      if (isAnonymous) {
        const { error } = await supabase.auth.updateUser({ email });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: true },
        });
        if (error) throw error;
      }
      setJustResent(true);
      startResendCooldown(60);
      setTimeout(() => setJustResent(false), 900);
    } catch (error: any) {
      toast({ title: "Resend failed", description: error.message, variant: "destructive" });
    }
  };

  // Keep auth listener for safety (e.g., if user clicks link instead)
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        const wasAnonymous = (session.user as any)?.is_anonymous || false;
        if (!wasAnonymous) {
          const { error: upsertError } = await supabase
            .from("users")
            .upsert({ id: session.user.id, email: session.user.email, email_verified: true }, { onConflict: "id" });
          if (upsertError) {
            console.error("Failed to save user data on auth change:", upsertError);
            toast({
              title: "Error",
              description: "Logged in but couldn't save user data. Please try again.",
              variant: "destructive"
            });
            return;
          }

          // Wait a bit for database replication
          await new Promise(resolve => setTimeout(resolve, 500));

          // Verify the update was successful
          const { data: verifyData, error: verifyError } = await supabase
            .from("users")
            .select("email_verified")
            .eq("id", session.user.id)
            .single();

          if (verifyError || !verifyData?.email_verified) {
            console.error("Email verification not confirmed in auth listener:", verifyError);
            toast({
              title: "Error",
              description: "Email verification not confirmed. Please try logging in again.",
              variant: "destructive"
            });
            return;
          }
        }
        toast({
          title: "Success!",
          description: wasAnonymous ? "Email added to your account" : "Logged in successfully",
        });
        navigate("/capture");
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate, toast]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-background">
      <div className="w-full max-w-md space-y-8">
        <Link to="/" className="flex items-center gap-3 mb-8 justify-center hover:opacity-90 transition">
          <img src="/daydream-logo.svg" alt="Daydream" className="h-8 w-auto" />
          <h2 className="text-xl font-bold text-foreground">Brewdream</h2>
        </Link>

        <div className="text-center bg-neutral-950 shadow-lg shadow-[0_0_15px_2px_theme(colors.neutral.800/0.4)] border border-neutral-800 rounded-3xl p-6">
          {!otpSent ? (
            <>
              <h1 className="text-3xl font-bold mb-2">{isAnonymous ? "Add your email" : "Sign in"}</h1>
              <p className="text-muted-foreground">
                {isAnonymous ? "Save your clips and get a coffee ticket" : "Create AI video clips in seconds"}
              </p>

              <div className="space-y-4">
                {!isAnonymous && (
                  <>
                    <Button
                      onClick={handleAnonymousLogin}
                      disabled={anonLoading || emailLoading}
                      className="w-full h-14 bg-neutral-100 text-neutral-900 mt-8 hover:bg-neutral-200 border border-border transition-colors"
                    >
                      {anonLoading ? "Loading..." : "Continue without email"}
                    </Button>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-border" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">or sign in with email</span>
                      </div>
                    </div>
                  </>
                )}

                <form onSubmit={handleSendOtp} className="space-y-4">
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-12 bg-card border-border text-foreground"
                  />
                  <Button
                    type="submit"
                    disabled={emailLoading || anonLoading}
                    className="w-full h-12 bg-neutral-100 text-neutral-900 hover:bg-neutral-200 border border-border"
                  >
                    {emailLoading ? "Sending..." : isAnonymous ? "Add email & get code" : "Send code"}
                  </Button>
                </form>

                {isAnonymous && (
                  <Button
                    onClick={() => navigate("/capture")}
                    disabled={anonLoading || emailLoading}
                    variant="outline"
                    className="w-full h-12 border-border text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Stay Anonymous
                  </Button>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-6 py-4">
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                  <Mail className="w-8 h-8 text-primary" />
                </div>

                <div className="text-center space-y-2">
                  <h1 className="text-2xl font-bold">Enter the 6-digit code</h1>
                  <p className="text-sm text-muted-foreground">
                    We sent a code to <span className="font-medium text-foreground">{email}</span>
                  </p>
                </div>

                <div className="w-full flex flex-col items-center gap-6 mt-2">
                  <InputOTP
                    maxLength={6}
                    value={otpCode}
                    onChange={setOtpCode}
                    // When all slots are filled, verify
                    onComplete={handleVerifyOtp}
                    disabled={verifying}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>

                  <Button
                    onClick={() => handleVerifyOtp(otpCode)}
                    disabled={verifying || otpCode.length !== 6}
                    className="w-full h-12 bg-neutral-100 text-neutral-900 hover:bg-neutral-200 border border-border"
                  >
                    {verifying ? "Verifying…" : "Verify code"}
                  </Button>

                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    {resendCooldown > 0 ? (
                      <>
                        <RotateCw className="w-4 h-4 animate-spin-slow opacity-70" />
                        Resend available in {resendCooldown}s
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResend}
                        className="underline underline-offset-4 hover:text-foreground"
                      >
                        Resend code
                      </button>
                    )}
                    <AnimatePresence>
                      {justResent && (
                        <motion.span
                          initial={{ opacity: 0, y: -6, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -6, scale: 0.95 }}
                          transition={{ duration: 0.25 }}
                          className="inline-flex items-center gap-1 text-emerald-400"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Sent!
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setOtpSent(false);
                      setOtpCode("");
                      if (cooldownTimerRef.current) window.clearInterval(cooldownTimerRef.current);
                      setResendCooldown(0);
                    }}
                    className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                  >
                    Use a different email
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .animate-spin-slow {
          animation: spin 2.2s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg) }
          to { transform: rotate(360deg) }
        }
      `}</style>
    </div>
  );
}
