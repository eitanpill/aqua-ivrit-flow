import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Users, Search, Loader2, UserCog, Shield, User } from "lucide-react";
import { useAuth, type AppRole } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { WhatsAppButton } from "@/components/ui/whatsapp-button";
import { TooltipProvider } from "@/components/ui/tooltip";

interface UserProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  created_at: string;
  role: AppRole;
}

const roleLabels: Record<AppRole, string> = {
  admin: "מנהל",
  coach: "מאמן/מדריך",
  customer: "לקוח",
};

const roleIcons: Record<AppRole, typeof Shield> = {
  admin: Shield,
  coach: UserCog,
  customer: User,
};

const roleBadgeVariant: Record<AppRole, "default" | "secondary" | "outline"> = {
  admin: "default",
  coach: "secondary",
  customer: "outline",
};

export default function UsersPage() {
  const { isAdmin } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [newRole, setNewRole] = useState<AppRole>("customer");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  // Fetch all users with their profiles and roles
  const { data: users, isLoading } = useQuery({
    queryKey: ["all-users"],
    queryFn: async () => {
      // Get all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, phone, created_at, role")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Get roles from user_roles table
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles" as any)
        .select("user_id, role");

      if (rolesError) {
        console.error("Error fetching roles:", rolesError);
      }

      // Merge - prefer user_roles over profiles.role
      const usersWithRoles: UserProfile[] = profiles.map((p) => {
        const userRole = (roles as any[])?.find((r) => r.user_id === p.id);
        return {
          ...p,
          role: (userRole?.role as AppRole) || (p.role as AppRole) || "customer",
        };
      });

      return usersWithRoles;
    },
    enabled: isAdmin,
  });

  // Mutation to update user role
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      // Update in user_roles table
      const { error: upsertError } = await supabase
        .from("user_roles" as any)
        .upsert({ user_id: userId, role, updated_at: new Date().toISOString() }, { onConflict: "user_id" });

      if (upsertError) throw upsertError;

      // Also update profiles for backward compatibility
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ role })
        .eq("id", userId);

      if (profileError) throw profileError;

      return { userId, role };
    },
    onSuccess: (data) => {
      toast.success(`התפקיד עודכן ל${roleLabels[data.role]} בהצלחה!`);
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      setIsDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (error: Error) => {
      toast.error("שגיאה בעדכון התפקיד: " + error.message);
    },
  });

  const handleRoleChange = () => {
    if (selectedUser) {
      updateRoleMutation.mutate({ userId: selectedUser.id, role: newRole });
    }
  };

  const openRoleDialog = (user: UserProfile) => {
    setSelectedUser(user);
    setNewRole(user.role);
    setIsDialogOpen(true);
  };

  // Filter users by search term
  const filteredUsers = users?.filter((user) => {
    const fullName = `${user.first_name || ""} ${user.last_name || ""}`.toLowerCase();
    const phone = user.phone?.toLowerCase() || "";
    return fullName.includes(searchTerm.toLowerCase()) || phone.includes(searchTerm.toLowerCase());
  });

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">אין לך הרשאה לצפות בדף זה</p>
      </div>
    );
  }

  return (
    <TooltipProvider>
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">ניהול משתמשים</h1>
        <p className="text-muted-foreground mt-1">צפייה ועריכת תפקידי משתמשים במערכת</p>
      </div>

      {/* Search */}
      <Card className="border-border/50">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="חיפוש לפי שם או טלפון..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            רשימת משתמשים
          </CardTitle>
          <CardDescription>
            {filteredUsers?.length || 0} משתמשים במערכת
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !filteredUsers?.length ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">לא נמצאו משתמשים</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">שם</TableHead>
                  <TableHead className="text-right">טלפון</TableHead>
                  <TableHead className="text-right">תפקיד נוכחי</TableHead>
                  <TableHead className="text-right">תאריך הצטרפות</TableHead>
                  <TableHead className="text-right">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => {
                  const RoleIcon = roleIcons[user.role];
                  return (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.first_name || user.last_name
                          ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
                          : "ללא שם"}
                      </TableCell>
                      <TableCell dir="ltr" className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span>{user.phone || "-"}</span>
                          {user.phone && (
                            <WhatsAppButton
                              phone={user.phone}
                              name={`${user.first_name || ""} ${user.last_name || ""}`.trim()}
                            />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={roleBadgeVariant[user.role]} className="gap-1">
                          <RoleIcon className="h-3 w-3" />
                          {roleLabels[user.role]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(user.created_at).toLocaleDateString("he-IL")}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openRoleDialog(user)}
                        >
                          <UserCog className="h-4 w-4 ml-2" />
                          שנה תפקיד
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Role Change Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>שינוי תפקיד משתמש</DialogTitle>
            <DialogDescription>
              שינוי תפקיד עבור{" "}
              <strong>
                {selectedUser?.first_name} {selectedUser?.last_name}
              </strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>תפקיד נוכחי</Label>
              <Badge variant={roleBadgeVariant[selectedUser?.role || "customer"]}>
                {roleLabels[selectedUser?.role || "customer"]}
              </Badge>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-role">תפקיד חדש</Label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
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
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              ביטול
            </Button>
            <Button onClick={handleRoleChange} disabled={updateRoleMutation.isPending}>
              {updateRoleMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              ) : null}
              שמור שינויים
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
}
