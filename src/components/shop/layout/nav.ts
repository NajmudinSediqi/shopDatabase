import {
  LayoutDashboard,
  Package,
  Warehouse,
  ShoppingCart,
  Truck,
  Users,
  Building2,
  Receipt,
  UserCog,
  BarChart3,
  ShieldCheck,
  ArrowLeftRight,
  Sparkles,
  PackageSearch,
  UserRound,
  HandCoins,
  Settings2,
  type LucideIcon,
} from "lucide-react";

/** `perm` = permission code needed to see the page; `admin` = owner-only page. */
export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  perm?: string;
  anyPerm?: string[];
  admin?: boolean;
};
export type NavGroup = { label: string; icon: LucideIcon; items: NavItem[] };

/** Navigation groups map to the main day-to-day shop workflows. */
export const NAV: NavGroup[] = [
  {
    label: "فروش و مشتریان",
    icon: ShoppingCart,
    items: [
      { to: "/sales", label: "فروش", icon: ShoppingCart, perm: "sales.view" },
      { to: "/sales-list", label: "لیست فروشات", icon: Receipt, perm: "sales.list.view" },
      { to: "/customers", label: "مشتریان", icon: Users, perm: "customers.view" },
    ],
  },
  {
    label: "خرید و تأمین‌کنندگان",
    icon: Truck,
    items: [
      { to: "/purchases", label: "خرید", icon: Truck, perm: "purchases.view" },
      { to: "/purchase-list", label: "لیست خرید", icon: Receipt, perm: "purchases.list.view" },
      { to: "/suppliers", label: "تأمین‌کنندگان", icon: Building2, perm: "suppliers.view" },
    ],
  },
  {
    label: "مصارف و معاشات",
    icon: HandCoins,
    items: [
      {
        to: "/expenses",
        label: "مصارف",
        icon: Receipt,
        anyPerm: ["expenses.view", "withdrawals.view"],
      },
      { to: "/employees", label: "کارمندان و معاشات", icon: UserCog, perm: "employees.view" },
    ],
  },
  {
    label: "گزارشات",
    icon: BarChart3,
    items: [
      { to: "/reports", label: "گزارشات", icon: BarChart3, perm: "reports.view" },
      { to: "/purchase-report", label: "گزارش خرید", icon: Truck, perm: "reports.purchase.view" },
      {
        to: "/product-report",
        label: "گزارش فروش اجناس",
        icon: PackageSearch,
        perm: "reports.products.view",
      },
    ],
  },
  {
    label: "انبار",
    icon: Warehouse,
    items: [
      { to: "/warehouse", label: "موجودی و ارزش انبار", icon: Warehouse, perm: "warehouse.view" },
      { to: "/stock-moves", label: "ورود و خروج انبار", icon: ArrowLeftRight, perm: "stock.view" },
      { to: "/products", label: "محصولات", icon: Package, perm: "products.view" },
    ],
  },
  {
    label: "عمومی",
    icon: LayoutDashboard,
    items: [
      { to: "/dashboard", label: "داشبورد", icon: LayoutDashboard, perm: "dashboard.view" },
      { to: "/assistant", label: "دستیار هوشمند", icon: Sparkles, admin: true },
    ],
  },
  {
    label: "مدیریت",
    icon: ShieldCheck,
    items: [
      { to: "/users", label: "کاربران، نقش‌ها و تنظیمات", icon: ShieldCheck, admin: true },
      { to: "/settings", label: "تنظیمات فروشگاه", icon: Settings2, perm: "settings.manage" },
    ],
  },
  {
    label: "حساب کاربری",
    icon: UserRound,
    items: [{ to: "/profile", label: "پروفایل من", icon: UserRound }],
  },
];

export function navMatches(path: string, destination: string) {
  return path === destination || path.startsWith(`${destination}/`);
}

export function findNav(path: string) {
  for (const g of NAV)
    for (const i of g.items) if (navMatches(path, i.to)) return { group: g, item: i };
  return null;
}

export function canOpenPage(path: string, can: (code: string) => boolean, isAdmin: boolean) {
  if (path.startsWith("/account/")) {
    const kind = path.split("/")[2];
    return kind === "customer"
      ? can("customers.view")
      : kind === "supplier" && can("suppliers.view");
  }
  const item = findNav(path)?.item;
  if (!item) return false;
  return item.admin
    ? isAdmin
    : item.anyPerm
      ? item.anyPerm.some(can)
      : !item.perm || can(item.perm);
}
