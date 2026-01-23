import { Home, CalendarDays, UserCircle, Menu, Receipt, ClipboardList } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import { AppSidebar } from "./AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function MobileBottomNav() {
  const location = useLocation();
  const { isStaff, isCoach } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

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

  const navItems = getNavItems();

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
              <SheetTitle className="text-right">תפריט</SheetTitle>
            </SheetHeader>
            <SidebarProvider defaultOpen={true}>
              <div className="overflow-auto h-[calc(100vh-60px)]">
                <AppSidebar />
              </div>
            </SidebarProvider>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
