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
import { useState } from "react";
import { useSchool } from "@/contexts/SchoolContext";
import { useNavigate } from "react-router-dom";

export function SchoolSwitcher() {
  const navigate = useNavigate();
  const { 
    isSuperAdmin, 
    allSchools, 
    activeSchoolId, 
    switchSchool,
    isLoadingSchool 
  } = useSchool();
  const [open, setOpen] = useState(false);

  // Don't render anything if not super admin or still loading
  if (isLoadingSchool || !isSuperAdmin) {
    return null;
  }

  const activeSchool = allSchools.find(s => s.id === activeSchoolId);

  const handleSchoolSelect = (schoolId: string) => {
    // Switch school context (this will invalidate all queries)
    switchSchool(schoolId);
    setOpen(false);
    
    // Navigate to dashboard for a clean view
    navigate('/dashboard');
  };

  const isDemoSchool = activeSchool?.slug?.toLowerCase().includes('demo');

  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className="gap-1 bg-amber-500/10 text-amber-600 border-amber-500/30">
        <Shield className="h-3 w-3" />
        Super Admin
      </Badge>
      
      {isDemoSchool && (
        <Badge variant="destructive" className="gap-1 animate-pulse">
          מצב הדגמה
        </Badge>
      )}
      
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
                {allSchools.map((school) => {
                  const isDemo = school.slug?.toLowerCase().includes('demo');
                  return (
                    <CommandItem
                      key={school.id}
                      value={school.name}
                      onSelect={() => handleSchoolSelect(school.id)}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span>{school.name}</span>
                            {isDemo && (
                              <Badge variant="outline" className="text-xs bg-orange-50 text-orange-600 border-orange-200">
                                הדגמה
                              </Badge>
                            )}
                          </div>
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
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
