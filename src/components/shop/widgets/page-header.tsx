import { type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { findNav } from "@/components/shop/layout/nav";

/**
 * عنوان بالای هر صفحه + دکمه‌های عملیات.
 * برای کوچک/بزرگ کردن عنوان صفحه، کلاس‌های h1 را همین‌جا عوض کنید.
 */
export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const Icon = findNav(path)?.item.icon;
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4 md:mb-8">
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <div className="mt-1 flex size-7 shrink-0 items-center justify-center text-muted-foreground">
            <Icon className="size-5" strokeWidth={1.5} />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{title}</h1>
          {description && <p className="mt-1.5 max-w-2xl text-xs leading-6 text-muted-foreground md:text-[13px]">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-1.5 md:gap-2">{actions}</div>}
    </div>
  );
}
