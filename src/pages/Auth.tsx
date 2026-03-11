import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Waves, Mail, Lock, User, Building2, AlertCircle, Play, ArrowLeft, Phone, MapPin } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DEMO_CREDENTIALS } from "@/hooks/useDemoMode";

const loginSchema = z.object({
  email: z.string().email("כתובת אימייל לא תקינה"),
  password: z.string().min(6, "הסיסמה חייבת להכיל לפחות 6 תווים"),
});

const signupSchema = loginSchema.extend({
  firstName: z.string().min(2, "שם פרטי חייב להכיל לפחות 2 תווים"),
  lastName: z.string().min(2, "שם משפחה חייב להכיל לפחות 2 תווים"),
});

const schoolOwnerSchema = signupSchema.extend({
  schoolName: z.string().min(2, "שם בית הספר חייב להכיל לפחות 2 תווים"),
});

interface SchoolInfo {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
}

type AuthView = 'landing' | 'login' | 'signup' | 'create-school' | 'reset-password';

export default function Auth() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const inviteSlug = searchParams.get("invite");
  const authType = searchParams.get("type"); // For password recovery
  
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [invitedSchool, setInvitedSchool] = useState<SchoolInfo | null>(null);
  const [isLoadingSchool, setIsLoadingSchool] = useState(!!inviteSlug);
  const [schoolNotFound, setSchoolNotFound] = useState(false);
  const [authView, setAuthView] = useState<AuthView>(
    authType === 'recovery' ? 'reset-password' : (inviteSlug ? 'signup' : 'landing')
  );
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [signupForm, setSignupForm] = useState({ 
    email: "", 
    password: "", 
    firstName: "", 
    lastName: "",
    schoolName: "",
    schoolPhone: "",
    schoolEmail: "",
    poolName: "",
    poolAddress: ""
  });

  // Handle password recovery from email link
  useEffect(() => {
    const handleHashParams = async () => {
      // Check for hash params (Supabase uses hash for recovery)
      const hash = window.location.hash;
      if (hash && hash.includes('type=recovery')) {
        // Supabase auto-processes the hash, we just need to detect it and show the form
        setAuthView('reset-password');
        
        // Wait for Supabase to process the token
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setHasRecoverySession(true);
        }
      }
    };
    
    handleHashParams();
    
    // Listen for PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setAuthView('reset-password');
        setHasRecoverySession(true);
      }
    });
    
    return () => subscription.unsubscribe();
  }, []);

  // Fetch invited school info
  useEffect(() => {
    if (inviteSlug) {
      const fetchSchool = async () => {
        setIsLoadingSchool(true);
        const { data, error } = await supabase.rpc('get_school_by_slug', { 
          p_slug: inviteSlug 
        });
        
        if (error || !data || typeof data !== 'object' || !('id' in data)) {
          setSchoolNotFound(true);
        } else {
          setInvitedSchool(data as unknown as SchoolInfo);
          setAuthView('signup');
        }
        setIsLoadingSchool(false);
      };
      fetchSchool();
    }
  }, [inviteSlug]);

  // Track if we're in the middle of signup to prevent redirect
  const [isSigningUp, setIsSigningUp] = useState(false);
  const isSigningUpRef = useRef(false);

  useEffect(() => {
    // Don't set up redirect listener if we're in the process of creating a school
    if (isSigningUp) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session && !isSigningUpRef.current) {
        // Check if user has a school before redirecting
        const { data: profile } = await supabase
          .from("profiles")
          .select("school_id")
          .eq("id", session.user.id)
          .single();
        
        if (profile?.school_id) {
          navigate("/dashboard");
        } else {
          // User exists but has no school - redirect to Welcome page
          navigate("/welcome");
        }
      }
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session && !isSigningUpRef.current) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("school_id")
          .eq("id", session.user.id)
          .single();
        
        if (profile?.school_id) {
          navigate("/dashboard");
        } else {
          // User exists but has no school - redirect to Welcome page
          navigate("/welcome");
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, isSigningUp]);

  const handleDemoMode = () => {
    // Navigate directly to demo mode - no login required
    navigate("/dashboard?demo=true");
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      // Redirect to /auth to properly handle the OAuth callback
      const { error } = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/auth`,
      });
      
      if (error) {
        toast({
          title: "שגיאה בהתחברות עם Google",
          description: error.message,
          variant: "destructive",
        });
        setIsGoogleLoading(false);
      }
      // Don't set loading to false on success - user will be redirected
    } catch (error: any) {
      toast({
        title: "שגיאה בהתחברות",
        description: error.message || "אירעה שגיאה בתהליך ההתחברות",
        variant: "destructive",
      });
      setIsGoogleLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = loginSchema.safeParse(loginForm);
    if (!result.success) {
      toast({
        title: "שגיאה",
        description: result.error.errors[0].message,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: loginForm.email,
      password: loginForm.password,
    });

    if (error) {
      toast({
        title: "שגיאת כניסה",
        description: error.message === "Invalid login credentials" 
          ? "אימייל או סיסמה שגויים" 
          : error.message,
        variant: "destructive",
      });
    } else {
      // Login successful - navigate will happen via auth state change
      navigate("/dashboard");
    }
    setIsLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // For create-school flow, validate all fields including school name
    const schema = authView === 'create-school' && !invitedSchool 
      ? schoolOwnerSchema 
      : signupSchema;
    const result = schema.safeParse(signupForm);
    
    if (!result.success) {
      toast({
        title: "שגיאה",
        description: result.error.errors[0].message,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setIsSigningUp(true); // Prevent automatic redirect during signup
    isSigningUpRef.current = true;

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: signupForm.email,
        password: signupForm.password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: {
            first_name: signupForm.firstName,
            last_name: signupForm.lastName,
          },
        },
      });

      if (authError) {
        toast({
          title: "שגיאת הרשמה",
          description: authError.message === "User already registered"
            ? "משתמש עם אימייל זה כבר קיים במערכת"
            : authError.message,
          variant: "destructive",
        });
        setIsLoading(false);
        setIsSigningUp(false);
        isSigningUpRef.current = false;
        return;
      }

      if (!authData.user) {
        toast({
          title: "שגיאה",
          description: "אירעה שגיאה ביצירת המשתמש",
          variant: "destructive",
        });
        setIsLoading(false);
        setIsSigningUp(false);
        return;
      }

      // Wait a moment for session to be established
      await new Promise(resolve => setTimeout(resolve, 500));

      // If joining via invite link, handle that flow
      if (inviteSlug) {
        const { data: joinResult, error: joinError } = await supabase.rpc(
          'join_school_by_slug',
          {
            p_user_id: authData.user!.id,
            p_school_slug: inviteSlug,
          }
        );

        if (joinError || !(joinResult as any)?.success) {
          console.error('Join school error:', joinError || joinResult);
          toast({
            title: "שגיאה בהצטרפות לבית הספר",
            description: (joinResult as any)?.error || joinError?.message || "נסה שוב",
            variant: "destructive",
          });
        } else {
          toast({
            title: "נרשמת בהצלחה!",
            description: `הצטרפת לבית הספר "${(joinResult as any).school_name}"`,
          });
          navigate("/dashboard", { replace: true });
          return;
        }
      }

      // For create-school flow, create the school immediately with all details
      if (authView === 'create-school' && signupForm.schoolName) {
        const { data: schoolId, error: schoolError } = await supabase.rpc(
          'create_school_and_owner' as any,
          {
            p_school_name: signupForm.schoolName,
            p_owner_first_name: signupForm.firstName,
            p_owner_last_name: signupForm.lastName,
            p_school_phone: signupForm.schoolPhone || null,
            p_school_email: signupForm.schoolEmail || null,
            p_pool_name: signupForm.poolName || null,
            p_pool_address: signupForm.poolAddress || null,
          }
        );

        if (schoolError) {
          console.error('Create school error:', schoolError);
          toast({
            title: "שגיאה ביצירת בית הספר",
            description: schoolError.message || "נסה שוב",
            variant: "destructive",
          });
          // Still redirect to welcome page as fallback
          navigate("/welcome", { replace: true });
          return;
        }

        toast({
          title: "בית הספר נוצר בהצלחה! 🎉",
          description: `ברוכים הבאים ל-${signupForm.schoolName}`,
        });
        navigate("/dashboard", { replace: true });
        return;
      }

      // Fallback - redirect to Welcome page
      toast({
        title: "נרשמת בהצלחה! 🎉",
        description: "בואו נגדיר את החשבון שלך",
      });
      navigate("/welcome", { replace: true });
      
    } catch (error: any) {
      console.error('Signup error:', error);
      toast({
        title: "שגיאה",
        description: error.message || "אירעה שגיאה בתהליך ההרשמה",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setIsSigningUp(false);
    }
  };

  if (isLoadingSchool) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Waves className="h-12 w-12 text-primary mx-auto animate-pulse" />
          <p className="mt-4 text-muted-foreground">מאמת קישור הזמנה...</p>
        </div>
      </div>
    );
  }

  if (schoolNotFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <CardTitle className="text-xl mt-4">קישור הזמנה לא תקין</CardTitle>
            <CardDescription>
              בית הספר לא נמצא. ייתכן שהקישור פג תוקף או שהכתובת שגויה.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full" 
              onClick={() => {
                setSchoolNotFound(false);
                setAuthView('landing');
                navigate("/auth");
              }}
            >
              חזרה לדף הראשי
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Landing Page with Split View
  if (authView === 'landing') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
          <div className="absolute -top-40 -left-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl animate-float" />
          <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-accent/10 rounded-full blur-3xl animate-float" style={{ animationDelay: "1.5s" }} />
        </div>

        <div className="w-full max-w-lg relative z-10 space-y-6">
          {/* Logo & Title */}
          <div className="text-center space-y-4">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl gradient-primary aqua-glow">
              <Waves className="h-10 w-10 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">AquaFlow</h1>
              <p className="text-muted-foreground mt-1">מערכת ניהול בית ספר לשחייה</p>
            </div>
          </div>

          {/* Action Cards */}
          <div className="space-y-4">
            {/* Primary - Create School */}
            <Card 
              className="cursor-pointer transition-all hover:shadow-lg hover:border-primary/50 border-2"
              onClick={() => setAuthView('create-school')}
            >
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-xl gradient-primary flex items-center justify-center shrink-0">
                    <Building2 className="h-7 w-7 text-primary-foreground" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">אני רוצה להקים בית ספר</h3>
                    <p className="text-sm text-muted-foreground">צור בית ספר לשחייה משלך ונהל אותו</p>
                  </div>
                  <ArrowLeft className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            {/* Secondary - Demo Mode */}
            <Card 
              className="cursor-pointer transition-all hover:shadow-lg hover:border-amber-500/50 border-2 border-dashed"
              onClick={handleDemoMode}
            >
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shrink-0">
                    <Play className="h-7 w-7 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">סיור במערכת הדגמה</h3>
                    <p className="text-sm text-muted-foreground">צפה בגרסת דמו עם נתונים לדוגמה - ללא הרשמה</p>
                  </div>
                  <ArrowLeft className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Existing User Link */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              כבר יש לך חשבון?{" "}
              <button 
                className="text-primary hover:underline font-medium"
                onClick={() => setAuthView('login')}
              >
                התחבר
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Login View
  if (authView === 'login') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        </div>

        <Card className="w-full max-w-md relative z-10 shadow-xl border-border/50">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl gradient-primary aqua-glow">
              <Waves className="h-8 w-8 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">התחברות</CardTitle>
              <CardDescription>הזן את פרטי החשבון שלך</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">אימייל</Label>
                <div className="relative">
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="your@email.com"
                    className="pr-10"
                    value={loginForm.email}
                    onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                    dir="ltr"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">סיסמה</Label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    className="pr-10"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    dir="ltr"
                  />
                </div>
              </div>
              <Button type="submit" className="w-full gradient-primary" disabled={isLoading}>
                {isLoading ? "מתחבר..." : "התחבר"}
              </Button>
            </form>
            
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">או</span>
              </div>
            </div>
            
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogleSignIn}
              disabled={isGoogleLoading}
            >
              {isGoogleLoading ? (
                "מתחבר..."
              ) : (
                <>
                  <svg className="ml-2 h-4 w-4" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  המשך עם Google
                </>
              )}
            </Button>
            
            <div className="mt-4 space-y-2 text-center">
              <button 
                className="text-sm text-primary hover:underline font-medium block w-full"
                onClick={async () => {
                  if (!loginForm.email) {
                    toast({
                      title: "שגיאה",
                      description: "יש להזין כתובת אימייל",
                      variant: "destructive",
                    });
                    return;
                  }
                  setIsLoading(true);
                  const { error } = await supabase.auth.resetPasswordForEmail(loginForm.email, {
                    redirectTo: `${window.location.origin}/auth`,
                  });
                  setIsLoading(false);
                  if (error) {
                    toast({
                      title: "שגיאה",
                      description: error.message,
                      variant: "destructive",
                    });
                  } else {
                    toast({
                      title: "נשלח בהצלחה",
                      description: "מייל לשחזור סיסמה נשלח לכתובת שהזנת",
                    });
                  }
                }}
                disabled={isLoading}
              >
                שכחתי סיסמה
              </button>
              <button 
                className="text-sm text-muted-foreground hover:text-primary"
                onClick={() => setAuthView('landing')}
              >
                ← חזרה לדף הראשי
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Password Reset View
  if (authView === 'reset-password') {
    const handleResetPassword = async (e: React.FormEvent) => {
      e.preventDefault();
      
      if (newPassword.length < 6) {
        toast({
          title: "שגיאה",
          description: "הסיסמה חייבת להכיל לפחות 6 תווים",
          variant: "destructive",
        });
        return;
      }
      
      if (newPassword !== confirmPassword) {
        toast({
          title: "שגיאה",
          description: "הסיסמאות אינן תואמות",
          variant: "destructive",
        });
        return;
      }
      
      setIsLoading(true);
      
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      
      setIsLoading(false);
      
      if (error) {
        toast({
          title: "שגיאה",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "הסיסמה עודכנה בהצלחה!",
          description: "כעת תוכל להתחבר עם הסיסמה החדשה",
        });
        navigate("/dashboard");
      }
    };
    
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        </div>

        <Card className="w-full max-w-md relative z-10 shadow-xl border-border/50">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl gradient-primary aqua-glow">
              <Lock className="h-8 w-8 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">איפוס סיסמה</CardTitle>
              <CardDescription>הזן סיסמה חדשה לחשבונך</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">סיסמה חדשה</Label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="••••••••"
                    className="pr-10"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    dir="ltr"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">אימות סיסמה</Label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="••••••••"
                    className="pr-10"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    dir="ltr"
                  />
                </div>
              </div>
              <Button type="submit" className="w-full gradient-primary" disabled={isLoading}>
                {isLoading ? "מעדכן..." : "עדכן סיסמה"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Create School / Signup View
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 py-8">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
      </div>

      <Card className="w-full max-w-lg relative z-10 shadow-xl border-border/50">
        <CardHeader className="text-center space-y-4 pb-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl gradient-primary aqua-glow">
            <Waves className="h-8 w-8 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">
              {invitedSchool ? "הצטרפות לבית ספר" : "הקמת בית ספר לשחייה"}
            </CardTitle>
            {invitedSchool ? (
              <CardDescription>
                הצטרפות לבית הספר: <span className="font-semibold text-foreground">{invitedSchool.name}</span>
              </CardDescription>
            ) : (
              <CardDescription>מלא את הפרטים כדי להתחיל לנהל את בית הספר שלך</CardDescription>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleSignup} className="space-y-4">
            {/* Personal Details Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <User className="h-4 w-4" />
                פרטים אישיים
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="signup-firstname">שם פרטי</Label>
                  <Input
                    id="signup-firstname"
                    type="text"
                    placeholder="ישראל"
                    value={signupForm.firstName}
                    onChange={(e) => setSignupForm({ ...signupForm, firstName: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-lastname">שם משפחה</Label>
                  <Input
                    id="signup-lastname"
                    type="text"
                    placeholder="ישראלי"
                    value={signupForm.lastName}
                    onChange={(e) => setSignupForm({ ...signupForm, lastName: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="signup-email">אימייל</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="your@email.com"
                    value={signupForm.email}
                    onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })}
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-password">סיסמה</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="••••••••"
                    value={signupForm.password}
                    onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
                    dir="ltr"
                  />
                </div>
              </div>
            </div>

            {/* School Details Section - Only for create-school flow */}
            {!invitedSchool && authView === 'create-school' && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    פרטי בית הספר
                  </h3>
                  <div className="space-y-1.5">
                    <Label htmlFor="school-name">שם בית הספר לשחייה *</Label>
                    <Input
                      id="school-name"
                      type="text"
                      placeholder='לדוגמה: "בית הספר לשחייה אקווה"'
                      value={signupForm.schoolName}
                      onChange={(e) => setSignupForm({ ...signupForm, schoolName: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="school-phone">טלפון בית הספר</Label>
                      <Input
                        id="school-phone"
                        type="tel"
                        placeholder="03-1234567"
                        value={signupForm.schoolPhone}
                        onChange={(e) => setSignupForm({ ...signupForm, schoolPhone: e.target.value })}
                        dir="ltr"
                        className="text-right"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="school-email">אימייל בית הספר</Label>
                      <Input
                        id="school-email"
                        type="email"
                        placeholder="info@school.co.il"
                        value={signupForm.schoolEmail}
                        onChange={(e) => setSignupForm({ ...signupForm, schoolEmail: e.target.value })}
                        dir="ltr"
                      />
                    </div>
                  </div>
                </div>

                <Separator />
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Waves className="h-4 w-4" />
                    פרטי הבריכה
                  </h3>
                  <div className="space-y-1.5">
                    <Label htmlFor="pool-name">שם הבריכה / המתקן</Label>
                    <Input
                      id="pool-name"
                      type="text"
                      placeholder='לדוגמה: "בריכת השחייה העירונית"'
                      value={signupForm.poolName}
                      onChange={(e) => setSignupForm({ ...signupForm, poolName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pool-address">כתובת</Label>
                    <div className="relative">
                      <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="pool-address"
                        type="text"
                        placeholder="רחוב, עיר"
                        className="pr-10"
                        value={signupForm.poolAddress}
                        onChange={(e) => setSignupForm({ ...signupForm, poolAddress: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            <Button 
              type="submit" 
              className="w-full gradient-primary" 
              disabled={isLoading}
            >
              {isLoading ? "נרשם..." : invitedSchool ? "הצטרף לבית הספר" : "הירשם והמשך"}
            </Button>
          </form>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">או</span>
            </div>
          </div>
          
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading}
          >
            {isGoogleLoading ? (
              "מתחבר..."
            ) : (
              <>
                <svg className="ml-2 h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                המשך עם Google
              </>
            )}
          </Button>
          
          <div className="text-center space-y-2">
            <button 
              className="text-sm text-muted-foreground hover:text-primary"
              onClick={() => setAuthView('landing')}
            >
              ← חזרה לדף הראשי
            </button>
            <p className="text-sm text-muted-foreground">
              כבר יש לך חשבון?{" "}
              <button 
                className="text-primary hover:underline font-medium"
                onClick={() => setAuthView('login')}
              >
                התחבר
              </button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
