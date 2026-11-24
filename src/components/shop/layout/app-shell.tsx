import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  LogOut,
  Search,
  X,
  Store,
  Clock,
  ChevronLeft,
  Coins,
  Radio,
  ShieldOff,
  UserRound,
  ChevronDown,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { loadDisplayPref, setCurrencyState, useCurrencyState } from "@/lib/currency";
import { CurrencyMenu } from "./currency-menu";
import { useSidebarThemePreference } from "@/lib/sidebar-theme";
import { num } from "@/lib/format";
import {
  NAV,
  findNav,
  navMatches,
  canOpenPage,
  type NavGroup,
  type NavItem,
} from "@/components/shop/layout/nav";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  useSidebar,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { api } from "@/integrations/api/client";
import { useMe, useSettings } from "@/hooks/use-me";
import { useBranding } from "@/hooks/use-branding";
import { faviconUrl } from "@/lib/branding-shared";
import { HeaderClock } from "./header-clock";
import { AppLoading } from "@/components/ui/app-loading";

/** Expandable workflow heading for the sidebar. */
function GroupHeading({ group, isOpen }: { group: NavGroup; isOpen: boolean }) {
  const Icon = group.icon;
  return (
    <CollapsibleTrigger asChild>
      <SidebarGroupLabel asChild>
        <button
          type="button"
          className="h-10 w-full cursor-pointer justify-between rounded-xl border border-sidebar-border/70 bg-sidebar-accent/40 px-2.5 transition-colors hover:bg-sidebar-accent/80 hover:text-sidebar-foreground group-data-[collapsible=icon]:hidden"
          aria-expanded={isOpen}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <Icon className="size-3.5" />
            </span>
            <span className="truncate text-xs font-bold text-sidebar-foreground">
              {group.label}
            </span>
          </span>
          <ChevronDown
            aria-hidden="true"
            className={`size-4 shrink-0 text-sidebar-foreground/60 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          />
        </button>
      </SidebarGroupLabel>
    </CollapsibleTrigger>
  );
}

function CloseOnNav({
  to,
  children,
  ...rest
}: { to: string; children: ReactNode } & Record<string, unknown>) {
  const { isMobile, setOpenMobile } = useSidebar();
  return (
    <Link {...rest} to={to} onClick={() => isMobile && setOpenMobile(false)}>
      {children}
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  useSidebarThemePreference();
  const branding = useBranding();
  const { data: me, isLoading, error: accessError } = useMe();
  const { data: settings } = useSettings();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const crumb = findNav(path);
  const cur = useCurrencyState();
  const [q, setQ] = useState("");
  const [openGroup, setOpenGroup] = useState<string | null>(
    () => crumb?.group.label ?? NAV[0]?.label ?? null,
  );
  const match = (label: string, group: string, query = q) => {
    const t = query.trim();
    return !t || label.includes(t) || group.includes(t);
  };
  useEffect(() => loadDisplayPref(), []);
  useEffect(() => {
    const activeGroup = findNav(path)?.group.label;
    if (activeGroup) setOpenGroup(activeGroup);
  }, [path]);
  const canSee = (i: NavItem) =>
    i.admin
      ? !!me?.isAdmin
      : i.anyPerm
        ? i.anyPerm.some((code) => me?.can(code))
        : !i.perm || !!me?.can(i.perm);
  function searchPages(value: string) {
    setQ(value);
    if (!value.trim()) return;
    const firstMatch = NAV.find((group) =>
      group.items.some((item) => canSee(item) && match(item.label, group.label, value)),
    );
    if (firstMatch) setOpenGroup(firstMatch.label);
  }

  async function signOut() {
    const { error } = await api.auth.signOut();
    if (error) {
      toast.error(error.message);
      return;
    }
    await qc.cancelQueries();
    qc.clear();
    navigate({ to: "/auth", replace: true });
  }

  if (isLoading) {
    return <AppLoading fullScreen />;
  }

  if (me && !me.isMember && path !== "/profile") {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border bg-card p-8 text-center shadow-soft">
          <Clock className="mx-auto size-10 text-gold" />
          <h1 className="mt-4 text-xl font-bold">حساب شما در انتظار تأیید است</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            مدیر فروشگاه باید برای حساب شما نقش تعیین کند. پس از تأیید، صفحه را دوباره باز کنید.
          </p>
          <Button asChild variant="outline" className="mt-6">
            <Link to="/profile">
              <UserRound /> ویرایش پروفایل
            </Link>
          </Button>
          <Button variant="outline" className="mt-6" onClick={signOut}>
            <LogOut /> خروج
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <Sidebar side="right" collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-1 py-1.5 md:gap-3 md:py-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white text-sidebar md:size-9">
              <img
                src={faviconUrl(branding.branding_version)}
                className="size-6 object-contain"
                alt=""
              />
            </div>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <div className="truncate text-[13px] font-bold md:text-base">
                {branding.platform_title}
              </div>
              <div className="text-[10px] opacity-70 md:text-xs">مدیریت فروشگاه و حسابات</div>
            </div>
          </div>
        </SidebarHeader>
        <div className="px-2 pb-1 group-data-[collapsible=icon]:hidden">
          <div className="relative">
            <Search className="pointer-events-none absolute start-2 top-1/2 size-3.5 -translate-y-1/2 text-sidebar-foreground/50" />
            <input
              value={q}
              onChange={(e) => searchPages(e.target.value)}
              placeholder="جستجوی صفحه…"
              aria-label="جستجوی صفحه"
              className="h-8 w-full rounded-lg border border-sidebar-border bg-sidebar-accent/50 ps-7 pe-7 text-xs text-sidebar-foreground outline-none placeholder:text-sidebar-foreground/50 focus:ring-1 focus:ring-sidebar-ring"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                aria-label="پاک کردن"
                className="absolute end-2 top-1/2 -translate-y-1/2 text-sidebar-foreground/60"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>
        <SidebarContent>
          {q.trim() &&
            !NAV.some((g) => g.items.some((i) => canSee(i) && match(i.label, g.label))) && (
              <p className="px-4 py-6 text-center text-xs text-sidebar-foreground/60">
                صفحه‌ای پیدا نشد
              </p>
            )}
          {NAV.map((g) => {
            const items = g.items.filter((i) => canSee(i) && match(i.label, g.label));
            if (!items.length) return null;
            const isOpen = openGroup === g.label;
            return (
              <Collapsible
                key={g.label}
                open={isOpen}
                onOpenChange={(open) =>
                  setOpenGroup((current) => {
                    if (open) return g.label;
                    return current === g.label ? null : current;
                  })
                }
                className="group/collapsible"
              >
                <SidebarGroup className="px-2 py-1 md:px-2 md:py-1">
                  <GroupHeading group={g} isOpen={isOpen} />
                  <CollapsibleContent className="sidebar-nav-content group-data-[collapsible=icon]:!animate-none">
                    <SidebarGroupContent className="pt-1">
                      <SidebarMenu className="gap-0.5 border-s border-sidebar-border/70 ms-5 ps-2">
                        {items.map((i) => (
                          <SidebarMenuItem key={i.to}>
                            <SidebarMenuButton
                              asChild
                              isActive={navMatches(path, i.to)}
                              tooltip={i.label}
                              className="h-9 text-xs md:text-sm [&>svg]:size-3.5 md:[&>svg]:size-4"
                            >
                              <CloseOnNav to={i.to}>
                                <i.icon />
                                <span>{i.label}</span>
                              </CloseOnNav>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        ))}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </CollapsibleContent>
                </SidebarGroup>
              </Collapsible>
            );
          })}
        </SidebarContent>
        <SidebarFooter className="gap-0 border-t border-sidebar-border/70 p-2 md:p-3">
          <div className="flex items-center gap-2 rounded-xl bg-sidebar-accent/60 p-1.5 ring-1 ring-sidebar-border/60 md:gap-3 md:p-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-[12px] font-bold text-sidebar-primary-foreground md:size-9 md:text-sm">
              {(me?.profile?.full_name ?? "؟").slice(0, 1)}
            </div>
            <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <div className="truncate text-[12px] font-bold md:text-sm">
                {me?.profile?.full_name ?? "کاربر"}
              </div>
              <div className="truncate text-[10px] text-sidebar-foreground/70 md:text-xs">
                {me?.roleName ?? "بدون نقش"}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={signOut}
              aria-label="خروج"
              title="خروج"
              className="size-7 shrink-0 rounded-lg text-sidebar-foreground/80 hover:bg-sidebar-primary hover:text-sidebar-primary-foreground md:size-8"
            >
              <LogOut className="size-3.5 md:size-4" />
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="compact min-w-0 overflow-x-clip">
        <header className="app-header sticky top-0 z-10 flex h-16 flex-nowrap items-center gap-2 border-b bg-background/95 px-3 py-2 backdrop-blur md:gap-3 md:px-5">
          <SidebarTrigger className="md:hidden" />
          <nav className="hidden min-w-0 items-center gap-1 truncate text-[11px] text-muted-foreground sm:flex md:gap-1.5 md:text-sm">
            {crumb && (
              <>
                <crumb.group.icon className="hidden size-4 xl:block" />
                <span className="hidden xl:inline">{crumb.group.label}</span>
                <ChevronLeft className="hidden size-3.5 xl:block" />
                <span className="truncate text-[13px] font-bold text-foreground md:text-sm md:font-medium">
                  {crumb.item.label}
                </span>
              </>
            )}
          </nav>
          <div className="ms-auto shrink-0">
            <HeaderClock />
          </div>
          <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
            <span
              className="hidden items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs tabular xl:inline-flex"
              title={settings?.rate_mode === "auto" ? "نرخ زنده بازار" : "نرخ دستی"}
            >
              {settings?.is_live ? (
                <Radio className="size-3 text-success md:size-3.5" />
              ) : (
                <Coins className="size-3 text-gold md:size-3.5" />
              )}
              1$ = {num(settings?.usd_to_afn ?? 0)} ؋
            </span>
            <CurrencyMenu
              value={cur.display}
              onValueChange={(display) => setCurrencyState({ display })}
            />
            <Link
              to="/profile"
              aria-label="رفتن به پروفایل"
              title="پروفایل من"
              className="flex size-8 items-center justify-center overflow-hidden rounded-full bg-primary text-[11px] font-bold text-primary-foreground ring-offset-background transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Avatar className="size-full">
                <AvatarImage src={me?.profile?.avatar_url ?? undefined} alt="" />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {(me?.profile?.full_name ?? "؟").slice(0, 1)}
                </AvatarFallback>
              </Avatar>
            </Link>
          </div>
        </header>
        <div key={`${cur.display}-${cur.rate}`} className="w-full min-w-0 p-3 md:p-8">
          {accessError || !me || !canOpenPage(path, me.can, me.isAdmin) ? (
            <div className="mx-auto mt-10 max-w-md rounded-2xl border bg-card p-8 text-center shadow-soft">
              <ShieldOff className="mx-auto size-10 text-destructive" />
              <h1 className="mt-4 text-lg font-bold">به این صفحه دسترسی ندارید</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                برای دیدن این صفحه از مدیر فروشگاه بخواهید مجوز لازم را به نقش شما بدهد.
              </p>
            </div>
          ) : (
            <div key={`${me.user.id}:${me.isAdmin}:${[...me.perms].sort().join(",")}`}>
              {children}
            </div>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
