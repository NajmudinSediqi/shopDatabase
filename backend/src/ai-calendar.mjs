export const AFGHAN_MONTHS = [
  "حمل",
  "ثور",
  "جوزا",
  "سرطان",
  "اسد",
  "سنبله",
  "میزان",
  "عقرب",
  "قوس",
  "جدی",
  "دلو",
  "حوت",
];

function parts(date, calendar) {
  return Object.fromEntries(
    new Intl.DateTimeFormat(`en-US-u-ca-${calendar}-nu-latn`, {
      timeZone: "Asia/Kabul",
      year: "numeric",
      month: "numeric",
      day: "numeric",
    })
      .formatToParts(date)
      .map(({ type, value }) => [type, value]),
  );
}

export function kabulDate(date) {
  const { year, month, day } = parts(date, "gregory");
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function shamsiDateLabel(date) {
  const instant =
    typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? new Date(`${date}T12:00:00Z`)
      : new Date(date);
  const { year, month, day } = parts(instant, "persian");
  return `${day} ${AFGHAN_MONTHS[Number(month) - 1]} ${year}`;
}

export function assistantCalendar(now = new Date()) {
  const today = kabulDate(now);
  const noon = new Date(`${today}T12:00:00Z`);
  const current = parts(noon, "persian");
  const start = new Date(noon.getTime() - (Number(current.day) - 1) * 86400000);
  const previousEnd = new Date(start.getTime() - 86400000);
  const previous = parts(previousEnd, "persian");
  const previousStart = new Date(previousEnd.getTime() - (Number(previous.day) - 1) * 86400000);
  const month = (value, from, to) => ({
    name: AFGHAN_MONTHS[Number(value.month) - 1],
    year: Number(value.year),
    period: `${value.year}-${value.month.padStart(2, "0")}`,
    from: kabulDate(from),
    to: kabulDate(to),
  });
  return {
    timezone: "Asia/Kabul",
    today,
    today_shamsi: shamsiDateLabel(noon),
    current_month_to_date: month(current, start, noon),
    previous_month: month(previous, previousStart, previousEnd),
  };
}
