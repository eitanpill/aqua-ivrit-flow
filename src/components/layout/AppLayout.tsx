import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { SchoolSwitcher } from "./SchoolSwitcher";
import { MobileBottomNav } from "./MobileBottomNav";
import { Outlet } from "react-router-dom";
import { useSidebar } from "@/components/ui/sidebar";
import { useDeviceType } from "@/hooks/useDeviceType";
import { useAuth } from "@/hooks/useAuth";
import { Waves } from "lucide-react";

const HEADER_STYLE = { background: 'rgba(255, 255, 255, 0.03)' };

function MainContent() {
  const { state } = useSidebar();
  const { isMobile, isTablet, isDesktop } = useDeviceType();
  const isOpen = state === "expanded";

  const getMarginStyle = () => {
    if (isMobile) return { marginInlineStart: 0 };
    if (isTablet) return { marginInlineStart: "var(--sidebar-width-icon)" };
    return { marginInlineStart: isOpen ? "var(--sidebar-width)" : "var(--sidebar-width-icon)" };
  };

  return (
    <div
      className="flex-1 flex flex-col min-h-screen transition-[margin] duration-200 ease-linear overflow-x-hidden"
      style={getMarginStyle()}
    >
      <header
        className="h-14 flex items-center justify-between border-b border-border/30 px-4 flex-shrink-0 sticky top-0 z-10 backdrop-blur-xl"
        style={HEADER_STYLE}
      >
        {isDesktop && (
          <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
        )}
        {!isDesktop && <div />}
        <div className="flex items-center gap-4">
          <SchoolSwitcher />
        </div>
      </header>
      <main className={`flex-1 overflow-auto p-4 md:p-6 ${isMobile ? 'pb-20' : ''}`}>
        <Outlet />
      </main>
    </div>
  );
}

function DesktopLayout() {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full bg-background">
        <MainContent />
        <AppSidebar />
      </div>
    </SidebarProvider>
  );
}

function TabletLayout() {
  return (
    <SidebarProvider defaultOpen={false}>
      <div className="flex min-h-screen w-full bg-background">
        <MainContent />
        <AppSidebar />
      </div>
    </SidebarProvider>
  );
}

function MobileLayout() {
  const { user } = useAuth();
  const schoolName = user?.user_metadata?.first_name
    ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}`.trim()
    : null;

  return (
    <div className="flex flex-col min-h-screen w-full bg-background">
      <header
        className="h-14 flex items-center justify-between border-b border-border/30 px-4 flex-shrink-0 sticky top-0 z-10 backdrop-blur-xl"
        style={HEADER_STYLE}
      >
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary">
            <Waves className="h-4 w-4 text-primary-foreground" />
          </div>
          {schoolName && (
            <span className="text-sm font-medium text-foreground/80 truncate max-w-[120px]">
              {schoolName}
            </span>
          )}
        </div>
        <SchoolSwitcher />
      </header>
      <main className="flex-1 overflow-auto p-4 pb-20">
        <Outlet />
      </main>
      <MobileBottomNav />
    </div>
  );
}

export function AppLayout() {
  const { isMobile, isTablet } = useDeviceType();

  if (isMobile) return <MobileLayout />;
  if (isTablet) return <TabletLayout />;
  return <DesktopLayout />;
}
