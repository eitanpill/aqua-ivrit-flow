import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Waves } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to auth page after brief loading
    const timer = setTimeout(() => {
      navigate('/auth');
    }, 1500);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background" dir="rtl">
      <div className="text-center space-y-6">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl gradient-primary aqua-glow animate-float">
          <Waves className="h-10 w-10 text-primary-foreground" />
        </div>
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-foreground">AquaFlow</h1>
          <p className="text-xl text-muted-foreground">מערכת ניהול בית ספר לשחייה</p>
        </div>
        <div className="flex justify-center">
          <div className="h-1 w-32 rounded-full bg-gradient-to-r from-primary/20 via-primary to-primary/20 animate-pulse" />
        </div>
      </div>
    </div>
  );
};

export default Index;
