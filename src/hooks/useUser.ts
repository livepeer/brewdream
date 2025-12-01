import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { User as SupabaseUser } from '@supabase/supabase-js';

interface UserData {
  id: string;
  email: string | null;
  created_at?: string;
}

interface UseUserOptions {
  allowSignedOff?: boolean;
}

interface UseUserReturn {
  user: UserData | null;
  loading: boolean;
  session: { user: SupabaseUser } | null;
}

/**
 * Unified authentication hook that handles user session and database sync.
 *
 * This hook:
 * - Gets the current logged in user from Supabase auth
 * - If there's a session, reads the user from our users table
 * - If user doesn't exist in DB, upserts with retry logic
 * - Returns the user object if found/created
 * - Redirects to login if missing (unless allowSignedOff is true)
 *
 * @param options.allowSignedOff - If true, returns null instead of redirecting when no user (default: false)
 * @returns { user, loading, session }
 */
export function useUser(options: UseUserOptions = {}): UseUserReturn {
  const { allowSignedOff = false } = options;
  const [user, setUser] = useState<UserData | null>(null);
  const [session, setSession] = useState<{ user: SupabaseUser } | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let mounted = true;

    const redirectToLogin = () => {
      if (!allowSignedOff) {
        const returnUrl = location.pathname + location.search;
        navigate(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);
      }
    };

    const syncUser = async () => {
      try {
        // Get current session
        const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('Error getting session:', sessionError);
          redirectToLogin();
          return;
        }

        if (!currentSession || !currentSession.user) {
          // No session - redirect to login unless allowSignedOff
          if (mounted) {
            setSession(null);
            setUser(null);
            setLoading(false);
            redirectToLogin();
          }
          return;
        }

        if (mounted) {
          setSession(currentSession);
        }

        // Try to get user from our users table
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', currentSession.user.id)
          .maybeSingle();

        if (userError) {
          console.error('Error fetching user from database:', userError);
          throw userError;
        }

        // If user exists in DB, we're done
        if (userData) {
          if (mounted) {
            setUser(userData);
            setLoading(false);
          }
          return;
        }

        // User doesn't exist - upsert with retry logic
        console.log('User not found in database, upserting with retry logic...');

        const maxRetries = 5;
        const retryDelays = [0, 500, 1000, 2000, 5000]; // Progressive backoff

        let lastError: Error | null = null;
        let success = false;

        for (let attempt = 0; attempt < maxRetries && mounted; attempt++) {
          try {
            // Wait for retry delay (skip for first attempt)
            if (attempt > 0) {
              await new Promise(resolve => setTimeout(resolve, retryDelays[attempt - 1]));
            }

            console.log(`Upsert attempt ${attempt + 1}/${maxRetries}...`);

            const { error: upsertError } = await supabase
              .from('users')
              .upsert(
                {
                  id: currentSession.user.id,
                  email: currentSession.user.email || null
                },
                { onConflict: 'id' }
              );

            if (upsertError) {
              console.error(`Upsert attempt ${attempt + 1} failed:`, upsertError);
              lastError = upsertError;
              continue;
            }

            // Upsert succeeded - now fetch the user
            const { data: newUserData, error: fetchError } = await supabase
              .from('users')
              .select('*')
              .eq('id', currentSession.user.id)
              .single();

            if (fetchError) {
              console.error(`Fetch after upsert attempt ${attempt + 1} failed:`, fetchError);
              lastError = fetchError;
              continue;
            }

            // Success!
            if (mounted) {
              setUser(newUserData);
              setLoading(false);
            }
            success = true;
            console.log('User upserted and fetched successfully');
            break;

          } catch (err) {
            console.error(`Unexpected error during upsert attempt ${attempt + 1}:`, err);
            lastError = err instanceof Error ? err : new Error(String(err));
          }
        }

        // If all retries failed
        if (!success && mounted) {
          console.error('All upsert attempts failed:', lastError);
          setLoading(false);
          redirectToLogin();
        }

      } catch (error) {
        console.error('Error in useUser:', error);
        if (mounted) {
          setLoading(false);
          redirectToLogin();
        }
      }
    };

    syncUser();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;

      // Re-run the sync when auth state changes
      syncUser();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [allowSignedOff, navigate, location.pathname, location.search]);

  return { user, loading, session };
}
