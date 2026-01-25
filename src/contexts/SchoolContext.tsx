import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';

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
  switchSchool: (id: string) => void;
  refreshSchools: () => Promise<void>;
}

const SchoolContext = createContext<SchoolContextType | undefined>(undefined);

export const SchoolProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentSchool, setCurrentSchool] = useState<School | null>(null);
  const [allSchools, setAllSchools] = useState<School[]>([]);
  const [activeSchoolId, setActiveSchoolIdState] = useState<string | null>(null);
  const [isLoadingSchool, setIsLoadingSchool] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // Check if user is a platform admin via database function (not hardcoded email)
  const checkSuperAdmin = async () => {
    if (!user) {
      setIsSuperAdmin(false);
      return false;
    }

    try {
      const { data, error } = await (supabase.rpc as any)('is_super_admin');
      if (!error && data === true) {
        setIsSuperAdmin(true);
        return true;
      } else {
        setIsSuperAdmin(false);
        return false;
      }
    } catch {
      setIsSuperAdmin(false);
      return false;
    }
  };

  const fetchUserSchool = async () => {
    if (!user) {
      setCurrentSchool(null);
      setIsLoadingSchool(false);
      return null;
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
        return school;
      }
      return null;
    } catch (error) {
      console.error('Error fetching school:', error);
      return null;
    }
  };

  const fetchAllSchools = async () => {
    try {
      const { data: schools } = await supabase
        .from('schools')
        .select('*')
        .order('name');

      setAllSchools(schools || []);
      return schools || [];
    } catch (error) {
      console.error('Error fetching all schools:', error);
      return [];
    }
  };

  const refreshSchools = async () => {
    await Promise.all([fetchUserSchool(), fetchAllSchools()]);
  };

  // Switch school - only for Super Admins
  const switchSchool = useCallback((id: string) => {
    if (!isSuperAdmin) {
      console.warn('Only Super Admins can switch schools');
      return;
    }
    
    setActiveSchoolIdState(id);
    localStorage.setItem('activeSchoolId', id);
    
    // CRITICAL: Invalidate ALL queries to force data refresh with new school_id
    queryClient.invalidateQueries();
  }, [isSuperAdmin, queryClient]);

  // Initialize school context
  useEffect(() => {
    const initializeSchoolContext = async () => {
      if (!user) {
        setIsLoadingSchool(false);
        return;
      }

      setIsLoadingSchool(true);
      
      try {
        // Check super admin status first
        const isSuper = await checkSuperAdmin();
        
        // Fetch user's assigned school
        const userSchool = await fetchUserSchool();
        
        if (isSuper) {
          // Super Admin: Load all schools and check localStorage for last selection
          const schools = await fetchAllSchools();
          const storedSchoolId = localStorage.getItem('activeSchoolId');
          
          // Validate stored school ID exists
          const storedSchoolExists = schools.some(s => s.id === storedSchoolId);
          
          if (storedSchoolId && storedSchoolExists) {
            setActiveSchoolIdState(storedSchoolId);
          } else if (userSchool) {
            // Default to user's assigned school
            setActiveSchoolIdState(userSchool.id);
            localStorage.setItem('activeSchoolId', userSchool.id);
          } else if (schools.length > 0) {
            // Fallback to first school
            setActiveSchoolIdState(schools[0].id);
            localStorage.setItem('activeSchoolId', schools[0].id);
          }
        } else {
          // Normal Admin/Coach: Force use their assigned school (no switching)
          if (userSchool) {
            setActiveSchoolIdState(userSchool.id);
          }
        }
      } catch (error) {
        console.error('Error initializing school context:', error);
      } finally {
        setIsLoadingSchool(false);
      }
    };

    initializeSchoolContext();
  }, [user?.id]);

  // Compute the effective activeSchoolId
  const effectiveActiveSchoolId = activeSchoolId || currentSchool?.id || null;

  return (
    <SchoolContext.Provider
      value={{
        currentSchool,
        activeSchoolId: effectiveActiveSchoolId,
        allSchools,
        isSuperAdmin,
        isLoadingSchool,
        switchSchool,
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
