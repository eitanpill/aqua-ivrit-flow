import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { Loader2, Webhook, Send, CheckCircle2, XCircle, ExternalLink } from "lucide-react";

export function WebhookSettings() {
  const { user } = useAuth();
  const { activeSchoolId } = useSchool();
  const queryClient = useQueryClient();
  const [webhookUrl, setWebhookUrl] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    generatedText?: string;
  } | null>(null);

  const schoolIdToUse = activeSchoolId;

  // Fetch current webhook configuration
  const { data: school, isLoading } = useQuery({
    queryKey: ["school-webhook", schoolIdToUse],
    queryFn: async () => {
      if (!schoolIdToUse) return null;
      const { data, error } = await supabase
        .from("schools")
        .select("id, name, notification_webhook_url")
        .eq("id", schoolIdToUse)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!schoolIdToUse,
  });

  // Update local state when school data is loaded
  useState(() => {
    if (school?.notification_webhook_url) {
      setWebhookUrl(school.notification_webhook_url);
    }
  });

  // Save webhook URL mutation
  const saveWebhookMutation = useMutation({
    mutationFn: async (url: string) => {
      if (!schoolIdToUse) throw new Error("לא נבחר בית ספר");

      const { error } = await supabase
        .from("schools")
        .update({ notification_webhook_url: url || null })
        .eq("id", schoolIdToUse);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["school-webhook", schoolIdToUse] });
      toast({
        title: "הגדרות נשמרו",
        description: "כתובת הוובהוק עודכנה בהצלחה",
      });
    },
    onError: (error) => {
      toast({
        title: "שגיאה בשמירה",
        description: error instanceof Error ? error.message : "שגיאה לא ידועה",
        variant: "destructive",
      });
    },
  });

  // Test webhook
  const handleTestWebhook = async () => {
    if (!webhookUrl) {
      toast({
        title: "שגיאה",
        description: "יש להזין כתובת וובהוק לפני הבדיקה",
        variant: "destructive",
      });
      return;
    }

    // First save the URL if it changed
    if (webhookUrl !== school?.notification_webhook_url) {
      await saveWebhookMutation.mutateAsync(webhookUrl);
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("dispatch-notification", {
        body: {
          event_type: "test_notification",
          data: {
            parent_name: "הורה לדוגמה",
            parent_phone: "050-1234567",
            child_name: "ילד לדוגמה",
            class_time: "יום ראשון 16:00",
            coach_name: "מאמן לדוגמה",
            class_type: "שחייה למתחילים",
            location: "בריכה ראשית",
          },
          school_id: schoolIdToUse,
          is_test: true,
        },
      });

      if (error) throw error;

      if (data?.success) {
        setTestResult({
          success: true,
          message: "הבדיקה הצליחה! הוובהוק קיבל את ההודעה",
          generatedText: data.generated_message,
        });
        toast({
          title: "בדיקה הצליחה! ✅",
          description: "ההודעה נשלחה לוובהוק בהצלחה",
        });
      } else {
        setTestResult({
          success: false,
          message: data?.error || "שגיאה לא ידועה",
          generatedText: data?.generated_message,
        });
        toast({
          title: "הבדיקה נכשלה",
          description: data?.error || "שגיאה בשליחת הוובהוק",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Test webhook error:", error);
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : "שגיאה לא ידועה",
      });
      toast({
        title: "שגיאה בבדיקה",
        description: error instanceof Error ? error.message : "שגיאה לא ידועה",
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!schoolIdToUse) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          לא נבחר בית ספר
        </CardContent>
      </Card>
    );
  }

  const hasWebhook = !!school?.notification_webhook_url;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Webhook className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>הגדרות וובהוק להודעות</CardTitle>
                <CardDescription>
                  חבר את המערכת לשירותי אוטומציה כמו Make או n8n
                </CardDescription>
              </div>
            </div>
            <Badge variant={hasWebhook ? "default" : "secondary"}>
              {hasWebhook ? "מוגדר" : "לא מוגדר"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Webhook URL Input */}
          <div className="space-y-2">
            <Label htmlFor="webhook-url">כתובת וובהוק להודעות</Label>
            <Input
              id="webhook-url"
              type="url"
              placeholder="https://hook.make.com/... או https://n8n.your-domain.com/webhook/..."
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              dir="ltr"
              className="text-left font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              הזן את כתובת ה-Webhook מ-Make, n8n, או כל שירות אוטומציה אחר
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={() => saveWebhookMutation.mutate(webhookUrl)}
              disabled={saveWebhookMutation.isPending}
            >
              {saveWebhookMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              ) : null}
              שמור
            </Button>
            <Button
              variant="outline"
              onClick={handleTestWebhook}
              disabled={isTesting || !webhookUrl}
            >
              {isTesting ? (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              ) : (
                <Send className="h-4 w-4 ml-2" />
              )}
              שלח טסט
            </Button>
          </div>

          {/* Test Result */}
          {testResult && (
            <>
              <Separator />
              <div
                className={`p-4 rounded-lg border ${
                  testResult.success
                    ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800"
                    : "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800"
                }`}
              >
                <div className="flex items-start gap-3">
                  {testResult.success ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  )}
                  <div className="flex-1 space-y-2">
                    <p
                      className={`font-medium ${
                        testResult.success ? "text-green-800 dark:text-green-200" : "text-red-800 dark:text-red-200"
                      }`}
                    >
                      {testResult.message}
                    </p>
                    {testResult.generatedText && (
                      <div className="mt-3 p-3 bg-background rounded border">
                        <p className="text-xs text-muted-foreground mb-1">הודעה שנוצרה:</p>
                        <p className="text-sm whitespace-pre-wrap">{testResult.generatedText}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Supported Events Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">אירועים נתמכים</CardTitle>
          <CardDescription>
            המערכת תשלח הודעות מותאמות אישית עבור האירועים הבאים
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { event: "class_cancelled", label: "ביטול שיעור", description: "כשמאמן או מנהל מבטל שיעור" },
              { event: "new_registration", label: "רישום חדש", description: "כששחיין נרשם לשיעור" },
              { event: "waitlist_spot_available", label: "מקום התפנה", description: "כשמקום מתפנה מרשימת ההמתנה" },
              { event: "session_reminder", label: "תזכורת לשיעור", description: "תזכורת אוטומטית לפני שיעור" },
              { event: "makeup_class_available", label: "שיעור השלמה", description: "כששיעור השלמה זמין" },
              { event: "payment_due", label: "תזכורת תשלום", description: "תזכורת על תשלום ממתין" },
            ].map((item) => (
              <div
                key={item.event}
                className="p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-xs font-mono">
                    {item.event}
                  </Badge>
                </div>
                <p className="font-medium text-sm">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Integration Help Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">איך לחבר?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                1
              </div>
              <div>
                <p className="font-medium">צור סצנריו ב-Make או Workflow ב-n8n</p>
                <p className="text-sm text-muted-foreground">
                  הוסף טריגר מסוג Webhook וקבל את כתובת ה-URL
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                2
              </div>
              <div>
                <p className="font-medium">הדבק את הכתובת למעלה</p>
                <p className="text-sm text-muted-foreground">
                  שמור את ההגדרות ולחץ על "שלח טסט" לבדיקה
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                3
              </div>
              <div>
                <p className="font-medium">עבד את הנתונים בסצנריו</p>
                <p className="text-sm text-muted-foreground">
                  שלח הודעת WhatsApp, SMS, או כל פעולה אחרת
                </p>
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex gap-3">
            <Button variant="outline" size="sm" asChild>
              <a
                href="https://www.make.com/en/help/tools/webhooks"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 ml-2" />
                מדריך Make
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a
                href="https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 ml-2" />
                מדריך n8n
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
