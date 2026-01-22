import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Users, UserPlus, Shield, Loader2 } from "lucide-react";
import type { AppRole } from "@/hooks/useAuth";

interface UserWithRole {
  user_id: string;
  role: AppRole;
  first_name: string | null;
  last_name: string | null;
}

const roleLabels: Record<AppRole, string> = {
  admin: "מנהל",
  coach: "מאמן/מדריך",
  customer: "לקוח",
};

const roleBadgeVariant: Record<AppRole, "default" | "secondary" | "outline"> = {
  admin: "default",
  coach: "secondary",
  customer: "outline",
};

export function UserManagement() {
  const [email, setEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState<AppRole>("coach");
  const queryClient = useQueryClient();

  // Fetch all users with their roles (admin only)
  const { data: users, isLoading } = useQuery({
    queryKey: ["users-with-roles"],
    queryFn: async () => {
      // Get all user roles using raw query
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles' as any)
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Get profiles for these users
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name");

      if (profilesError) throw profilesError;

      // Combine data
      const usersWithRoles: UserWithRole[] = (roles as any[]).map((r) => {
        const profile = profiles.find((p) => p.id === r.user_id);
        return {
          user_id: r.user_id,
          role: r.role as AppRole,
          first_name: profile?.first_name || null,
          last_name: profile?.last_name || null,
        };
      });

      return usersWithRoles;
    },
  });

  // Mutation to set user role using RPC
  const setRoleMutation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: AppRole }) => {
      const { data, error } = await supabase
        .rpc('set_user_role_by_email' as any, { _email: email, _role: role });

      if (error) throw error;
      
      const result = data as unknown as { success: boolean; error?: string; user_id?: string };
      if (!result.success) {
        throw new Error(result.error || "שגיאה בעדכון התפקיד");
      }
      
      return result;
    },
    onSuccess: () => {
      toast.success("התפקיד עודכן בהצלחה!");
      setEmail("");
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("יש להזין כתובת אימייל");
      return;
    }
    setRoleMutation.mutate({ email: email.trim(), role: selectedRole });
  };

  // Filter to show only coaches and admins (staff)
  const staffUsers = users?.filter((u) => u.role === "coach" || u.role === "admin") || [];

  return (
    <div className="space-y-6">
      {/* Add New Coach Form */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            הוספת מאמן/מדריך
          </CardTitle>
          <CardDescription>
            הזן את כתובת האימייל של המשתמש שברצונך להגדיר כמאמן. 
            המשתמש צריך להירשם קודם למערכת.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">כתובת אימייל</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="example@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">תפקיד</Label>
                <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="coach">מאמן/מדריך</SelectItem>
                    <SelectItem value="admin">מנהל</SelectItem>
                    <SelectItem value="customer">לקוח</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button 
                  type="submit" 
                  disabled={setRoleMutation.isPending}
                  className="w-full"
                >
                  {setRoleMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  ) : (
                    <UserPlus className="h-4 w-4 ml-2" />
                  )}
                  הגדר תפקיד
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Staff List */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            צוות המערכת
          </CardTitle>
          <CardDescription>
            רשימת כל המאמנים והמנהלים במערכת
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : staffUsers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">אין עדיין אנשי צוות במערכת</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">שם</TableHead>
                  <TableHead className="text-right">תפקיד</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staffUsers.map((user) => (
                  <TableRow key={user.user_id}>
                    <TableCell>
                      {user.first_name || user.last_name
                        ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
                        : "ללא שם"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={roleBadgeVariant[user.role]}>
                        {roleLabels[user.role]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
