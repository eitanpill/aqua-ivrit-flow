import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Outlet } from "react-router-dom";
import { useSidebar } from "@/components/ui/sidebar";

function MainContent() {
  const { state } = useSidebar();
  const isOpen = state === "expanded";
  
  return (
    <div 
      className="flex-1 flex flex-col min-h-screen transition-[margin] duration-200 ease-linear"
      style={{ 
        marginInlineEnd: isOpen ? 'var(--sidebar-width)' : 'var(--sidebar-width-icon)' 
      }}
    >
      <header className="h-14 flex items-center justify-between border-b border-border px-4 bg-card flex-shrink-0 sticky top-0 z-10">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
        <div className="flex items-center gap-4">
          {/* Future: notifications, user menu */}
        </div>
      </header>
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}

export function AppLayout() {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full bg-background">
        <MainContent />
        <AppSidebar />
      </div>
    </SidebarProvider>
  );
}
