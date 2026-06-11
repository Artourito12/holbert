import { Outlet } from "react-router";
import { useSidebar } from "../context/SidebarContext";
import AppSidebar from "./AppSidebar";
import AppHeader from "./AppHeader";
import Backdrop from "./Backdrop";

export default function AppLayout() {
  const { isExpanded, isHovered } = useSidebar();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <AppSidebar />
      <Backdrop />
      <div
        className={`transition-all duration-300 ease-in-out ${
          isExpanded || isHovered ? "xl:ml-[290px]" : "xl:ml-[90px]"
        }`}
      >
        <AppHeader />
        <main>
          <div className="mx-auto max-w-(--breakpoint-2xl) p-4 md:p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
