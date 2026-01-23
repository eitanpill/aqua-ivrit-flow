import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings as SettingsIcon, Users, Building2, CreditCard, Webhook } from "lucide-react";
import { UserManagement } from "@/components/settings/UserManagement";
import { SchoolProfile } from "@/components/settings/SchoolProfile";
import { PaymentSettings } from "@/components/settings/PaymentSettings";
import { WebhookSettings } from "@/components/settings/WebhookSettings";
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
        <TabsList>
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
          <TabsTrigger value="general" className="gap-2">
            <SettingsIcon className="h-4 w-4" />
            הגדרות כלליות
          </TabsTrigger>
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

        <TabsContent value="general">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SettingsIcon className="h-5 w-5 text-primary" />
                הגדרות כלליות
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <SettingsIcon className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">דף זה יפותח בחלק הבא</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}