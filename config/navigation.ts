/** Customer-site navigation — shared by the desktop top-bar and mobile tabs. */

export type IconName =
  | "home"
  | "calendar"
  | "gift"
  | "user"
  | "mappin"
  | "info";

export interface NavItem {
  label: string;
  href: string;
  icon: IconName;
}

/** Desktop top navigation (left of the "Book a Session" button). */
export const desktopNav: NavItem[] = [
  { label: "Home", href: "/visit", icon: "home" },
  { label: "How It Works", href: "/visit/how-it-works", icon: "info" },
  { label: "Sessions & Prices", href: "/visit/sessions", icon: "calendar" },
  { label: "Promotions", href: "/visit/sessions#promotions", icon: "gift" },
  { label: "Find Us", href: "/visit/find-us", icon: "mappin" },
];

/** Mobile bottom navigation — four simple tabs. */
export const mobileNav: NavItem[] = [
  { label: "Home", href: "/visit", icon: "home" },
  { label: "Sessions", href: "/visit/sessions", icon: "calendar" },
  { label: "Promotions", href: "/visit/sessions#promotions", icon: "gift" },
  { label: "Account", href: "/visit/account", icon: "user" },
];
