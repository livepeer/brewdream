import { Link } from 'react-router-dom';
import { Plus, Video, VideoIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface FloatingFABProps {
  isAuthenticated: boolean;
}

export function FloatingFAB({ isAuthenticated }: FloatingFABProps) {
  const [showOnDesktop, setShowOnDesktop] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      setShowOnDesktop(scrollY > 150);
    };

    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    // Initial check
    handleResize();
    handleScroll();

    window.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const shouldShow = showOnDesktop || isMobile;

  return (
    <AnimatePresence>
      {shouldShow && (
       <motion.div
       className="fixed bottom-6 left-1/2 z-50"
       initial={{ opacity: 0, y: 100, x: "-50%" }}
       animate={{ opacity: 1, y: 0, x: "-50%" }}
       exit={{ opacity: 0, y: 100, x: "-50%" }}
       transition={{
         type: "spring",
         stiffness: 300,
         damping: 30,
         duration: 0.3,
       }}
     >
       <Button
         size="sm"
         className="bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 text-white hover:scale-105"
         asChild
       >
         <Link to={isAuthenticated ? "/capture" : "/login"}>
           <Video className="h-4 w-4" />
           Record Clip
         </Link>
       </Button>
     </motion.div>
      )}
    </AnimatePresence>
  );
}
