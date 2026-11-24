import { useEffect, useState, useSyncExternalStore } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { digits } from "@/lib/format";
import { cn } from "@/lib/utils";

/** صفحه‌بندی یک لیست: const pg = usePaged(list); سپس pg.items.map(...) و <Pager {...pg} /> */
// هنگام چاپ، همه ردیف‌های فیلترشده (نه فقط صفحه فعلی) نمایش داده می‌شوند.
let printAll = false;
const subs = new Set<() => void>();
export function setPrintAll(v: boolean) {
  printAll = v;
  subs.forEach((f) => f());
}
function usePrintAll() {
  return useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => printAll,
    () => false,
  );
}

export function usePaged<T>(list: T[], size = 10) {
  const all = usePrintAll();
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(list.length / size));
  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages]);
  const p = Math.min(page, pages);
  if (all) return { items: list, page: p, pages, total: list.length, size, setPage };
  return {
    items: list.slice((p - 1) * size, p * size),
    page: p,
    pages,
    total: list.length,
    size,
    setPage,
  };
}

function pageList(page: number, pages: number): (number | "…")[] {
  if (pages <= 5) return Array.from({ length: pages }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const s = Math.max(2, page - 1);
  const e = Math.min(pages - 1, page + 1);
  if (s > 2) out.push("…");
  for (let i = s; i <= e; i++) out.push(i);
  if (e < pages - 1) out.push("…");
  out.push(pages);
  return out;
}

/** نوار صفحه‌بندی: قبلی · شماره صفحات · بعدی */
export function Pager({
  page,
  pages,
  total,
  size,
  setPage,
}: {
  page: number;
  pages: number;
  total: number;
  size: number;
  setPage: (p: number) => void;
}) {
  const from = total === 0 ? 0 : (page - 1) * size + 1;
  const to = Math.min(total, page * size);
  return (
    <div dir="rtl" className="table-pagination flex flex-wrap items-center justify-between gap-3 border-t border-border bg-card px-4 py-3 md:px-5">
      <div className="text-[11px] text-muted-foreground md:text-xs">
        {digits(from)}–{digits(to)} از {digits(total)}
      </div>
      <nav className="flex items-center gap-1" aria-label="صفحه‌بندی">
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1 px-2"
          disabled={page === 1}
          aria-label="صفحه قبلی"
          onClick={() => setPage(page - 1)}
        >
          <ChevronRight className="size-4" />
          <span className="hidden sm:inline">قبلی</span>
        </Button>
        {pageList(page, pages).map((n, i) =>
          n === "…" ? (
            <span key={`d${i}`} className="px-1 text-xs text-muted-foreground">
              …
            </span>
          ) : (
            <Button
              key={n}
              size="sm"
              variant="ghost"
              className={cn("size-8 p-0 text-xs tabular", n === page && "border border-border bg-muted font-semibold text-foreground")}
              onClick={() => setPage(n)}
              aria-current={n === page ? "page" : undefined}
            >
              {digits(n)}
            </Button>
          ),
        )}
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1 px-2"
          disabled={page === pages}
          aria-label="صفحه بعدی"
          onClick={() => setPage(page + 1)}
        >
          <span className="hidden sm:inline">بعدی</span>
          <ChevronLeft className="size-4" />
        </Button>
      </nav>
    </div>
  );
}
