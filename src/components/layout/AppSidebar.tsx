import { LayoutDashboard, MapPin, Users, Settings, LogOut, Waves, GraduationCap, Package, CalendarDays, UserCircle, CalendarPlus, ClipboardList, Receipt, BarChart3, CalendarCog, UserCheck, Award, RefreshCw, Wallet, Mail } from "lucide-react";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDeviceType } from "@/hooks/useDeviceType";
import { useState } from "react";

type MenuItem = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
};

const ROLE_LABELS: Record<string, string> = {
  admin: "מנהל",
  coach: "מאמן",
  customer: "לקוח",
};

export function AppSidebar() {
  const { state, setOpenMobile, setOpen } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin, isCoach, isCustomer, isStaff, user, role } = useAuth();
  const isMobile = useIsMobile();
  const { isTablet } = useDeviceType();
  const [isHovered, setIsHovered] = useState(false);

  // Calculate effective collapsed state before using it
  const effectiveCollapsed = isTablet ? !isHovered : collapsed;

  const handleMouseEnter = () => {
    if (isTablet) {
      setIsHovered(true);
      setOpen(true);
    }
  };

  const handleMouseLeave = () => {
    if (isTablet) {
      setIsHovered(false);
      setOpen(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleNavClick = () => {
    if (isMobile) setOpenMobile(false);
  };

  const getCustomerOnlyMenuItems = (): MenuItem[] => [
    { title: "בית", url: "/dashboard", icon: LayoutDashboard },
    { title: "המשפחה שלי", url: "/family", icon: UserCircle },
    { title: "הרשמה לשיעורים", url: "/booking", icon: CalendarPlus },
    { title: "תשלומים", url: "/billing", icon: Receipt },
    { title: "הגדרות", url: "/settings", icon: Settings },
  ];

  const getMainMenuItems = (): MenuItem[] => {
    const items: MenuItem[] = [
      { title: "לוח בקרה", url: "/dashboard", icon: LayoutDashboard },
      { title: "יומן שיעורים", url: "/calendar", icon: CalendarDays },
    ];

    if (isAdmin) {
      items.push(
        { title: "בונה מערכת שעות", url: "/schedule-builder", icon: CalendarCog },
        { title: "אשף הרשמות", url: "/enrollment-wizard", icon: UserCheck },
        { title: "ניהול בריכות", url: "/locations", icon: MapPin },
        { title: "משתמשים", url: "/users", icon: Users },
        { title: "דוחות", url: "/reports", icon: BarChart3 },
        { title: "דוח שכר", url: "/payroll", icon: Wallet }
      );
    }

    return items;
  };

  const getCoachMenuItems = (): MenuItem[] => [
    { title: "המשמרת שלי", url: "/coach", icon: ClipboardList },
    { title: "שוק החלפות", url: "/substitutions", icon: RefreshCw },
  ];

  const getStaffCustomerMenuItems = (): MenuItem[] => [
    { title: "המשפחה שלי", url: "/family", icon: UserCircle },
    { title: "הרשמה לשיעורים", url: "/booking", icon: CalendarPlus },
    { title: "תשלומים", url: "/billing", icon: Receipt },
  ];

  const getAcademicMenuItems = (): MenuItem[] => {
    if (!isAdmin) return [];
    return [
      { title: "הגדרות פדגוגיות", url: "/pedagogy", icon: GraduationCap },
      { title: "ניהול מיומנויות", url: "/skills-management", icon: Award },
      { title: "ניהול מוצרים", url: "/products", icon: Package },
    ];
  };

  const getSettingsMenuItems = (): MenuItem[] => {
    if (!isAdmin) return [];
    return [{ title: "הגדרות מערכת", url: "/settings", icon: Settings }];
  };

  const customerOnlyMenuItems = isCustomer && !isStaff ? getCustomerOnlyMenuItems() : [];
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
                  onClick={handleNavClick}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 transition-all",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-primary font-medium"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  {!effectiveCollapsed && <span>{item.title}</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    );
  };

  // User initials for avatar
  const userInitials = user?.user_metadata
    ? `${(user.user_metadata.first_name || '')[0] || ''}${(user.user_metadata.last_name || '')[0] || ''}`.toUpperCase() || user.email?.[0]?.toUpperCase() || '?'
    : user?.email?.[0]?.toUpperCase() || '?';

  const userName = user?.user_metadata?.first_name
    ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}`.trim()
    : user?.email || '';

  return (
    <Sidebar
      side="right"
      collapsible="icon"
      className="border-s border-sidebar-border flex-shrink-0 transition-all duration-200"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary flex-shrink-0">
            <Waves className="h-6 w-6 text-primary-foreground" />
          </div>
          {!effectiveCollapsed && (
            <div className="flex flex-col">
              <span className="text-lg font-bold text-sidebar-foreground">AquaFlow</span>
              <span className="text-xs text-muted-foreground">ניהול בית ספר לשחייה</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {customerOnlyMenuItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-muted-foreground">תפריט</SidebarGroupLabel>
            <SidebarGroupContent>{renderMenuItems(customerOnlyMenuItems)}</SidebarGroupContent>
          </SidebarGroup>
        )}

        {mainMenuItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-muted-foreground">תפריט ראשי</SidebarGroupLabel>
            <SidebarGroupContent>{renderMenuItems(mainMenuItems)}</SidebarGroupContent>
          </SidebarGroup>
        )}

        {coachMenuItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-muted-foreground">מאמנים</SidebarGroupLabel>
            <SidebarGroupContent>{renderMenuItems(coachMenuItems)}</SidebarGroupContent>
          </SidebarGroup>
        )}

        {staffCustomerMenuItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-muted-foreground">לקוחות</SidebarGroupLabel>
            <SidebarGroupContent>{renderMenuItems(staffCustomerMenuItems)}</SidebarGroupContent>
          </SidebarGroup>
        )}

        {academicMenuItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-muted-foreground">אקדמיה</SidebarGroupLabel>
            <SidebarGroupContent>{renderMenuItems(academicMenuItems)}</SidebarGroupContent>
          </SidebarGroup>
        )}

        {settingsMenuItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-muted-foreground">מערכת</SidebarGroupLabel>
            <SidebarGroupContent>{renderMenuItems(settingsMenuItems)}</SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3 space-y-2">
        {/* User Profile Card */}
        {user && !effectiveCollapsed && (
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-sidebar-accent/30 border border-sidebar-border/50">
            <Avatar className="h-8 w-8 flex-shrink-0">
              <AvatarFallback className="bg-primary/20 text-primary text-xs font-semibold">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{userName}</p>
              <p className="text-xs text-muted-foreground">{ROLE_LABELS[role || ''] || ''}</p>
            </div>
          </div>
        )}

        {/* Support Email */}
        <a
          href="mailto:Support@aqua-swim.co.il"
          className="flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground hover:text-primary hover:bg-accent/50 rounded-lg transition-colors"
          title="Support@aqua-swim.co.il"
        >
          <Mail className="h-5 w-5 flex-shrink-0" />
          {!effectiveCollapsed && <span className="truncate">Support@aqua-swim.co.il</span>}
        </a>

        <Button
          variant="ghost"
          onClick={handleLogout}
          className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          {!effectiveCollapsed && <span>התנתקות</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
