import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Outlet } from "react-router-dom";

export function AppLayout() {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen flex w-full">
        <main className="flex-1 flex flex-col">
          <header className="h-14 flex items-center justify-between border-b border-border px-4 bg-card">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
            <div className="flex items-center gap-4">
              {/* Future: notifications, user menu */}
            </div>
          </header>
          <div className="flex-1 overflow-auto bg-background p-6">
            <Outlet />
          </div>
        </main>
        <AppSidebar />
      </div>
    </SidebarProvider>
  );
}
