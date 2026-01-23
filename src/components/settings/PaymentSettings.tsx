import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, CreditCard, Eye, EyeOff, Trash2, Plus, Shield, AlertCircle, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSchool } from "@/contexts/SchoolContext";
import { useDemoMode } from "@/hooks/useDemoMode";
import {
  getPaymentConfigs,
  upsertPaymentConfig,
  deletePaymentConfig,
  getProviderDisplayName,
  type PaymentProvider,
  type PaymentConfig
} from "@/lib/paymentService";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

const PROVIDERS: { value: PaymentProvider; label: string }[] = [
  { value: 'stripe', label: 'Stripe' },
  { value: 'tranzila', label: 'Tranzila' },
  { value: 'cardcom', label: 'CardCom' },
  { value: 'generic', label: 'כללי / אחר' },
];

export function PaymentSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentSchool, isSuperAdmin } = useSchool();
  const { isDemoMode, blockDemoAction } = useDemoMode();
  
  const [showForm, setShowForm] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider>('stripe');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const schoolId = currentSchool?.id;

  const { data: configs, isLoading } = useQuery({
    queryKey: ['payment-configs', schoolId],
    queryFn: () => getPaymentConfigs(schoolId!),
    enabled: !!schoolId,
  });

  const activeConfig = configs?.find(c => c.is_active);

  const deleteMutation = useMutation({
    mutationFn: deletePaymentConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-configs', schoolId] });
      toast({
        title: "הוסר בהצלחה",
        description: "הגדרות התשלום נמחקו",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "שגיאה",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!schoolId) {
      toast({
        title: "שגיאה",
        description: "לא נמצא בית ספר פעיל",
        variant: "destructive",
      });
      return;
    }

    if (!apiKey.trim()) {
      toast({
        title: "שגיאה",
        description: "יש להזין מפתח API",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const result = await upsertPaymentConfig(
        schoolId,
        selectedProvider,
        apiKey.trim(),
        apiSecret.trim() || undefined
      );

      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['payment-configs', schoolId] });
        toast({
          title: "נשמר בהצלחה",
          description: `ספק התשלומים ${getProviderDisplayName(selectedProvider)} הוגדר בהצלחה`,
        });
        setShowForm(false);
        setApiKey('');
        setApiSecret('');
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast({
        title: "שגיאה",
        description: error instanceof Error ? error.message : "שגיאה בשמירת ההגדרות",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" />
          הגדרות תשלומים
        </CardTitle>
        <CardDescription>
          הגדר את ספק התשלומים לבית הספר שלך
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Demo Mode Warning */}
        {isDemoMode && (
          <Alert variant="destructive" className="bg-destructive/10 border-destructive/30">
            <Lock className="h-4 w-4" />
            <AlertDescription>
              מצב הדגמה - לא ניתן לבצע שינויים בהגדרות התשלומים. פעולות כתיבה חסומות ברמת בסיס הנתונים.
            </AlertDescription>
          </Alert>
        )}

        {/* Security Notice */}
        <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg border border-border/50">
          <Shield className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-foreground">אחסון מאובטח</p>
            <p className="text-muted-foreground">
              מפתחות ה-API נשמרים בצורה מוצפנת. לא ניתן לצפות במפתחות המלאים לאחר השמירה - רק ב-4 הספרות האחרונות.
            </p>
          </div>
        </div>

        {/* Active Provider Status */}
        {activeConfig && (
          <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-3">
              <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                פעיל
              </Badge>
              <span className="font-medium">
                {getProviderDisplayName(activeConfig.provider_name as PaymentProvider)}
              </span>
              <span className="text-sm text-muted-foreground">
                ({activeConfig.api_key_masked})
              </span>
            </div>
          </div>
        )}

        {/* Existing Configurations */}
        {configs && configs.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">ספקים מוגדרים</h4>
            <div className="space-y-2">
              {configs.map((config) => (
                <div
                  key={config.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    config.is_active 
                      ? 'border-primary/50 bg-primary/5' 
                      : 'border-border bg-muted/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {getProviderDisplayName(config.provider_name as PaymentProvider)}
                    </span>
                    <code className="text-xs bg-muted px-2 py-0.5 rounded">
                      {config.api_key_masked}
                    </code>
                    {config.has_secret && (
                      <Badge variant="outline" className="text-xs">
                        כולל Secret
                      </Badge>
                    )}
                    {config.is_active && (
                      <Badge variant="default" className="bg-green-600">פעיל</Badge>
                    )}
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-destructive hover:text-destructive"
                        disabled={isDemoMode}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>מחיקת ספק תשלומים</AlertDialogTitle>
                        <AlertDialogDescription>
                          האם אתה בטוח שברצונך למחוק את {getProviderDisplayName(config.provider_name as PaymentProvider)}?
                          פעולה זו לא ניתנת לביטול.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>ביטול</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteMutation.mutate(config.id)}
                          className="bg-destructive hover:bg-destructive/90"
                        >
                          מחק
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No Config Warning */}
        {(!configs || configs.length === 0) && !showForm && (
          <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-foreground">לא הוגדר ספק תשלומים</p>
              <p className="text-muted-foreground">
                הוסף ספק תשלומים כדי לאפשר גביית תשלומים מלקוחות.
              </p>
            </div>
          </div>
        )}

        {/* Add New Form */}
        {showForm ? (
          <form onSubmit={handleSubmit} className="space-y-4 border-t pt-4">
            <h4 className="font-medium">הוסף/עדכן ספק תשלומים</h4>
            
            <div className="space-y-2">
              <Label htmlFor="provider">ספק תשלומים</Label>
              <Select
                value={selectedProvider}
                onValueChange={(v) => setSelectedProvider(v as PaymentProvider)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="בחר ספק" />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiKey">מפתח API (Public Key)</Label>
              <Input
                id="apiKey"
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="pk_live_..."
                className="font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiSecret">מפתח סודי (Secret Key) - אופציונלי</Label>
              <div className="relative">
                <Input
                  id="apiSecret"
                  type={showSecret ? "text" : "password"}
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  placeholder="sk_live_..."
                  className="font-mono text-sm pe-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute end-0 top-0"
                  onClick={() => setShowSecret(!showSecret)}
                >
                  {showSecret ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 animate-spin me-2" />}
                שמור הגדרות
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  setApiKey('');
                  setApiSecret('');
                }}
              >
                ביטול
              </Button>
            </div>
          </form>
        ) : (
          <Button 
            onClick={() => {
              if (blockDemoAction('הוספת ספק תשלומים')) return;
              setShowForm(true);
            }} 
            variant="outline" 
            className="gap-2"
            disabled={isDemoMode}
          >
            <Plus className="h-4 w-4" />
            הוסף ספק תשלומים
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
