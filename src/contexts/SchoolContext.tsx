import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface School {
  id: string;
  name: string;
  slug: string;
  owner_id: string | null;
  logo_url: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
}

interface SchoolContextType {
  currentSchool: School | null;
  activeSchoolId: string | null;
  allSchools: School[];
  isSuperAdmin: boolean;
  isLoadingSchool: boolean;
  setActiveSchoolId: (id: string) => void;
  refreshSchools: () => Promise<void>;
}

const SchoolContext = createContext<SchoolContextType | undefined>(undefined);

const SUPER_ADMIN_EMAIL = 'eitanpill@gmail.com';

export const SchoolProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [currentSchool, setCurrentSchool] = useState<School | null>(null);
  const [allSchools, setAllSchools] = useState<School[]>([]);
  const [activeSchoolId, setActiveSchoolIdState] = useState<string | null>(null);
  const [isLoadingSchool, setIsLoadingSchool] = useState(true);

  const isSuperAdmin = user?.email === SUPER_ADMIN_EMAIL;

  const fetchUserSchool = async () => {
    if (!user) {
      setCurrentSchool(null);
      setIsLoadingSchool(false);
      return;
    }

    try {
      // Get user's profile with school_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('school_id')
        .eq('id', user.id)
        .single();

      if (profile?.school_id) {
        const { data: school } = await supabase
          .from('schools')
          .select('*')
          .eq('id', profile.school_id)
          .single();

        setCurrentSchool(school);
        
        // Set active school if not already set
        if (!activeSchoolId) {
          setActiveSchoolIdState(school?.id || null);
        }
      }
    } catch (error) {
      console.error('Error fetching school:', error);
    } finally {
      setIsLoadingSchool(false);
    }
  };

  const fetchAllSchools = async () => {
    if (!isSuperAdmin) return;

    try {
      const { data: schools } = await supabase
        .from('schools')
        .select('*')
        .order('name');

      setAllSchools(schools || []);
    } catch (error) {
      console.error('Error fetching all schools:', error);
    }
  };

  const refreshSchools = async () => {
    await Promise.all([fetchUserSchool(), fetchAllSchools()]);
  };

  const setActiveSchoolId = (id: string) => {
    if (isSuperAdmin || id === currentSchool?.id) {
      setActiveSchoolIdState(id);
      // Store in localStorage for persistence
      localStorage.setItem('activeSchoolId', id);
    }
  };

  // Load active school from localStorage on mount
  useEffect(() => {
    const storedSchoolId = localStorage.getItem('activeSchoolId');
    if (storedSchoolId && isSuperAdmin) {
      setActiveSchoolIdState(storedSchoolId);
    }
  }, [isSuperAdmin]);

  // Fetch schools when user changes
  useEffect(() => {
    fetchUserSchool();
    if (isSuperAdmin) {
      fetchAllSchools();
    }
  }, [user?.id, isSuperAdmin]);

  return (
    <SchoolContext.Provider
      value={{
        currentSchool,
        activeSchoolId: activeSchoolId || currentSchool?.id || null,
        allSchools,
        isSuperAdmin,
        isLoadingSchool,
        setActiveSchoolId,
        refreshSchools,
      }}
    >
      {children}
    </SchoolContext.Provider>
  );
};

export const useSchool = () => {
  const context = useContext(SchoolContext);
  if (context === undefined) {
    throw new Error('useSchool must be used within a SchoolProvider');
  }
  return context;
};
