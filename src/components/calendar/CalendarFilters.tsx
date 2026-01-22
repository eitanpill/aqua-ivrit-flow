import { Filter } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface Location {
  id: string;
  name: string;
}

interface Coach {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

interface CalendarFiltersProps {
  locations: Location[];
  coaches: Coach[];
  selectedLocation: string;
  selectedCoach: string;
  onLocationChange: (value: string) => void;
  onCoachChange: (value: string) => void;
  hideCoachFilter?: boolean;
}

export function CalendarFilters({
  locations,
  coaches,
  selectedLocation,
  selectedCoach,
  onLocationChange,
  onCoachChange,
  hideCoachFilter = false,
}: CalendarFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 p-4 bg-card rounded-lg border">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Filter className="h-4 w-4" />
        <span>סינון:</span>
      </div>

      <div className="flex items-center gap-2">
        <Label htmlFor="location-filter" className="text-sm whitespace-nowrap">
          סנן לפי בריכה
        </Label>
        <Select value={selectedLocation} onValueChange={onLocationChange}>
          <SelectTrigger id="location-filter" className="w-[180px]">
            <SelectValue placeholder="כל הבריכות" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הבריכות</SelectItem>
            {locations.map((location) => (
              <SelectItem key={location.id} value={location.id}>
                {location.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!hideCoachFilter && (
        <div className="flex items-center gap-2">
          <Label htmlFor="coach-filter" className="text-sm whitespace-nowrap">
            סנן לפי מאמן
          </Label>
          <Select value={selectedCoach} onValueChange={onCoachChange}>
            <SelectTrigger id="coach-filter" className="w-[180px]">
              <SelectValue placeholder="כל המאמנים" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל המאמנים</SelectItem>
              {coaches.map((coach) => (
                <SelectItem key={coach.id} value={coach.id}>
                  {`${coach.first_name || ''} ${coach.last_name || ''}`.trim() || 'לא ידוע'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
