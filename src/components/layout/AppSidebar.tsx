import { LayoutDashboard, MapPin, Users, Settings, LogOut, Waves, GraduationCap, Package, CalendarDays } from "lucide-react";
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

const mainMenuItems = [
  { title: "לוח בקרה", url: "/dashboard", icon: LayoutDashboard },
  { title: "יומן שיעורים", url: "/calendar", icon: CalendarDays },
  { title: "ניהול בריכות", url: "/locations", icon: MapPin },
  { title: "משתמשים", url: "/users", icon: Users },
];

const academicMenuItems = [
  { title: "הגדרות פדגוגיות", url: "/pedagogy", icon: GraduationCap },
  { title: "ניהול מוצרים", url: "/products", icon: Package },
];

const settingsMenuItems = [
  { title: "הגדרות", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const renderMenuItems = (items: typeof mainMenuItems) => (
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

  return (
    <Sidebar side="right" collapsible="icon" className="border-s border-sidebar-border">
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
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground">תפריט ראשי</SidebarGroupLabel>
          <SidebarGroupContent>
            {renderMenuItems(mainMenuItems)}
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground">אקדמיה</SidebarGroupLabel>
          <SidebarGroupContent>
            {renderMenuItems(academicMenuItems)}
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground">מערכת</SidebarGroupLabel>
          <SidebarGroupContent>
            {renderMenuItems(settingsMenuItems)}
          </SidebarGroupContent>
        </SidebarGroup>
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
