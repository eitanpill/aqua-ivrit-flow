import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, UserPlus, Shield, UserCog, User } from "lucide-react";
import type { AppRole } from "@/hooks/useAuth";
import { isValidIsraeliPhone, israeliPhoneErrorMessage } from "@/lib/phoneUtils";

interface CreateUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateUserModal({ open, onOpenChange }: CreateUserModalProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [role, setRole] = useState<AppRole>("customer");
  const queryClient = useQueryClient();

  const validatePhone = (value: string) => {
    if (!value) {
      setPhoneError(null);
      return true;
    }
    const digits = value.replace(/\D/g, "");
    if (digits && !isValidIsraeliPhone(digits)) {
      setPhoneError(israeliPhoneErrorMessage);
      return false;
    }
    setPhoneError(null);
    return true;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPhone(value);
    validatePhone(value);
  };

  const createUserMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("create_user_profile" as any, {
        p_first_name: firstName,
        p_last_name: lastName,
        p_phone: phone ? phone.replace(/\D/g, "") : null,
        p_role: role,
      });

      if (error) throw error;
      
      const result = data as unknown as { success: boolean; error?: string; profile_id?: string };
      if (!result.success) {
        throw new Error(result.error || "שגיאה ביצירת המשתמש");
      }
      
      return result;
    },
    onSuccess: () => {
      toast.success("המשתמש נוצר בהצלחה!");
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
      resetForm();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setFirstName("");
    setLastName("");
    setPhone("");
    setPhoneError(null);
    setRole("customer");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("יש להזין שם פרטי ושם משפחה");
      return;
    }
    if (phone && !validatePhone(phone)) {
      toast.error(israeliPhoneErrorMessage);
      return;
    }
    createUserMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            הוספת משתמש חדש
          </DialogTitle>
          <DialogDescription>
            צור פרופיל משתמש חדש בבית הספר
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">שם פרטי</Label>
                <Input
                  id="firstName"
                  placeholder="ישראל"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">שם משפחה</Label>
                <Input
                  id="lastName"
                  placeholder="ישראלי"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">טלפון (אופציונלי)</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="0521234567"
                value={phone}
                onChange={handlePhoneChange}
                dir="ltr"
                className={`text-right ${phoneError ? "border-destructive" : ""}`}
              />
              {phoneError && (
                <p className="text-sm text-destructive">{phoneError}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">תפקיד</Label>
              <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      לקוח
                    </div>
                  </SelectItem>
                  <SelectItem value="coach">
                    <div className="flex items-center gap-2">
                      <UserCog className="h-4 w-4" />
                      מאמן/מדריך
                    </div>
                  </SelectItem>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      מנהל
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              ביטול
            </Button>
            <Button type="submit" disabled={createUserMutation.isPending}>
              {createUserMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              )}
              צור משתמש
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
