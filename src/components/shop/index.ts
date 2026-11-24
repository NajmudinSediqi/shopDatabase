/**
 * همه قطعه‌های این برنامه از یک جا import می‌شوند:
 *   import { PageHeader, StatCard, TableCard } from "@/components/shop";
 *
 * اگر قطعه جدیدی ساختید، همین‌جا یک خط export اضافه کنید.
 */
export { AppShell } from "./layout/app-shell";
export { NAV, findNav, type NavGroup, type NavItem } from "./layout/nav";

export { PageHeader } from "./widgets/page-header";
export { StatCard } from "./widgets/stat-card";
export { TableCard, EmptyRow } from "./widgets/table-card";
export { NameCell } from "./widgets/name-cell";
export { Field } from "./widgets/field";
export { DateRangeFilter } from "./widgets/date-range-filter";
export { TableDate } from "./widgets/table-date";
export { CurrencySelect, OptionSelect } from "./widgets/selects";
export { JalaliDateInput } from "./widgets/jalali-date";
export { ConfirmDelete } from "./widgets/confirm-delete";
export { EmptyState } from "./widgets/empty-state";
export { SearchInput } from "./widgets/search-input";
export { Pager, usePaged } from "./widgets/pager";
export { errMsg } from "./widgets/error-message";

export { TrendChart } from "./charts/trend-chart";
export { InvoiceList } from "./invoices/invoice-list";
export { InvoiceDialog } from "./invoices/invoice-dialog";
export { PartyPage } from "./contacts/party-page";
