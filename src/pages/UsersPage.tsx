import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Users, Search, Loader2, UserCog, Shield, User, UserPlus, Pencil, Trash2, Calendar, Eye } from "lucide-react";
import { useAuth, type AppRole } from "@/hooks/useAuth";
import { WhatsAppButton } from "@/components/ui/whatsapp-button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CreateUserModal } from "@/components/users/CreateUserModal";
import { EditUserModal } from "@/components/users/EditUserModal";
import { DeleteUserDialog } from "@/components/users/DeleteUserDialog";
import { UserEnrollmentSheet } from "@/components/users/UserEnrollmentSheet";
import { CoachDetailsSheet } from "@/components/users/CoachDetailsSheet";
import { AdaptiveTable, type AdaptiveColumn, type AdaptiveAction } from "@/components/ui/adaptive-table";
import { formatPhone } from "@/lib/phoneUtils";

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
  const { isAdmin, user: currentUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  
  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserProfile | null>(null);
  const [deleteUser, setDeleteUser] = useState<UserProfile | null>(null);
  const [enrollmentUser, setEnrollmentUser] = useState<{ id: string; name: string } | null>(null);
  const [coachDetails, setCoachDetails] = useState<{ id: string; name: string } | null>(null);

  // Fetch all users with their profiles and roles
  const { data: users, isLoading } = useQuery({
    queryKey: ["all-users"],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, phone, created_at, role")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from("user_roles" as any)
        .select("user_id, role");

      if (rolesError) {
        console.error("Error fetching roles:", rolesError);
      }

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

  // Filter users by search term
  const filteredUsers = users?.filter((user) => {
    const fullName = `${user.first_name || ""} ${user.last_name || ""}`.toLowerCase();
    const phone = user.phone?.toLowerCase() || "";
    return fullName.includes(searchTerm.toLowerCase()) || phone.includes(searchTerm.toLowerCase());
  });

  const openEnrollmentSheet = (user: UserProfile) => {
    const name = `${user.first_name || ""} ${user.last_name || ""}`.trim() || "ללא שם";
    setEnrollmentUser({ id: user.id, name });
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">אין לך הרשאה לצפות בדף זה</p>
      </div>
    );
  }

  // Define columns for AdaptiveTable
  const columns: AdaptiveColumn<UserProfile>[] = [
    {
      key: "name",
      header: "שם",
      primary: true,
      render: (user) => {
        const userName = user.first_name || user.last_name
          ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
          : "ללא שם";
        return <span className="font-medium">{userName}</span>;
      },
    },
    {
      key: "phone",
      header: "טלפון",
      render: (user) => {
        const userName = `${user.first_name || ""} ${user.last_name || ""}`.trim() || "ללא שם";
        return (
          <div className="flex items-center justify-end gap-2" dir="ltr">
            <span>{formatPhone(user.phone)}</span>
            {user.phone && (
              <WhatsAppButton phone={user.phone} name={userName} />
            )}
          </div>
        );
      },
    },
    {
      key: "role",
      header: "תפקיד",
      render: (user) => {
        const RoleIcon = roleIcons[user.role];
        return (
          <Badge variant={roleBadgeVariant[user.role]} className="gap-1">
            <RoleIcon className="h-3 w-3" />
            {roleLabels[user.role]}
          </Badge>
        );
      },
    },
    {
      key: "created_at",
      header: "תאריך הצטרפות",
      hideOnMobile: true,
      render: (user) => (
        <span>{new Date(user.created_at).toLocaleDateString("he-IL")}</span>
      ),
    },
  ];

  // Define actions for AdaptiveTable
  const getActions = (): AdaptiveAction<UserProfile>[] => [
    {
      label: "ערוך פרטים",
      icon: Pencil,
      onClick: (user) => {
        if (user.id !== currentUser?.id) {
          setEditUser(user);
        }
      },
    },
    {
      label: "פרטי מאמן",
      icon: Eye,
      onClick: (user) => {
        if (user.role === "coach") {
          const userName = `${user.first_name || ""} ${user.last_name || ""}`.trim() || "ללא שם";
          setCoachDetails({ id: user.id, name: userName });
        }
      },
    },
    {
      label: "ניהול הרשמות",
      icon: Calendar,
      onClick: (user) => {
        if (user.id !== currentUser?.id) {
          openEnrollmentSheet(user);
        }
      },
    },
    {
      label: "מחק משתמש",
      icon: Trash2,
      variant: "destructive",
      onClick: (user) => {
        if (user.id !== currentUser?.id) {
          setDeleteUser(user);
        }
      },
    },
  ];

  // Filter out current user from actions
  const filteredData = filteredUsers?.filter(user => user.id !== currentUser?.id) || [];
  const currentUserData = filteredUsers?.find(user => user.id === currentUser?.id);

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">ניהול משתמשים</h1>
            <p className="text-muted-foreground mt-1">צפייה, יצירה ועריכת משתמשים במערכת</p>
          </div>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <UserPlus className="h-4 w-4 ml-2" />
            משתמש חדש
          </Button>
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
            ) : (
              <>
                {/* Show current user separately if they exist in filtered results */}
                {currentUserData && (
                  <div className="mb-4 p-3 bg-muted/50 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">
                        {currentUserData.first_name || ""} {currentUserData.last_name || ""}
                      </span>
                      <Badge variant="outline" className="text-muted-foreground">אתה</Badge>
                    </div>
                    <Badge variant={roleBadgeVariant[currentUserData.role]} className="gap-1">
                      {roleLabels[currentUserData.role]}
                    </Badge>
                  </div>
                )}
                <AdaptiveTable
                  data={filteredData}
                  columns={columns}
                  actions={getActions()}
                  keyExtractor={(user) => user.id}
                  emptyMessage="לא נמצאו משתמשים"
                />
              </>
            )}
          </CardContent>
        </Card>

        {/* Modals */}
        <CreateUserModal
          open={isCreateModalOpen}
          onOpenChange={setIsCreateModalOpen}
        />
        
        <EditUserModal
          user={editUser}
          open={!!editUser}
          onOpenChange={(open) => !open && setEditUser(null)}
        />
        
        <DeleteUserDialog
          user={deleteUser}
          open={!!deleteUser}
          onOpenChange={(open) => !open && setDeleteUser(null)}
        />
        
        <UserEnrollmentSheet
          userId={enrollmentUser?.id || null}
          userName={enrollmentUser?.name || ""}
          open={!!enrollmentUser}
          onOpenChange={(open) => !open && setEnrollmentUser(null)}
        />

        <CoachDetailsSheet
          coachId={coachDetails?.id || null}
          coachName={coachDetails?.name || ""}
          open={!!coachDetails}
          onOpenChange={(open) => !open && setCoachDetails(null)}
        />
      </div>
    </TooltipProvider>
  );
}
