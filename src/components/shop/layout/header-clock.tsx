import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import { headerDateTime } from "@/lib/format";

export function HeaderClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const update = () => setNow(new Date());
    update();
    const timer = window.setInterval(update, 1000);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  const value = now ? headerDateTime(now) : null;
  return (
    <div className="header-clock" dir="rtl" title="تاریخ شمسی و ساعت به وقت کابل">
      <div className="header-clock-calendar">
        <span className="header-clock-icon" aria-hidden="true">
          <CalendarDays size={17} strokeWidth={1.6} />
        </span>
        <span className="header-clock-date">{value?.date ?? "—"}</span>
        <span className="header-clock-short-date" dir="ltr">
          {value?.shortDate ?? "—"}
        </span>
      </div>
      <div className="header-clock-time">
        <time
          dateTime={now?.toISOString()}
          aria-label={value ? `ساعت ${value.time} به وقت کابل` : "ساعت کابل"}
          aria-live="off"
          dir="ltr"
        >
          {value?.time ?? "--:--:--"}
        </time>
      </div>
    </div>
  );
}
