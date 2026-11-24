import { Children, isValidElement, useRef, type ReactNode } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { printTable } from "@/lib/print";
import type { PrintMetadata } from "@/lib/print-design";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shop/widgets/empty-state";
import { Pager } from "./pager";
import { num } from "@/lib/format";
import { useMe } from "@/hooks/use-me";

/**
 * قاب سفید جدول + نوار جستجو بالای آن.
 * toolbar = هر چیزی که می‌خواهید بالای جدول باشد (جستجو، فیلتر…).
 */
export function TableCard({
  children,
  toolbar,
  title,
  count,
  onPrint,
  printDisabled = false,
  printMetadata,
}: {
  children: ReactNode;
  toolbar?: ReactNode;
  title?: string | undefined;
  count?: number;
  onPrint?: (() => void) | undefined;
  printDisabled?: boolean;
  printMetadata?: PrintMetadata;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { data: me } = useMe();
  const sections = Children.toArray(children);
  const isPager = (child: ReactNode) => isValidElement(child) && child.type === Pager;
  return (
    <Card dir="rtl" className="table-card min-w-0 gap-0 overflow-hidden bg-card p-0">
      {(title || count !== undefined) && (
        <div className="flex items-center gap-2 border-b px-4 py-4 md:px-5">
          {title && <h2 className="text-[13px] font-semibold">{title}</h2>}
          {count !== undefined && (
            <span className="rounded-md border bg-muted/40 px-1.5 py-0.5 text-[11px] tabular text-muted-foreground">
              {num(count)}
            </span>
          )}
        </div>
      )}
      <div className="table-toolbar flex min-h-16 flex-wrap items-center gap-2 border-b bg-card px-4 py-3 md:px-5">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{toolbar}</div>
        {me?.can("documents.print") && (
          <Button
            variant="outline"
            size="sm"
            className="ms-auto h-9 shrink-0 gap-2 border-border bg-card text-xs text-muted-foreground shadow-none hover:bg-muted hover:text-foreground"
            disabled={printDisabled}
            onClick={() =>
              onPrint ? onPrint() : ref.current && printTable(ref.current, title, printMetadata)
            }
          >
            <Printer /> چاپ / PDF
          </Button>
        )}
      </div>
      <div ref={ref} className="min-w-0 [&_table]:min-w-full">
        {sections.filter((child) => !isPager(child))}
      </div>
      {sections.filter(isPager)}
    </Card>
  );
}

/** ردیف «خالی» وسط جدول: آیکون + عنوان + توضیح. */
export function EmptyRow({
  cols,
  text = "هیچ موردی ثبت نشده است",
  hint,
  icon,
}: {
  cols: number;
  text?: string;
  hint?: string;
  icon?: LucideIcon;
}) {
  return (
    <tr>
      <td colSpan={cols} className="p-0">
        <EmptyState icon={icon} title={text} hint={hint} />
      </td>
    </tr>
  );
}
