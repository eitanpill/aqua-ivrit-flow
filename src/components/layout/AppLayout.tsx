import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Outlet } from "react-router-dom";

export function AppLayout() {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex h-screen w-full overflow-hidden bg-background">
        {/* Main Content Area - LEFT side */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <header className="h-14 flex items-center justify-between border-b border-border px-4 bg-card flex-shrink-0">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
            <div className="flex items-center gap-4">
              {/* Future: notifications, user menu */}
            </div>
          </header>
          <div className="flex-1 overflow-auto p-6">
            <Outlet />
          </div>
        </main>
        
        {/* Sidebar - RIGHT side (RTL layout) */}
        <AppSidebar />
      </div>
    </SidebarProvider>
  );
}
