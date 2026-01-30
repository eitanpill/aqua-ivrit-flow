import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Settings, Save, Loader2, Clock, Users, CreditCard, Bell } from "lucide-react";

interface SystemPolicy {
  id: string;
  key: string;
  value: Record<string, any>;
  description: string | null;
}

const policyLabels: Record<string, { label: string; description: string; icon: React.ReactNode }> = {
  cancellation_window_hours: {
    label: "חלון ביטול (שעות)",
    description: "כמה שעות לפני השיעור ניתן לבטל ללא חיוב",
    icon: <Clock className="h-4 w-4" />,
  },
  waitlist_enabled: {
    label: "רשימת המתנה",
    description: "האם להפעיל רשימת המתנה לשיעורים מלאים",
    icon: <Users className="h-4 w-4" />,
  },
  auto_charge_subscriptions: {
    label: "חיוב אוטומטי",
    description: "חיוב אוטומטי של מנויים בתחילת חודש",
    icon: <CreditCard className="h-4 w-4" />,
  },
  send_reminders: {
    label: "שליחת תזכורות",
    description: "שליחת תזכורות אוטומטיות לפני שיעורים",
    icon: <Bell className="h-4 w-4" />,
  },
  reminder_hours_before: {
    label: "תזכורת לפני (שעות)",
    description: "כמה שעות לפני השיעור לשלוח תזכורת",
    icon: <Clock className="h-4 w-4" />,
  },
  max_makeup_days: {
    label: "תוקף שיעור השלמה (ימים)",
    description: "כמה ימים תוקף שיעור השלמה מרגע הנפקתו",
    icon: <Clock className="h-4 w-4" />,
  },
  default_session_capacity: {
    label: "קיבולת ברירת מחדל",
    description: "מספר משתתפים מקסימלי בשיעור חדש",
    icon: <Users className="h-4 w-4" />,
  },
};

const defaultPolicies = {
  cancellation_window_hours: 24,
  waitlist_enabled: true,
  auto_charge_subscriptions: false,
  send_reminders: true,
  reminder_hours_before: 2,
  max_makeup_days: 30,
  default_session_capacity: 6,
};

