import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Waves, CreditCard, RefreshCw, Loader2, CheckCircle2, ExternalLink } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const SUBSCRIPTION_PAYMENT_LINK = "https://mrng.to/3Q95CZQDbV";

export default function SubscriptionRequired() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [isChecking, setIsChecking] = useState(false);
  const [isPaid, setIsPaid] = useState(false);

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
      }
    } catch (error) {
      console.error("Error checking payment:", error);
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

  const handlePaymentClick = () => {
    window.open(SUBSCRIPTION_PAYMENT_LINK, "_blank");
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
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <h3 className="font-semibold text-center">מה כולל המינוי?</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                <span>גישה מלאה למערכת ניהול בתי ספר לשחייה</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                <span>ניהול שוחים, מאמנים ושיעורים</span>
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
          >
            <CreditCard className="ml-2 h-5 w-5" />
            מעבר להקמת הוראת קבע
            <ExternalLink className="mr-2 h-4 w-4" />
          </Button>

          <div className="text-center">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={checkPaymentStatus}
              disabled={isChecking}
              className="text-muted-foreground"
            >
              {isChecking ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  בודק סטטוס תשלום...
                </>
              ) : (
                <>
                  <RefreshCw className="ml-2 h-4 w-4" />
                  כבר שילמתי - בדוק שוב
                </>
              )}
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            לאחר השלמת התשלום, המערכת תזהה אוטומטית ותעביר אותך להקמת בית הספר
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
