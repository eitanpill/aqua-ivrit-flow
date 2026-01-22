import { Settings } from 'lucide-react';
import { ParentProfileCard } from '@/components/customer/ParentProfileCard';

export default function CustomerSettings() {
  return (
    <div className="space-y-6 max-w-2xl mx-auto" dir="rtl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Settings className="h-8 w-8 text-primary" />
          הגדרות
        </h1>
        <p className="text-muted-foreground mt-1">
          ניהול הפרופיל האישי שלך
        </p>
      </div>

      {/* Profile Card */}
      <ParentProfileCard />
    </div>
  );
}
