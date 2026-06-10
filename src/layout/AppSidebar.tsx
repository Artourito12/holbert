import { NavLink } from "react-router";
import {
  LayoutDashboard,
  Sparkles,
  FolderOpen,
  MessageSquare,
  BookOpen,
  Bell,
  Settings,
} from "lucide-react";
import { useSidebar } from "../context/SidebarContext";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Tableau de bord" },
  { to: "/analyse-contrat", icon: Sparkles, label: "Analyser un contrat" },
  { to: "/contrats", icon: FolderOpen, label: "Contrats" },
  { to: "/dossiers", icon: MessageSquare, label: "Dossiers de cas" },
  { to: "/modeles", icon: BookOpen, label: "Modèles" },
  { to: "/veille", icon: Bell, label: "Veille juridique" },
];

const bottomItems = [{ to: "/parametres", icon: Settings, label: "Paramètres" }];

export default function AppSidebar() {
  const { isExpanded, isMobileOpen } = useSidebar();
  const open = isExpanded || isMobileOpen;

  return (
    <aside
      className={`fixed top-0 left-0 z-40 flex h-screen flex-col border-r border-gray-200 bg-white transition-all duration-300 dark:border-gray-800 dark:bg-gray-900 ${
        open ? "w-64" : "w-20"
      } ${isMobileOpen ? "translate-x-0" : "-translate-x-full xl:translate-x-0"}`}
    >
      <div className="flex items-center gap-3 px-5 py-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 text-white font-bold">
          H
        </div>
        {open && (
          <span className="text-lg font-semibold text-gray-900 dark:text-white">
            Holbert
          </span>
        )}
      </div>

      <nav className="flex-1 px-3">
        <ul className="space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  `menu-item group ${
                    isActive ? "menu-item-active" : "menu-item-inactive"
                  }`
                }
              >
                <Icon className="size-5 shrink-0" />
                {open && <span>{label}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-gray-200 px-3 py-4 dark:border-gray-800">
        <ul className="space-y-1">
          {bottomItems.map(({ to, icon: Icon, label }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  `menu-item group ${
                    isActive ? "menu-item-active" : "menu-item-inactive"
                  }`
                }
              >
                <Icon className="size-5 shrink-0" />
                {open && <span>{label}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
