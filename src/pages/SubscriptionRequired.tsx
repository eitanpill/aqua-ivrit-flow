import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Waves, CreditCard, RefreshCw, Loader2, CheckCircle2, ExternalLink, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const SUBSCRIPTION_PAYMENT_LINK = "https://mrng.to/3Q95CZQDbV";

export default function SubscriptionRequired() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [isChecking, setIsChecking] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);
  const [paymentFailed, setPaymentFailed] = useState(false);
  const [checkEmail, setCheckEmail] = useState("");
  const [showEmailInput, setShowEmailInput] = useState(false);

  // Check for payment failure from redirect
  useEffect(() => {
    if (searchParams.get("payment") === "failed") {
      setPaymentFailed(true);
      toast({
        title: "התשלום לא הושלם",
        description: "נסה שוב או פנה לתמיכה",
        variant: "destructive",
      });
    }
  }, [searchParams, toast]);

  // Check if user already has subscription_paid = true
  const checkPaymentStatus = async () => {
    if (!user) return;
    
    setIsChecking(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("subscription_paid, school_id")
        .eq("id", user.id)
        .single();
      
      if (error) {
        console.error("Error checking payment status:", error);
        setIsChecking(false);
        return;
      }

      if (data?.school_id) {
        // User already has a school, redirect to dashboard
        navigate("/dashboard", { replace: true });
        return;
      }

      if (data?.subscription_paid) {
        setIsPaid(true);
        // After a short delay, redirect to school setup
        setTimeout(() => {
          navigate("/auth/setup-school", { replace: true });
        }, 1500);
      } else {
        toast({
          title: "לא נמצא תשלום",
          description: "לא זוהה תשלום עבור החשבון שלך. נסה שוב לאחר השלמת התשלום.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error checking payment:", error);
    } finally {
      setIsChecking(false);
    }
  };

  // Check payment by email address
  const checkPaymentByEmail = async () => {
    if (!checkEmail.trim()) {
      toast({
        title: "נדרש אי-מייל",
        description: "אנא הזן את כתובת האי-מייל איתה ביצעת את התשלום",
        variant: "destructive",
      });
      return;
    }

    setIsChecking(true);
    try {
      // Check if there's a user with this email who has paid
      const { data: authUser } = await supabase.auth.getUser();
      const currentEmail = authUser?.user?.email?.toLowerCase();
      const searchEmail = checkEmail.trim().toLowerCase();

      // If searching for a different email than current user
      if (currentEmail !== searchEmail) {
        toast({
          title: "אי-מייל שונה",
          description: "האי-מייל שהזנת שונה מהחשבון המחובר. אם שילמת עם אי-מייל אחר, אנא התחבר עם אותו חשבון.",
          variant: "destructive",
        });
        setIsChecking(false);
        return;
      }

      // Check current user's payment status
      await checkPaymentStatus();
    } catch (error) {
      console.error("Error checking payment by email:", error);
      toast({
        title: "שגיאה בבדיקה",
        description: "אירעה שגיאה בבדיקת סטטוס התשלום. נסה שוב.",
        variant: "destructive",
      });
    } finally {
      setIsChecking(false);
    }
  };

  // Initial check and redirect logic
  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      navigate("/auth", { replace: true });
      return;
    }

    checkPaymentStatus();
  }, [user, authLoading, navigate]);

  // Poll for payment status every 10 seconds
  useEffect(() => {
    if (!user || isPaid) return;
    
    const interval = setInterval(() => {
      checkPaymentStatus();
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [user, isPaid]);

  const handlePaymentClick = async () => {
    if (!user) return;
    
    setIsCreatingPayment(true);
    
    try {
      // Try to generate a dynamic payment link with proper redirect
      const { data, error } = await supabase.functions.invoke('subscription-payment', {
        body: {
          user_id: user.id,
          user_email: user.email,
          user_name: user.user_metadata?.first_name || 'לקוח חדש',
        },
      });

      if (error || !data?.success) {
        console.warn("Dynamic payment failed, using fallback:", error || data?.error);
        // Fallback to static link
        window.open(SUBSCRIPTION_PAYMENT_LINK, "_blank");
      } else {
        // Redirect to dynamic payment URL
        window.location.href = data.paymentUrl;
      }
    } catch (error) {
      console.error("Payment initiation error:", error);
      // Fallback to static link
      window.open(SUBSCRIPTION_PAYMENT_LINK, "_blank");
    } finally {
      setIsCreatingPayment(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isPaid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-green-700 mb-2">התשלום התקבל בהצלחה!</h2>
            <p className="text-muted-foreground">מעביר אותך להקמת בית הספר...</p>
            <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mt-4" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl animate-float" />
        <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-accent/10 rounded-full blur-3xl animate-float" style={{ animationDelay: "1.5s" }} />
      </div>

      <Card className="w-full max-w-md relative z-10 shadow-xl border-border/50">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl gradient-primary aqua-glow">
            <Waves className="h-8 w-8 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">הקמת בית ספר חדש</CardTitle>
            <CardDescription className="mt-2">
              להמשך יש להקים הוראת קבע חודשית
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {paymentFailed && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>התשלום לא הושלם. אנא נסה שוב.</span>
            </div>
          )}
          
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <h3 className="font-semibold text-center">מה כולל המינוי?</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                <span>גישה מלאה למערכת ניהול בתי ספר לשחייה</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                <span>ניהול שחיינים, מאמנים ושיעורים</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                <span>לוח זמנים וניהול נוכחות</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                <span>מערכת חיובים ותשלומים</span>
              </li>
            </ul>
          </div>

          <Button 
            onClick={handlePaymentClick} 
            className="w-full gradient-primary h-12 text-lg"
            disabled={isCreatingPayment}
          >
            {isCreatingPayment ? (
              <>
                <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                מכין קישור תשלום...
              </>
            ) : (
              <>
                <CreditCard className="ml-2 h-5 w-5" />
                מעבר להקמת הוראת קבע
              </>
            )}
          </Button>

          <div className="text-center space-y-3">
            {!showEmailInput ? (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowEmailInput(true)}
                className="text-muted-foreground"
              >
                <RefreshCw className="ml-2 h-4 w-4" />
                כבר שילמתי - בדוק שוב
              </Button>
            ) : (
              <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  הזן את האי-מייל איתו ביצעת את התשלום:
                </p>
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={checkEmail}
                  onChange={(e) => setCheckEmail(e.target.value)}
                  className="text-center"
                  dir="ltr"
                />
                <div className="flex gap-2 justify-center">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      setShowEmailInput(false);
                      setCheckEmail("");
                    }}
                  >
                    ביטול
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={checkPaymentByEmail}
                    disabled={isChecking}
                  >
                    {isChecking ? (
                      <>
                        <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                        בודק...
                      </>
                    ) : (
                      "בדוק תשלום"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <p className="text-xs text-center text-muted-foreground">
            לאחר השלמת התשלום, המערכת תזהה אוטומטית ותעביר אותך להקמת בית הספר
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
