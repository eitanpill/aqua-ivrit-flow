import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { SchoolSwitcher } from "./SchoolSwitcher";
import { MobileBottomNav } from "./MobileBottomNav";
import { Outlet } from "react-router-dom";
import { useSidebar } from "@/components/ui/sidebar";
import { useDeviceType } from "@/hooks/useDeviceType";

function MainContent() {
  const { state } = useSidebar();
  const { isMobile, isTablet, isDesktop } = useDeviceType();
  const isOpen = state === "expanded";
  
  // Mobile: No sidebar margin, add bottom padding for nav bar
  // Tablet: Always use icon-only sidebar width
  // Desktop: Dynamic based on sidebar state
  const getMarginStyle = () => {
    if (isMobile) {
      return { marginInlineStart: 0 };
    }
    if (isTablet) {
      return { marginInlineStart: "var(--sidebar-width-icon)" };
    }
    return { 
      marginInlineStart: isOpen ? "var(--sidebar-width)" : "var(--sidebar-width-icon)" 
    };
  };

  return (
    <div 
      className="flex-1 flex flex-col min-h-screen transition-[margin] duration-200 ease-linear overflow-x-hidden"
      style={getMarginStyle()}
    >
      <header className="h-14 flex items-center justify-between border-b border-border/30 px-4 flex-shrink-0 sticky top-0 z-10 backdrop-blur-xl" style={{ background: 'rgba(255, 255, 255, 0.03)' }}>
        {/* Show sidebar trigger only on desktop */}
        {isDesktop && (
          <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
        )}
        {/* Empty div for spacing on mobile/tablet */}
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
  return (
    <div className="flex flex-col min-h-screen w-full bg-background">
      <header className="h-14 flex items-center justify-between border-b border-border px-4 bg-card flex-shrink-0 sticky top-0 z-10">
        <div />
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
  
  if (isMobile) {
    return <MobileLayout />;
  }
  
  if (isTablet) {
    return <TabletLayout />;
  }
  
  return <DesktopLayout />;
}
