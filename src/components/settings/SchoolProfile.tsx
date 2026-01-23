import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Building2, 
  Copy, 
  Check, 
  RefreshCw, 
  Link2, 
  Mail, 
  Phone, 
  MapPin,
  Loader2,
  ExternalLink
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function SchoolProfile() {
  const { currentSchool, activeSchoolId, isSuperAdmin, refreshSchools } = useSchool();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [isRegeneratingSlug, setIsRegeneratingSlug] = useState(false);

  // Fetch school details (use activeSchoolId for super admin)
  const schoolIdToUse = isSuperAdmin ? activeSchoolId : currentSchool?.id;

  const { data: school, isLoading } = useQuery({
    queryKey: ["school-profile", schoolIdToUse],
    queryFn: async () => {
      if (!schoolIdToUse) return null;
      const { data, error } = await supabase
        .from("schools")
        .select("*")
        .eq("id", schoolIdToUse)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!schoolIdToUse,
  });

  // Update school mutation
  const updateSchoolMutation = useMutation({
    mutationFn: async (updates: { name?: string; email?: string; phone?: string; address?: string }) => {
      if (!schoolIdToUse) throw new Error("No school selected");
      
      const { error } = await supabase
        .from("schools")
        .update(updates)
        .eq("id", schoolIdToUse);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["school-profile", schoolIdToUse] });
      refreshSchools();
      toast({
        title: "נשמר בהצלחה",
        description: "פרטי בית הספר עודכנו",
      });
    },
    onError: (error) => {
      toast({
        title: "שגיאה בשמירה",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Generate invite link
  const getInviteLink = () => {
    if (!school?.slug) return "";
    const baseUrl = window.location.origin;
    return `${baseUrl}/auth?invite=${school.slug}`;
  };

  const copyInviteLink = async () => {
    const link = getInviteLink();
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast({
        title: "הקישור הועתק!",
        description: "שתף את הקישור עם הורים ומאמנים להרשמה",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "שגיאה בהעתקה",
        description: "נסה להעתיק ידנית",
        variant: "destructive",
      });
    }
  };

  // Regenerate slug
  const regenerateSlug = async () => {
    if (!school || !schoolIdToUse) return;
    
    setIsRegeneratingSlug(true);
    try {
      // Generate new unique slug
      const baseSlug = school.name
        .toLowerCase()
        .replace(/[^א-תa-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const newSlug = `${baseSlug || 'school'}-${randomSuffix}`;

      const { error } = await supabase
        .from("schools")
        .update({ slug: newSlug })
        .eq("id", schoolIdToUse);
      
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["school-profile", schoolIdToUse] });
      refreshSchools();
      
      toast({
        title: "קישור ההזמנה חודש",
        description: "הקישור הקודם לא יעבוד יותר",
      });
    } catch (error: any) {
      toast({
        title: "שגיאה בחידוש הקישור",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsRegeneratingSlug(false);
    }
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    updateSchoolMutation.mutate({
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      phone: formData.get("phone") as string,
      address: formData.get("address") as string,
    });
  };

  // Check if user is owner or super admin
  const isOwner = school?.owner_id === user?.id || isSuperAdmin;

  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!school) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-12 text-center">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">לא נמצא בית ספר</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Invite Link Section - Most important */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5 text-primary" />
                קישור הזמנה להרשמה
              </CardTitle>
              <CardDescription>
                שתף קישור זה עם הורים ומאמנים כדי שיוכלו להצטרף לבית הספר
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-primary border-primary/30">
              {school.slug}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={getInviteLink()}
              readOnly
              dir="ltr"
              className="font-mono text-sm bg-background"
            />
            <Button
              onClick={copyInviteLink}
              variant="secondary"
              className="shrink-0 gap-2"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  הועתק!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  העתק
                </>
              )}
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              משתמשים שנרשמים דרך קישור זה יצורפו אוטומטית לבית הספר שלך
            </p>
            {isOwner && (
              <Button
                variant="ghost"
                size="sm"
                onClick={regenerateSlug}
                disabled={isRegeneratingSlug}
                className="gap-2 text-muted-foreground hover:text-foreground"
              >
                {isRegeneratingSlug ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                חדש קישור
              </Button>
            )}
          </div>

          <Alert>
            <ExternalLink className="h-4 w-4" />
            <AlertDescription>
              <strong>טיפ:</strong> שתף את הקישור בקבוצות וואטסאפ, שלח במייל, או הצג בדף הנחיתה שלך
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* School Details Form */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            פרטי בית הספר
          </CardTitle>
          <CardDescription>
            מידע בסיסי על בית הספר שלך
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">שם בית הספר</Label>
                <div className="relative">
                  <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="name"
                    name="name"
                    defaultValue={school.name}
                    className="pr-10"
                    disabled={!isOwner}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">אימייל</Label>
                <div className="relative">
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    defaultValue={school.email || ""}
                    className="pr-10"
                    dir="ltr"
                    disabled={!isOwner}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">טלפון</Label>
                <div className="relative">
                  <Phone className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    defaultValue={school.phone || ""}
                    className="pr-10"
                    dir="ltr"
                    disabled={!isOwner}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">כתובת</Label>
                <div className="relative">
                  <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="address"
                    name="address"
                    defaultValue={school.address || ""}
                    className="pr-10"
                    disabled={!isOwner}
                  />
                </div>
              </div>
            </div>

            {isOwner && (
              <>
                <Separator />
                <div className="flex justify-end">
                  <Button 
                    type="submit" 
                    disabled={updateSchoolMutation.isPending}
                    className="gap-2"
                  >
                    {updateSchoolMutation.isPending && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    שמור שינויים
                  </Button>
                </div>
              </>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
