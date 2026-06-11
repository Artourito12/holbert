/**
 * Icônes de navigation — SVG inline au trait Heldert (stroke 1.5, rounded),
 * comme dans la sidebar de Heldert (les icônes de menu y sont inline).
 */
type IconProps = { className?: string };

const Icon: React.FC<IconProps & { children: React.ReactNode }> = ({
  className = "size-6",
  children,
}) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

export const IconDashboard = ({ className }: IconProps) => (
  <Icon className={className}>
    <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
    <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
    <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
  </Icon>
);

export const IconRaader = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
  </Icon>
);

export const IconPleiter = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M12 3v18" />
    <path d="M5 6h14" />
    <path d="M5 6 2.5 12a3 3 0 0 0 5 0L5 6Z" />
    <path d="M19 6l-2.5 6a3 3 0 0 0 5 0L19 6Z" />
    <path d="M8 21h8" />
  </Icon>
);

export const IconNormer = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M12 3 4.5 6v5c0 4.5 3 8.5 7.5 10 4.5-1.5 7.5-5.5 7.5-10V6L12 3Z" />
    <path d="m9 12 2 2 4-4" />
  </Icon>
);

export const IconDocuments = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
    <path d="M14 3v5h5" />
    <path d="M9 13h6" />
    <path d="M9 17h6" />
  </Icon>
);

export const IconUiKit = ({ className }: IconProps) => (
  <Icon className={className}>
    <circle cx="13.5" cy="6.5" r="2.5" />
    <path d="M12 22a10 10 0 1 1 10-10c0 2-1.5 3-3 3h-2.5a2.5 2.5 0 0 0-2 4c.5.7 0 3-2.5 3Z" />
    <circle cx="7.5" cy="10.5" r="1" fill="currentColor" stroke="none" />
    <circle cx="16.5" cy="11.5" r="1" fill="currentColor" stroke="none" />
  </Icon>
);

export const IconAdmin = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M19 8v6" />
    <path d="M22 11h-6" />
  </Icon>
);

export const IconMenu = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M4 6h16" />
    <path d="M4 12h16" />
    <path d="M4 18h16" />
  </Icon>
);

export const IconSun = ({ className }: IconProps) => (
  <Icon className={className}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Icon>
);

export const IconMoon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
  </Icon>
);

export const IconLogout = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="m16 17 5-5-5-5" />
    <path d="M21 12H9" />
  </Icon>
);

export const IconBuilding = ({ className }: IconProps) => (
  <Icon className={className}>
    <rect x="4" y="3" width="16" height="18" rx="1.5" />
    <path d="M9 8h2M13 8h2M9 12h2M13 12h2M9 16h2M13 16h2" />
  </Icon>
);

export const IconChevronDown = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
);

export const IconCheck = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M20 6 9 17l-5-5" />
  </Icon>
);
