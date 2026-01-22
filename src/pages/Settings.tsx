import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings as SettingsIcon, Users, Building } from "lucide-react";
import { UserManagement } from "@/components/settings/UserManagement";
import { useAuth } from "@/hooks/useAuth";

export default function Settings() {
  const { isAdmin } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">הגדרות</h1>
        <p className="text-muted-foreground mt-1">הגדרות המערכת</p>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          {isAdmin && (
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              ניהול משתמשים
            </TabsTrigger>
          )}
          <TabsTrigger value="general" className="gap-2">
            <SettingsIcon className="h-4 w-4" />
            הגדרות כלליות
          </TabsTrigger>
          <TabsTrigger value="business" className="gap-2">
            <Building className="h-4 w-4" />
            פרטי העסק
          </TabsTrigger>
        </TabsList>

        {isAdmin && (
          <TabsContent value="users">
            <UserManagement />
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

        <TabsContent value="business">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5 text-primary" />
                פרטי העסק
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Building className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">דף זה יפותח בחלק הבא</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
