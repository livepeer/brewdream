import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, Sparkles, Coffee } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUser } from '@/hooks/useUser';

export function Landing() {
  const navigate = useNavigate();
  
  // Use the unified user hook (allow signed off to see landing page)
  const { user, loading } = useUser({ allowSignedOff: true });

  // If logged in, redirect to capture
  useEffect(() => {
    if (!loading && user) {
      navigate('/capture');
    }
  }, [user, loading, navigate]);

  const handleStartClick = () => {
    // Navigate based on whether user exists
    if (user) {
      navigate('/capture');
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      <div className="max-w-md w-full text-center space-y-8">
        {/* Logo/Title */}
        <div className="space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-primary to-accent glow-strong mb-4">
            <Video className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-5xl font-bold gradient-text">Brewdream</h1>
          <p className="text-xl text-muted-foreground">
            Realtime AI Video Summit
          </p>
        </div>

        {/* Features */}
        <div className="space-y-4 text-left bg-card border border-border rounded-3xl p-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">AI-Enhanced Video</h3>
              <p className="text-sm text-muted-foreground">
                Create stunning clips with Daydream AI effects in real-time
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
              <Video className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">Share on X</h3>
              <p className="text-sm text-muted-foreground">
                Share your creation and join the conversation
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-accent-pink/20 flex items-center justify-center flex-shrink-0">
              <Coffee className="w-5 h-5" style={{ color: 'hsl(330 100% 70%)' }} />
            </div>
            <div>
              <h3 className="font-semibold mb-1">Get Coffee</h3>
              <p className="text-sm text-muted-foreground">
                Receive a QR code for your free coffee at the event
              </p>
            </div>
          </div>
        </div>

        {/* CTA Button */}
        <Button
          onClick={handleStartClick}
          className="w-full py-4 px-6 bg-primary text-primary-foreground rounded-full font-semibold text-lg glow-primary hover:scale-105 transition-smooth h-auto"
        >
          Brew Your Dream
        </Button>

        {/* Footer */}
        <p className="text-sm text-muted-foreground">
          Powered by{' '}
          <span className="text-primary font-semibold">Livepeer</span>
          {' × '}
          <span className="text-accent font-semibold">Daydream</span>
        </p>
      </div>
    </div>
  );
}
