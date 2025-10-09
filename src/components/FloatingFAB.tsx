import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FloatingFABProps {
  isAuthenticated: boolean;
}

export function FloatingFAB({ isAuthenticated }: FloatingFABProps) {
  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Button
        asChild
        size="lg"
        className="h-14 w-14 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 text-white hover:scale-105 shadow-lg"
      >
        <Link to={isAuthenticated ? "/capture" : "/login"}>
          <Plus className="h-6 w-6" />
        </Link>
      </Button>
    </div>
  );
}
