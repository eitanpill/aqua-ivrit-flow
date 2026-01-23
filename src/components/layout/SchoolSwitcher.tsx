import { Check, ChevronsUpDown, Building2, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useState, useContext } from "react";
import React from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface School {
  id: string;
  name: string;
  slug: string;
}

export function SchoolSwitcher() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [allSchools, setAllSchools] = useState<School[]>([]);
  const [activeSchoolId, setActiveSchoolIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check super admin status and fetch schools
  React.useEffect(() => {
    const checkAndFetch = async () => {
      if (!user) {
        setIsSuperAdmin(false);
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await (supabase.rpc as any)('is_super_admin');
        if (!error && data === true) {
          setIsSuperAdmin(true);
          
          // Fetch all schools
          const { data: schools } = await supabase
            .from('schools')
            .select('id, name, slug')
            .order('name');
          
          setAllSchools(schools || []);
          
          // Load from localStorage
          const stored = localStorage.getItem('activeSchoolId');
          if (stored) {
            setActiveSchoolIdState(stored);
          } else if (schools && schools.length > 0) {
            setActiveSchoolIdState(schools[0].id);
          }
        } else {
          setIsSuperAdmin(false);
        }
      } catch {
        setIsSuperAdmin(false);
      }
      setIsLoading(false);
    };

    checkAndFetch();
  }, [user?.id]);

  const setActiveSchoolId = (id: string) => {
    setActiveSchoolIdState(id);
    localStorage.setItem('activeSchoolId', id);
  };

  // Don't render anything if not super admin or still loading
  if (isLoading || !isSuperAdmin) {
    return null;
  }

  const activeSchool = allSchools.find(s => s.id === activeSchoolId);

  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className="gap-1 bg-amber-500/10 text-amber-600 border-amber-500/30">
        <Shield className="h-3 w-3" />
        Super Admin
      </Badge>
      
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-[250px] justify-between"
          >
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">
                {activeSchool?.name || "בחר בית ספר"}
              </span>
            </div>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <Command>
            <CommandInput placeholder="חפש בית ספר..." className="text-right" />
            <CommandList>
              <CommandEmpty>לא נמצאו בתי ספר</CommandEmpty>
              <CommandGroup heading="בתי ספר">
                {allSchools.map((school) => (
                  <CommandItem
                    key={school.id}
                    value={school.name}
                    onSelect={() => {
                      setActiveSchoolId(school.id);
                      setOpen(false);
                    }}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <div className="flex flex-col">
                        <span>{school.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {school.slug}
                        </span>
                      </div>
                    </div>
                    <Check
                      className={cn(
                        "h-4 w-4",
                        activeSchoolId === school.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
