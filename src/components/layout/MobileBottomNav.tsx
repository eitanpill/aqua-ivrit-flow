import { Home, CalendarDays, UserCircle, Menu, Receipt, ClipboardList, X, LayoutDashboard, MapPin, Users, Settings, LogOut, GraduationCap, Package, CalendarPlus, BarChart3, CalendarCog, UserCheck, Award, RefreshCw, Wallet, Waves } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface MenuSection {
  title: string;
  items: NavItem[];
}

export function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isStaff, isCoach, isAdmin, isCustomer } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    setMenuOpen(false);
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleNavClick = () => {
    setMenuOpen(false);
  };

  // Different nav items based on role
  const getNavItems = (): NavItem[] => {
    if (isStaff) {
      return [
        { title: "בית", url: "/dashboard", icon: Home },
        { title: "יומן", url: "/calendar", icon: CalendarDays },
        ...(isCoach ? [{ title: "משמרת", url: "/coach", icon: ClipboardList }] : []),
        { title: "תשלומים", url: "/billing", icon: Receipt },
      ];
    }
    
    // Customer nav
    return [
      { title: "בית", url: "/dashboard", icon: Home },
      { title: "הרשמה", url: "/booking", icon: CalendarDays },
      { title: "משפחה", url: "/family", icon: UserCircle },
      { title: "תשלומים", url: "/billing", icon: Receipt },
    ];
  };

  // Get menu sections for the "More" sheet
  const getMenuSections = (): MenuSection[] => {
    const sections: MenuSection[] = [];

    if (isCustomer && !isStaff) {
      // Customer-only simplified menu
      sections.push({
        title: "תפריט",
        items: [
          { title: "בית", url: "/dashboard", icon: LayoutDashboard },
          { title: "המשפחה שלי", url: "/family", icon: UserCircle },
          { title: "הרשמה לשיעורים", url: "/booking", icon: CalendarPlus },
          { title: "תשלומים", url: "/billing", icon: Receipt },
          { title: "הגדרות", url: "/settings", icon: Settings },
        ],
      });
    } else if (isStaff) {
      // Staff main menu
      const mainItems: NavItem[] = [
        { title: "לוח בקרה", url: "/dashboard", icon: LayoutDashboard },
        { title: "יומן שיעורים", url: "/calendar", icon: CalendarDays },
      ];

      if (isAdmin) {
        mainItems.push(
          { title: "בונה מערכת שעות", url: "/schedule-builder", icon: CalendarCog },
          { title: "אשף הרשמות", url: "/enrollment-wizard", icon: UserCheck },
          { title: "ניהול בריכות", url: "/locations", icon: MapPin },
          { title: "משתמשים", url: "/users", icon: Users },
          { title: "דוחות", url: "/reports", icon: BarChart3 },
          { title: "דוח שכר", url: "/payroll", icon: Wallet }
        );
      }

      sections.push({ title: "תפריט ראשי", items: mainItems });

      // Coach section
      sections.push({
        title: "מאמנים",
        items: [
          { title: "המשמרת שלי", url: "/coach", icon: ClipboardList },
          { title: "שוק החלפות", url: "/substitutions", icon: RefreshCw },
        ],
      });

      // Customer features for staff
      sections.push({
        title: "לקוחות",
        items: [
          { title: "המשפחה שלי", url: "/family", icon: UserCircle },
          { title: "הרשמה לשיעורים", url: "/booking", icon: CalendarPlus },
          { title: "תשלומים", url: "/billing", icon: Receipt },
        ],
      });

      // Academic (admin only)
      if (isAdmin) {
        sections.push({
          title: "אקדמיה",
          items: [
            { title: "הגדרות פדגוגיות", url: "/pedagogy", icon: GraduationCap },
            { title: "ניהול מיומנויות", url: "/skills-management", icon: Award },
            { title: "ניהול מוצרים", url: "/products", icon: Package },
          ],
        });

        // Settings (admin only)
        sections.push({
          title: "מערכת",
          items: [
            { title: "הגדרות מערכת", url: "/settings", icon: Settings },
          ],
        });
      }
    }

    return sections;
  };

  const navItems = getNavItems();
  const menuSections = getMenuSections();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-card/95 backdrop-blur-lg border-t border-border safe-area-inset-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.url;
          return (
            <NavLink
              key={item.url}
              to={item.url}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive && "text-primary")} />
              <span className="text-xs font-medium">{item.title}</span>
            </NavLink>
          );
        })}
        
        {/* Hamburger Menu for secondary items */}
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <button
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
                menuOpen
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Menu className="h-5 w-5" />
              <span className="text-xs font-medium">עוד</span>
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[280px] p-0">
            <SheetHeader className="p-4 border-b">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary flex-shrink-0">
                  <Waves className="h-6 w-6 text-primary-foreground" />
                </div>
                <div className="flex flex-col">
                  <SheetTitle className="text-right">AquaFlow</SheetTitle>
                  <span className="text-xs text-muted-foreground">ניהול בית ספר לשחייה</span>
                </div>
              </div>
            </SheetHeader>
            
            <ScrollArea className="h-[calc(100vh-200px)]">
              <div className="p-2 space-y-4">
                {menuSections.map((section, sectionIndex) => (
                  <div key={section.title}>
                    <p className="px-3 py-2 text-xs font-medium text-muted-foreground">
                      {section.title}
                    </p>
                    <div className="space-y-1">
                      {section.items.map((item) => {
                        const isActive = location.pathname === item.url;
                        return (
                          <NavLink
                            key={item.url}
                            to={item.url}
                            onClick={handleNavClick}
                            className={cn(
                              "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all",
                              isActive
                                ? "bg-primary/10 text-primary font-medium"
                                : "text-foreground hover:bg-muted"
                            )}
                          >
                            <item.icon className="h-5 w-5 flex-shrink-0" />
                            <span>{item.title}</span>
                          </NavLink>
                        );
                      })}
                    </div>
                    {sectionIndex < menuSections.length - 1 && (
                      <Separator className="mt-3" />
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="absolute bottom-0 inset-x-0 p-4 border-t bg-background">
              <Button
                variant="ghost"
                onClick={handleLogout}
                className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              >
                <LogOut className="h-5 w-5 flex-shrink-0" />
                <span>התנתקות</span>
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
