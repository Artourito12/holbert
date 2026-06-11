import { useState, useRef, useEffect } from "react";
import { useSidebar } from "../context/SidebarContext";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useOrg } from "../context/OrgContext";
import NotificationsDropdown from "./NotificationsDropdown";
import {
  IconBuilding,
  IconCheck,
  IconChevronDown,
  IconLogout,
  IconMenu,
  IconMoon,
  IconSun,
} from "./icons";

export default function AppHeader() {
  const { toggleMobileSidebar, toggleSidebar } = useSidebar();
  const { theme, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();
  const { orgs, currentOrg, switchOrg } = useOrg();
  const [orgMenuOpen, setOrgMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOrgMenuOpen(false);
      }
    }
    if (orgMenuOpen) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [orgMenuOpen]);

  return (
    <header className="sticky top-0 z-99 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 dark:border-gray-800 dark:bg-gray-900 lg:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            if (window.innerWidth < 1280) {
              toggleMobileSidebar();
            } else {
              toggleSidebar();
            }
          }}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          aria-label="Ouvrir ou réduire le menu"
        >
          <IconMenu className="size-5" />
        </button>

        {currentOrg && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setOrgMenuOpen((v) => !v)}
              className="flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <IconBuilding className="size-4 text-brand-500" />
              <span className="max-w-[180px] truncate">{currentOrg.name}</span>
              {orgs.length > 1 && (
                <IconChevronDown className="size-4 text-gray-400" />
              )}
            </button>

            {orgMenuOpen && orgs.length > 1 && (
              <div className="absolute left-0 top-12 z-40 w-64 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-theme-md dark:border-gray-800 dark:bg-gray-900">
                <div className="px-3 py-2 text-xs font-medium uppercase text-gray-400">
                  Vos organisations
                </div>
                {orgs.map((org) => (
                  <button
                    key={org.id}
                    onClick={() => {
                      switchOrg(org.id);
                      setOrgMenuOpen(false);
                    }}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    <span className="truncate">{org.name}</span>
                    {org.id === currentOrg.id && (
                      <IconCheck className="size-4 text-brand-500" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <NotificationsDropdown />
        <button
          onClick={toggleTheme}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          aria-label="Changer de thème"
        >
          {theme === "light" ? (
            <IconMoon className="size-5" />
          ) : (
            <IconSun className="size-5" />
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
              aria-label="Se déconnecter"
            >
              <IconLogout className="size-5" />
            </button>
          </>
        )}
      </div>
    </header>
  );
}