export function SystemPoliciesEditor() {
  const queryClient = useQueryClient();
  const [localPolicies, setLocalPolicies] = useState<Record<string, any>>(defaultPolicies);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch policies
  const { data: policies, isLoading } = useQuery({
    queryKey: ["system-policies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_policies")
        .select("*");
      
      if (error) throw error;
      return data as SystemPolicy[];
    },
  });

  // Initialize local state from fetched policies
  useEffect(() => {
    if (policies) {
      const policiesMap = { ...defaultPolicies };
      policies.forEach((p) => {
        if (p.value && typeof p.value === "object" && "value" in p.value) {
          policiesMap[p.key] = (p.value as any).value;
        } else if (p.value !== null && p.value !== undefined) {
          policiesMap[p.key] = p.value;
        }
      });
      setLocalPolicies(policiesMap);
    }
  }, [policies]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      // Upsert each policy
      for (const [key, value] of Object.entries(localPolicies)) {
        const { error } = await supabase
          .from("system_policies")
          .upsert({
            key,
            value: { value },
            description: policyLabels[key]?.description || null,
          }, { onConflict: "key" });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-policies"] });
      toast.success("ההגדרות נשמרו בהצלחה");
      setHasChanges(false);
    },
    onError: () => {
      toast.error("שגיאה בשמירת ההגדרות");
    },
  });

  const handleChange = (key: string, value: any) => {
    setLocalPolicies((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            הגדרות מערכת
          </CardTitle>
          <CardDescription>
            הגדרות כלליות שמשפיעות על פעולת המערכת
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Cancellation Window */}
          <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-3">
              {policyLabels.cancellation_window_hours.icon}
              <div>
                <p className="font-medium">{policyLabels.cancellation_window_hours.label}</p>
                <p className="text-sm text-muted-foreground">
                  {policyLabels.cancellation_window_hours.description}
                </p>
              </div>
            </div>
            <Input
              type="number"
              min="0"
              className="w-24 text-center"
              value={localPolicies.cancellation_window_hours}
              onChange={(e) =>
                handleChange("cancellation_window_hours", parseInt(e.target.value) || 0)
              }
            />
          </div>

          {/* Waitlist Toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-3">
              {policyLabels.waitlist_enabled.icon}
              <div>
                <p className="font-medium">{policyLabels.waitlist_enabled.label}</p>
                <p className="text-sm text-muted-foreground">
                  {policyLabels.waitlist_enabled.description}
                </p>
              </div>
            </div>
            <Switch
              checked={localPolicies.waitlist_enabled}
              onCheckedChange={(checked) => handleChange("waitlist_enabled", checked)}
            />
          </div>

          {/* Auto Charge Toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-3">
              {policyLabels.auto_charge_subscriptions.icon}
              <div>
                <p className="font-medium">{policyLabels.auto_charge_subscriptions.label}</p>
                <p className="text-sm text-muted-foreground">
                  {policyLabels.auto_charge_subscriptions.description}
                </p>
              </div>
            </div>
            <Switch
              checked={localPolicies.auto_charge_subscriptions}
              onCheckedChange={(checked) => handleChange("auto_charge_subscriptions", checked)}
            />
          </div>

          {/* Send Reminders Toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-3">
              {policyLabels.send_reminders.icon}
              <div>
                <p className="font-medium">{policyLabels.send_reminders.label}</p>
                <p className="text-sm text-muted-foreground">
                  {policyLabels.send_reminders.description}
                </p>
              </div>
            </div>
            <Switch
              checked={localPolicies.send_reminders}
              onCheckedChange={(checked) => handleChange("send_reminders", checked)}
            />
          </div>

          {/* Reminder Hours */}
          {localPolicies.send_reminders && (
            <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30 mr-8">
              <div className="flex items-center gap-3">
                {policyLabels.reminder_hours_before.icon}
                <div>
                  <p className="font-medium">{policyLabels.reminder_hours_before.label}</p>
                  <p className="text-sm text-muted-foreground">
                    {policyLabels.reminder_hours_before.description}
                  </p>
                </div>
              </div>
              <Input
                type="number"
                min="1"
                className="w-24 text-center"
                value={localPolicies.reminder_hours_before}
                onChange={(e) =>
                  handleChange("reminder_hours_before", parseInt(e.target.value) || 2)
                }
              />
            </div>
          )}

          {/* Makeup Days */}
          <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-3">
              {policyLabels.max_makeup_days.icon}
              <div>
                <p className="font-medium">{policyLabels.max_makeup_days.label}</p>
                <p className="text-sm text-muted-foreground">
                  {policyLabels.max_makeup_days.description}
                </p>
              </div>
            </div>
            <Input
              type="number"
              min="1"
              className="w-24 text-center"
              value={localPolicies.max_makeup_days}
              onChange={(e) =>
                handleChange("max_makeup_days", parseInt(e.target.value) || 30)
              }
            />
          </div>

          {/* Default Capacity */}
          <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-3">
              {policyLabels.default_session_capacity.icon}
              <div>
                <p className="font-medium">{policyLabels.default_session_capacity.label}</p>
                <p className="text-sm text-muted-foreground">
                  {policyLabels.default_session_capacity.description}
                </p>
              </div>
            </div>
            <Input
              type="number"
              min="1"
              className="w-24 text-center"
              value={localPolicies.default_session_capacity}
              onChange={(e) =>
                handleChange("default_session_capacity", parseInt(e.target.value) || 6)
              }
            />
          </div>

          {/* Save Button */}
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!hasChanges || saveMutation.isPending}
            className="w-full"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 ml-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 ml-2" />
            )}
            שמור שינויים
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
