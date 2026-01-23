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
import { useSchool } from "@/contexts/SchoolContext";
import { useState } from "react";

export function SchoolSwitcher() {
  const { 
    currentSchool, 
    activeSchoolId, 
    allSchools, 
    isSuperAdmin, 
    setActiveSchoolId,
    isLoadingSchool 
  } = useSchool();
  
  const [open, setOpen] = useState(false);

  // Only show for super admin
  if (!isSuperAdmin) {
    return null;
  }

  const activeSchool = allSchools.find(s => s.id === activeSchoolId) || currentSchool;

  if (isLoadingSchool) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
        <Building2 className="h-4 w-4 animate-pulse" />
        <span>טוען...</span>
      </div>
    );
  }

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
