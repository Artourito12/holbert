import { useSidebar } from "../context/SidebarContext";

export default function Backdrop() {
  const { isMobileOpen, setIsMobileOpen } = useSidebar();

  if (!isMobileOpen) return null;

  return (
    <div
      className="fixed inset-0 z-9999 bg-gray-900/50 xl:hidden"
      onClick={() => setIsMobileOpen(false)}
      aria-hidden="true"
    />
  );
}
