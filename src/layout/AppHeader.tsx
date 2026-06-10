import { Menu, LogOut, Sun, Moon } from "lucide-react";
import { useSidebar } from "../context/SidebarContext";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";

export default function AppHeader() {
  const { toggleMobileSidebar, toggleSidebar } = useSidebar();
  const { theme, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 dark:border-gray-800 dark:bg-gray-900 lg:px-6">
      <button
        onClick={() => {
          if (window.innerWidth < 1280) {
            toggleMobileSidebar();
          } else {
            toggleSidebar();
          }
        }}
        className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
        aria-label="Toggle sidebar"
      >
        <Menu className="size-5" />
      </button>

      <div className="flex items-center gap-2">
        <button
          onClick={toggleTheme}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          aria-label="Toggle theme"
        >
          {theme === "light" ? (
            <Moon className="size-5" />
          ) : (
            <Sun className="size-5" />
          )}
        </button>
        {user && (
          <>
            <span className="hidden text-sm text-gray-600 dark:text-gray-300 sm:inline">
              {user.email}
            </span>
            <button
              onClick={signOut}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              aria-label="Sign out"
            >
              <LogOut className="size-5" />
            </button>
          </>
        )}
      </div>
    </header>
  );
}
