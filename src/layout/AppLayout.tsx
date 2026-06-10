import { Outlet } from "react-router";
import { useSidebar } from "../context/SidebarContext";
import AppSidebar from "./AppSidebar";
import AppHeader from "./AppHeader";

export default function AppLayout() {
  const { isExpanded } = useSidebar();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <AppSidebar />
      <div
        className={`transition-all duration-300 ${
          isExpanded ? "xl:ml-64" : "xl:ml-20"
        }`}
      >
        <AppHeader />
        <main className="p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
