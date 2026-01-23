import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Waves, Mail, Lock, User, Building2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";

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

export default function Auth() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const inviteSlug = searchParams.get("invite");
  
  const [isLoading, setIsLoading] = useState(false);
  const [invitedSchool, setInvitedSchool] = useState<SchoolInfo | null>(null);
  const [isLoadingSchool, setIsLoadingSchool] = useState(!!inviteSlug);
  const [schoolNotFound, setSchoolNotFound] = useState(false);
  const [isCreatingSchool, setIsCreatingSchool] = useState(false);
  
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [signupForm, setSignupForm] = useState({ 
    email: "", 
    password: "", 
    firstName: "", 
    lastName: "",
    schoolName: ""
  });

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
        }
        setIsLoadingSchool(false);
      };
      fetchSchool();
    }
  }, [inviteSlug]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate("/dashboard");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

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
    }
    setIsLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate based on mode
    const schema = isCreatingSchool ? schoolOwnerSchema : signupSchema;
    const result = schema.safeParse(signupForm);
    
    if (!result.success) {
      toast({
        title: "שגיאה",
        description: result.error.errors[0].message,
        variant: "destructive",
      });
      return;
    }

    // Check: Must have invite OR create school mode
    if (!inviteSlug && !isCreatingSchool) {
      toast({
        title: "שגיאה",
        description: "יש להירשם דרך קישור הזמנה או לבחור באפשרות פתיחת בית ספר חדש",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    const redirectUrl = `${window.location.origin}/`;

    // Step 1: Create user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: signupForm.email,
      password: signupForm.password,
      options: {
        emailRedirectTo: redirectUrl,
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
      return;
    }

    if (!authData.user) {
      toast({
        title: "שגיאה",
        description: "אירעה שגיאה ביצירת המשתמש",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    // Step 2: Handle school association
    // Use setTimeout to avoid auth deadlock
    setTimeout(async () => {
      if (isCreatingSchool) {
        // Flow A: Create new school
        const { data: schoolResult, error: schoolError } = await supabase.rpc(
          'create_school_for_owner',
          {
            p_user_id: authData.user!.id,
            p_school_name: signupForm.schoolName,
            p_email: signupForm.email,
          }
        );

        if (schoolError || !(schoolResult as any)?.success) {
          console.error('School creation error:', schoolError || schoolResult);
          toast({
            title: "שגיאה ביצירת בית הספר",
            description: (schoolResult as any)?.error || schoolError?.message || "נסה שוב",
            variant: "destructive",
          });
        } else {
          toast({
            title: "נרשמת בהצלחה!",
            description: `בית הספר "${signupForm.schoolName}" נוצר בהצלחה`,
          });
        }
      } else if (inviteSlug) {
        // Flow B: Join existing school
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
        }
      }
      setIsLoading(false);
    }, 100);
  };

  // Loading state for invite verification
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

  // Error state for invalid invite
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
              onClick={() => navigate("/auth")}
            >
              חזרה לדף ההרשמה
            </Button>
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

      <Card className="w-full max-w-md relative z-10 shadow-xl border-border/50 backdrop-blur-sm">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl gradient-primary aqua-glow">
            <Waves className="h-8 w-8 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">AquaFlow</CardTitle>
            {invitedSchool ? (
              <CardDescription className="text-base">
                הצטרפות לבית הספר: <span className="font-semibold text-foreground">{invitedSchool.name}</span>
              </CardDescription>
            ) : (
              <CardDescription>מערכת ניהול בית ספר לשחייה</CardDescription>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={invitedSchool ? "signup" : "login"} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">כניסה</TabsTrigger>
              <TabsTrigger value="signup">הרשמה</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
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
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                {/* Show invite info or school creation toggle */}
                {invitedSchool ? (
                  <Alert className="bg-primary/10 border-primary/20">
                    <Building2 className="h-4 w-4" />
                    <AlertDescription>
                      נרשם לבית הספר: <strong>{invitedSchool.name}</strong>
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border">
                    <div className="space-y-0.5">
                      <Label htmlFor="create-school" className="text-base font-medium cursor-pointer">
                        אני רוצה לפתוח בית ספר חדש
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        צור בית ספר משלך ונהל אותו
                      </p>
                    </div>
                    <Switch
                      id="create-school"
                      checked={isCreatingSchool}
                      onCheckedChange={setIsCreatingSchool}
                    />
                  </div>
                )}

                {/* School name input - only when creating school */}
                {isCreatingSchool && !invitedSchool && (
                  <div className="space-y-2">
                    <Label htmlFor="signup-schoolname">שם בית הספר</Label>
                    <div className="relative">
                      <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-schoolname"
                        type="text"
                        placeholder="בית ספר לשחייה"
                        className="pr-10"
                        value={signupForm.schoolName}
                        onChange={(e) => setSignupForm({ ...signupForm, schoolName: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-firstname">שם פרטי</Label>
                    <div className="relative">
                      <User className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-firstname"
                        type="text"
                        placeholder="ישראל"
                        className="pr-10"
                        value={signupForm.firstName}
                        onChange={(e) => setSignupForm({ ...signupForm, firstName: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
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
                <div className="space-y-2">
                  <Label htmlFor="signup-email">אימייל</Label>
                  <div className="relative">
                    <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="your@email.com"
                      className="pr-10"
                      value={signupForm.email}
                      onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })}
                      dir="ltr"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">סיסמה</Label>
                  <div className="relative">
                    <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      className="pr-10"
                      value={signupForm.password}
                      onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
                      dir="ltr"
                    />
                  </div>
                </div>

                {/* Warning if no invite and not creating school */}
                {!invitedSchool && !isCreatingSchool && (
                  <Alert variant="destructive" className="text-sm">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      יש לבחור "פתיחת בית ספר חדש" או להירשם דרך קישור הזמנה מבית ספר קיים
                    </AlertDescription>
                  </Alert>
                )}

                <Button 
                  type="submit" 
                  className="w-full gradient-primary" 
                  disabled={isLoading || (!invitedSchool && !isCreatingSchool)}
                >
                  {isLoading ? "נרשם..." : invitedSchool ? "הצטרף לבית הספר" : "צור בית ספר והירשם"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
