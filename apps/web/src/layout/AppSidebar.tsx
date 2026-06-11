import { NavLink } from "react-router";
import { MODULES, PLATFORM_NAME } from "@holbert/core";
import { useSidebar } from "../context/SidebarContext";
import { useOrg } from "../context/OrgContext";
import {
  IconAdmin,
  IconAssistant,
  IconBuilding,
  IconCalendar,
  IconDocuments,
  IconNormer,
  IconPleiter,
  IconRaader,
  IconUiKit,
} from "./icons";

type NavItem = {
  to: string;
  label: string;
  icon: React.FC<{ className?: string }>;
};

export default function AppSidebar() {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const { hasModule, isPlatformAdmin } = useOrg();

  const open = isExpanded || isHovered || isMobileOpen;

  const menuItems: NavItem[] = [
    { to: "/", label: PLATFORM_NAME, icon: IconAssistant },
    { to: "/raader", label: MODULES.raader.name, icon: IconRaader },
    { to: "/modeles", label: "Modèles d'actes", icon: IconDocuments },
    { to: "/echeancier", label: "Échéancier", icon: IconCalendar },
  ];

  const moduleItems: NavItem[] = [
    hasModule("pleiter") && {
      to: "/pleiter",
      label: MODULES.pleiter.name,
      icon: IconPleiter,
    },
    hasModule("normer") && {
      to: "/normer",
      label: MODULES.normer.name,
      icon: IconNormer,
    },
  ].filter(Boolean) as NavItem[];

  const bottomItems: NavItem[] = [
    { to: "/organisation", label: "Organisation", icon: IconBuilding },
    { to: "/ui-kit", label: "UI Kit", icon: IconUiKit },
    ...(isPlatformAdmin
      ? [{ to: "/admin", label: "Administration", icon: IconAdmin }]
      : []),
  ];

  const renderItems = (items: NavItem[]) => (
    <ul className="flex flex-col gap-1">
      {items.map(({ to, icon: ItemIcon, label }) => (
        <li key={to}>
          <NavLink
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `menu-item group ${isActive ? "menu-item-active" : "menu-item-inactive"} ${
                !open ? "justify-center" : ""
              }`
            }
          >
            <ItemIcon className="size-6 shrink-0" />
            {open && <span>{label}</span>}
          </NavLink>
        </li>
      ))}
    </ul>
  );

  const sectionTitle = (label: string) => (
    <h2
      className={`mb-2 flex text-xs uppercase leading-5 text-gray-400 ${
        !open ? "justify-center" : "justify-start"
      }`}
    >
      {open ? label : "···"}
    </h2>
  );

  return (
    <aside
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`fixed top-0 left-0 z-99999 flex h-screen flex-col border-r border-gray-200 bg-white px-5 transition-all duration-300 ease-in-out dark:border-gray-800 dark:bg-gray-900 ${
        open ? "w-[290px]" : "w-[90px]"
      } ${isMobileOpen ? "translate-x-0" : "-translate-x-full xl:translate-x-0"}`}
    >
      <div
        className={`flex items-center gap-3 py-8 ${!open ? "justify-center" : ""}`}
      >
        <img
          src="/logo.png"
          alt={PLATFORM_NAME}
          className="h-9 w-9 object-contain"
        />
        {open && (
          <span className="text-lg font-semibold text-gray-900 dark:text-white">
            {PLATFORM_NAME}
          </span>
        )}
      </div>

      <nav className="no-scrollbar flex-1 overflow-y-auto">
        <div className="flex flex-col gap-6">
          <div>
            {sectionTitle("Menu")}
            {renderItems(menuItems)}
          </div>

          {moduleItems.length > 0 && (
            <div>
              {sectionTitle("Modules")}
              {renderItems(moduleItems)}
            </div>
          )}
        </div>
      </nav>

      <div className="border-t border-gray-200 py-4 dark:border-gray-800">
        {renderItems(bottomItems)}
      </div>
    </aside>
  );
}
