// ===========================================================================
// @holbert/ui — Design system Heldert (brand bordeaux via tokens.css)
// ===========================================================================

// Utils
export { cn } from "./utils/cn";

// Hooks
export { useModal } from "./hooks/useModal";
export { useDropzone } from "./hooks/useDropzone";
export { default as useGoBack } from "./hooks/useGoBack";

// Icons (SVG via svgr)
export * as Icons from "./icons";

// Toast (ToastProvider + useToast)
export * from "./components/toast/Toast";

// Common
export { default as ComponentCard } from "./components/common/ComponentCard";

// Alert
export { default as Alert } from "./components/alert/Alert";

// Avatar
export { default as Avatar } from "./components/avatar/Avatar";
export { default as AvatarText } from "./components/avatar/AvatarText";

// Badge
export { default as Badge } from "./components/badge/Badge";

// Breadcrumb
export { default as DefaultBreadCrumbExample } from "./components/breadcrumb/DefaultBreadCrumbExample";
export { default as BreadCrumbWithIcon } from "./components/breadcrumb/BreadCrumbWithIcon";
export { default as AngleDividerBreadCrumb } from "./components/breadcrumb/AngleDividerBreadCrumb";
export { default as DottedDividerBreadcrumb } from "./components/breadcrumb/DottedDividerBreadcrumb";

// Button
export { default as Button } from "./components/button/Button";

// Buttons group
export { default as ButtonGroupExample } from "./components/buttons-group/index";
export { default as PrimaryButtonGroup } from "./components/buttons-group/PrimaryButtonGroup";
export { default as SecondaryButtonGroup } from "./components/buttons-group/SecondaryButtonGroup";
export { default as ButtonGroupWithLeftIcon } from "./components/buttons-group/ButtonGroupWithLeftIcon";
export { default as ButtonGroupWithRightIcon } from "./components/buttons-group/ButtonGroupWithRightIcon";
export { default as SecondaryButtonGroupWithLeftIcon } from "./components/buttons-group/SecondaryButtonGroupWithLeftIcon";
export { default as SecondaryButtonGroupWithRightIcon } from "./components/buttons-group/SecondaryButtonGroupWithRightIcon";

// Card
export { Card, CardTitle, CardDescription } from "./components/card/index";

// Dropdown
export { Dropdown } from "./components/dropdown/Dropdown";
export { DropdownItem } from "./components/dropdown/DropdownItem";
export { default as AccountMenuDropdown } from "./components/dropdown/AccountMenuDropdown";
export { default as DropdownWithIcon } from "./components/dropdown/DropdownWithIcon";
export { default as DropdownWithDivider } from "./components/dropdown/DropdownWithDivider";
export { default as DropdownWithIconAndDivider } from "./components/dropdown/DropdownWithIconAndDivider";

// Link
export { default as Link } from "./components/link/index";

// Modal
export { Modal } from "./components/modal/index";

// Notification
export { default as Notification } from "./components/notification/Notfication";
export { default as CookieConsent } from "./components/notification/CookieConsent";
export { default as UpdateNotification } from "./components/notification/UpdateNotification";

// Pagination
export { default as PaginationExample } from "./components/pagination/index";
export { default as PaginationWithText } from "./components/pagination/PaginationWithText";
export { default as PaginationWithIcon } from "./components/pagination/PaginationWithIcon";
export { default as PaginationWithTextAndIcon } from "./components/pagination/PaginationWithTextAndIcon";

// Popover
export { default as Popover } from "./components/popover/Popover";
export { default as PopoverExample } from "./components/popover/index";
export { default as DefaultPopover } from "./components/popover/DefaultPopover";
export { default as PopoverButton } from "./components/popover/PopoverButton";
export { default as PopoverWithLink } from "./components/popover/PopoverWithLink";

// ProgressBar
export { default as ProgressBar } from "./components/progressbar/ProgressBar";
export { default as ProgressBarExample } from "./components/progressbar/index";
export { default as DefaultProgressbarExample } from "./components/progressbar/DefaultProgressbarExample";
export { default as ProgressBarInMultipleSizes } from "./components/progressbar/ProgressBarInMultipleSizes";
export { default as ProgressBarWithInsideLabel } from "./components/progressbar/ProgressBarWithInsideLabel";
export { default as ProgressBarWithOutsideLabel } from "./components/progressbar/ProgressBarWithOutsideLabel";

// Spinner
export { default as SpinnerOne } from "./components/spinner/SpinnerOne";
export { default as SpinnerTwo } from "./components/spinner/SpinnerTwo";
export { default as SpinnerThree } from "./components/spinner/SpinnerThree";
export { default as SpinnerFour } from "./components/spinner/SpinnerFour";
export { default as SpinnerExample } from "./components/spinner/index";

// Table
export {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
} from "./components/table/index";

// Tabs
export { default as TabExample } from "./components/tabs/index";
export { default as DefaultTab } from "./components/tabs/DefaultTab";
export {
  default as TabWithUnderline,
  TabButton,
} from "./components/tabs/TabWithUnderline";
export {
  default as TabWithUnderlineAndIcon,
  type TabData,
} from "./components/tabs/TabWithUnderlineAndIcon";
export { default as TabWithBadge } from "./components/tabs/TabWithBadge";
export { default as VerticalTabs } from "./components/tabs/VerticalTabs";

// Tooltip
export { default as Tooltip } from "./components/tooltip/Tooltip";
export { default as TooltipExample } from "./components/tooltip/index";
export { default as DefaultTooltip } from "./components/tooltip/DefaultTooltip";
export { default as TooltipPlacement } from "./components/tooltip/TooltipPlacement";
export { default as WhiteAndDarkTooltip } from "./components/tooltip/WhiteAndDarkTooltip";
