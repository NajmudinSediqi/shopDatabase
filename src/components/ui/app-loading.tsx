import { Store } from "lucide-react";
import { Skeleton } from "./skeleton";
import { cn } from "@/lib/utils";

export function AppLoading({
  fullScreen = false,
  label = "در حال آماده‌سازی فروشگاه",
}: {
  fullScreen?: boolean;
  label?: string;
}) {
  return (
    <div
      dir="rtl"
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn("app-loading", fullScreen && "app-loading-full")}
    >
      <div className="app-loading-content">
        <div className="app-loading-symbol" aria-hidden="true">
          <span className="app-loading-orbit" />
          <span className="app-loading-emblem">
            <Store size={28} strokeWidth={1.5} />
          </span>
          <span className="app-loading-dot" />
        </div>
        <p className="app-loading-title">{label}</p>
        <p className="app-loading-caption">چند لحظه همراه ما باشید…</p>
        <div className="app-loading-track" aria-hidden="true">
          <span />
        </div>
        <div className="app-loading-preview" aria-hidden="true">
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((item) => (
              <div className="rounded-xl border border-border/60 p-3" key={item}>
                <Skeleton className="mb-3 h-2 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-xl border border-border/60 p-4">
            <Skeleton className="mb-4 h-2 w-1/3" />
            {[0, 1, 2].map((item) => (
              <div key={item} className="mt-3 flex gap-4">
                <Skeleton className="h-2 flex-1" />
                <Skeleton className="h-2 w-1/4" />
                <Skeleton className="h-2 w-1/6" />
              </div>
            ))}
          </div>
        </div>
        <span className="sr-only">در حال بارگذاری اطلاعات</span>
      </div>
    </div>
  );
}
