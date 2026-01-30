import { UserCog, GraduationCap, Users, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useState, useEffect } from "react";
import { useDemoMode } from "@/hooks/useDemoMode";

export type DemoRole = 'admin' | 'coach' | 'customer';

interface DemoRoleSwitcherProps {
  onRoleChange?: (role: DemoRole) => void;
}

const roleConfig: Record<DemoRole, { label: string; icon: React.ReactNode; description: string }> = {
  admin: {
    label: "מנהל",
    icon: <UserCog className="h-4 w-4" />,
    description: "צפייה בכל הפונקציות הניהוליות",
  },
  coach: {
    label: "מדריך",
    icon: <GraduationCap className="h-4 w-4" />,
    description: "ניהול שיעורים ותלמידים",
  },
  customer: {
    label: "הורה",
    icon: <Users className="h-4 w-4" />,
    description: "צפייה במשפחה והזמנות",
  },
};

// Storage key for persisting demo role
const DEMO_ROLE_KEY = 'demo-role';

export function useDemoRole() {
  const { isDemoMode } = useDemoMode();
  const [currentRole, setCurrentRole] = useState<DemoRole>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(DEMO_ROLE_KEY);
      if (stored === 'admin' || stored === 'coach' || stored === 'customer') {
        return stored;
      }
    }
    return 'admin'; // Default to admin view
  });

  useEffect(() => {
    localStorage.setItem(DEMO_ROLE_KEY, currentRole);
  }, [currentRole]);

  // In demo mode, use the selected role. Otherwise, return null for demoRole
  return {
    demoRole: isDemoMode ? currentRole : null,
    setDemoRole: setCurrentRole,
    // Helper flags for role-based UI (in demo mode, respect the selected role)
    isAdmin: !isDemoMode || currentRole === 'admin',
    isCoach: !isDemoMode || currentRole === 'admin' || currentRole === 'coach',
    isCustomer: !isDemoMode || currentRole === 'customer',
  };
}

export function DemoRoleSwitcher({ onRoleChange }: DemoRoleSwitcherProps) {
  const { isDemoMode } = useDemoMode();
  const { demoRole, setDemoRole } = useDemoRole();

  if (!isDemoMode || !demoRole) {
    return null;
  }

  const handleRoleChange = (role: DemoRole) => {
    setDemoRole(role);
    onRoleChange?.(role);
    // Force a page reload to update all role-based components
    window.location.reload();
  };

  const currentConfig = roleConfig[demoRole];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100 hover:text-amber-800"
        >
          {currentConfig.icon}
          <span className="hidden sm:inline">{currentConfig.label}</span>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-right">
          החלפת תצוגה בסיור
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {(Object.entries(roleConfig) as [DemoRole, typeof roleConfig.admin][]).map(([role, config]) => (
          <DropdownMenuItem
            key={role}
            onClick={() => handleRoleChange(role)}
            className={`flex items-center gap-3 cursor-pointer ${
              demoRole === role ? 'bg-amber-50 text-amber-700' : ''
            }`}
          >
            <div className={`p-1.5 rounded ${demoRole === role ? 'bg-amber-200' : 'bg-muted'}`}>
              {config.icon}
            </div>
            <div className="flex-1 text-right">
              <div className="font-medium">{config.label}</div>
              <div className="text-xs text-muted-foreground">{config.description}</div>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
