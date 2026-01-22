import { LayoutDashboard, MapPin, Users, Settings, LogOut, Waves, GraduationCap, Package, CalendarDays, UserCircle, CalendarPlus, ClipboardList, Receipt, BarChart3, CalendarCog, UserCheck } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

type MenuItem = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
};

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin, isCoach, isCustomer, isStaff } = useAuth();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  // Customer-only navigation (simple and focused)
  const getCustomerOnlyMenuItems = (): MenuItem[] => {
    return [
      { title: "בית", url: "/dashboard", icon: LayoutDashboard },
      { title: "המשפחה שלי", url: "/family", icon: UserCircle },
      { title: "הרשמה לשיעורים", url: "/booking", icon: CalendarPlus },
      { title: "תשלומים", url: "/billing", icon: Receipt },
      { title: "הגדרות", url: "/settings", icon: Settings },
    ];
  };

  // Staff menu items (Admin + Coach)
  const getMainMenuItems = (): MenuItem[] => {
    const items: MenuItem[] = [
      { title: "לוח בקרה", url: "/dashboard", icon: LayoutDashboard },
      { title: "יומן שיעורים", url: "/calendar", icon: CalendarDays },
    ];

    // Admin only
    if (isAdmin) {
      items.push(
        { title: "בונה מערכת שעות", url: "/schedule-builder", icon: CalendarCog },
        { title: "אשף הרשמות", url: "/enrollment-wizard", icon: UserCheck },
        { title: "ניהול בריכות", url: "/locations", icon: MapPin },
        { title: "משתמשים", url: "/users", icon: Users },
        { title: "דוחות ושכר", url: "/reports", icon: BarChart3 }
      );
    }

    return items;
  };

  const getCoachMenuItems = (): MenuItem[] => {
    return [
      { title: "המשמרת שלי", url: "/coach", icon: ClipboardList },
    ];
  };

  const getStaffCustomerMenuItems = (): MenuItem[] => {
    // Staff can also access customer features (for testing or personal use)
    return [
      { title: "המשפחה שלי", url: "/family", icon: UserCircle },
      { title: "הרשמה לשיעורים", url: "/booking", icon: CalendarPlus },
      { title: "תשלומים", url: "/billing", icon: Receipt },
    ];
  };

  const getAcademicMenuItems = (): MenuItem[] => {
    if (!isAdmin) return [];
    return [
      { title: "הגדרות פדגוגיות", url: "/pedagogy", icon: GraduationCap },
      { title: "ניהול מוצרים", url: "/products", icon: Package },
    ];
  };

  const getSettingsMenuItems = (): MenuItem[] => {
    if (!isAdmin) return [];
    return [
      { title: "הגדרות מערכת", url: "/settings", icon: Settings },
    ];
  };

  // For customers, show simplified menu
  const customerOnlyMenuItems = isCustomer && !isStaff ? getCustomerOnlyMenuItems() : [];
  
  // For staff, show full menu
  const mainMenuItems = isStaff ? getMainMenuItems() : [];
  const coachMenuItems = isStaff ? getCoachMenuItems() : [];
  const staffCustomerMenuItems = isStaff ? getStaffCustomerMenuItems() : [];
  const academicMenuItems = getAcademicMenuItems();
  const settingsMenuItems = getSettingsMenuItems();

  const renderMenuItems = (items: MenuItem[]) => {
    if (items.length === 0) return null;
    
    return (
      <SidebarMenu>
        {items.map((item) => {
          const isActive = location.pathname === item.url;
          return (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild>
                <NavLink
                  to={item.url}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 transition-all",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-primary font-medium"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {!collapsed && <span>{item.title}</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    );
  };

  return (
    <Sidebar side="right" collapsible="icon" className="border-s border-sidebar-border flex-shrink-0">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary">
            <Waves className="h-6 w-6 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-lg font-bold text-sidebar-foreground">AquaFlow</span>
              <span className="text-xs text-muted-foreground">ניהול בית ספר לשחייה</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Customer-only simplified menu */}
        {customerOnlyMenuItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-muted-foreground">תפריט</SidebarGroupLabel>
            <SidebarGroupContent>
              {renderMenuItems(customerOnlyMenuItems)}
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Staff menu sections */}
        {mainMenuItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-muted-foreground">תפריט ראשי</SidebarGroupLabel>
            <SidebarGroupContent>
              {renderMenuItems(mainMenuItems)}
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {coachMenuItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-muted-foreground">מאמנים</SidebarGroupLabel>
            <SidebarGroupContent>
              {renderMenuItems(coachMenuItems)}
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {staffCustomerMenuItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-muted-foreground">לקוחות</SidebarGroupLabel>
            <SidebarGroupContent>
              {renderMenuItems(staffCustomerMenuItems)}
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {academicMenuItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-muted-foreground">אקדמיה</SidebarGroupLabel>
            <SidebarGroupContent>
              {renderMenuItems(academicMenuItems)}
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {settingsMenuItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-muted-foreground">מערכת</SidebarGroupLabel>
            <SidebarGroupContent>
              {renderMenuItems(settingsMenuItems)}
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4">
        <Button
          variant="ghost"
          onClick={handleLogout}
          className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        >
          <LogOut className="h-5 w-5" />
          {!collapsed && <span>התנתקות</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
