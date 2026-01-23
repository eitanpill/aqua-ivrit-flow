import { AlertTriangle, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useDemoMode } from "@/hooks/useDemoMode";

export function DemoBanner() {
  const { isDemoMode } = useDemoMode();
  const [isVisible, setIsVisible] = useState(true);

  if (!isDemoMode || !isVisible) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2 text-center relative">
      <div className="flex items-center justify-center gap-2 text-sm font-medium">
        <AlertTriangle className="h-4 w-4" />
        <span>מצב הדגמה - הנתונים הם להמחשה בלבד ואינם נשמרים</span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="absolute left-2 top-1/2 -translate-y-1/2 h-6 w-6 text-white/80 hover:text-white hover:bg-white/10"
        onClick={() => setIsVisible(false)}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
