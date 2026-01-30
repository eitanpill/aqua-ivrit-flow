import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Building2, CreditCard, Webhook, Shield, Trash2, Settings as SettingsIcon } from "lucide-react";
import { UserManagement } from "@/components/settings/UserManagement";
import { SchoolProfile } from "@/components/settings/SchoolProfile";
import { PaymentSettings } from "@/components/settings/PaymentSettings";
import { WebhookSettings } from "@/components/settings/WebhookSettings";
import { AuditLogViewer } from "@/components/settings/AuditLogViewer";
import { DeletedItemsManager } from "@/components/settings/DeletedItemsManager";
import { SystemPoliciesEditor } from "@/components/settings/SystemPoliciesEditor";
import { useAuth } from "@/hooks/useAuth";

export default function Settings() {
  const { isAdmin } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">הגדרות</h1>
        <p className="text-muted-foreground mt-1">הגדרות המערכת ובית הספר</p>
      </div>

      <Tabs defaultValue="school" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="school" className="gap-2">
            <Building2 className="h-4 w-4" />
            פרופיל בית הספר
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              ניהול משתמשים
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="payments" className="gap-2">
              <CreditCard className="h-4 w-4" />
              תשלומים
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="integrations" className="gap-2">
              <Webhook className="h-4 w-4" />
              אינטגרציות
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="audit" className="gap-2">
              <Shield className="h-4 w-4" />
              יומן ביקורת
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="deleted" className="gap-2">
              <Trash2 className="h-4 w-4" />
              פריטים מחוקים
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="policies" className="gap-2">
              <SettingsIcon className="h-4 w-4" />
              מדיניות מערכת
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="school">
          <SchoolProfile />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="users">
            <UserManagement />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="payments">
            <PaymentSettings />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="integrations">
            <WebhookSettings />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="audit">
            <AuditLogViewer />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="deleted">
            <DeletedItemsManager />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="policies">
            <SystemPoliciesEditor />
          </TabsContent>
        )}

      </Tabs>
    </div>
  );
}