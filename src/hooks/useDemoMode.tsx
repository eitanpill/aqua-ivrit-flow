import { createContext, useContext, ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

const DEMO_EMAIL = 'demo@aquaflow.app';

interface DemoModeContextType {
  isDemoMode: boolean;
  blockDemoAction: (actionName?: string) => boolean;
}

const DemoModeContext = createContext<DemoModeContextType | undefined>(undefined);

export function DemoModeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  
  // Demo mode is active if user is demo@aquaflow.app OR if ?demo=true is in URL
  const isDemoMode = user?.email === DEMO_EMAIL || searchParams.get("demo") === "true";

  /**
   * Block demo actions - provides UI feedback.
   * Note: Even if UI checks are bypassed, the database has 
   * RLS policies that block all write operations for demo users.
   */
  const blockDemoAction = (actionName?: string): boolean => {
    if (isDemoMode) {
      toast({
        title: "פעולה חסומה",
        description: actionName 
          ? `פעולת "${actionName}" חסומה במצב הדגמה`
          : "פעולה זו חסומה במצב הדגמה. אפשר רק לצפות בנתונים.",
        variant: "destructive",
      });
      return true; // Action was blocked
    }
    return false; // Action is allowed
  };

  return (
    <DemoModeContext.Provider value={{ isDemoMode, blockDemoAction }}>
      {children}
    </DemoModeContext.Provider>
  );
}

export function useDemoMode(): DemoModeContextType {
  const context = useContext(DemoModeContext);
  if (context === undefined) {
    throw new Error('useDemoMode must be used within a DemoModeProvider');
  }
  return context;
}

// Helper to get demo credentials
export const DEMO_CREDENTIALS = {
  email: DEMO_EMAIL,
  password: 'demo123',
};
