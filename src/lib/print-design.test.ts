import { expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { buildReceiptReport, buildTableReport, preparePrintTable } from "./print-design";
import { jDate, money, num } from "./format";

function table(html: string) {
  const doc = new DOMParser().parseFromString(`<table>${html}</table>`, "text/html");
  return doc.querySelector("table")!;
}

it("prints escaped supplier identity, the selected date range and print date in the repeating header", () => {
  const source = table(
    "<thead><tr><th>تاریخ</th><th>جنس</th><th data-noprint>عملیات ارسال</th></tr></thead><tbody><tr><td>30 عقرب 1405</td><td>ماشین اصلاح</td><td><button>ویرایش</button></td></tr></tbody>",
  );
  const html = buildTableReport(
    source,
    "ارسال جنس به تأمین‌کننده",
    new Date("2026-11-21T12:00:00Z"),
    [
      { label: "نام تأمین‌کننده", value: "دکان احمد و برادران" },
      { label: "بازه تاریخ شمسی", value: "1 عقرب 1405 تا 30 عقرب 1405" },
    ],
  );
  const doc = new DOMParser().parseFromString(html, "text/html");
  const header = doc.querySelector("thead .report-header")!;
  expect(header.textContent).toContain("دکان احمد و برادران");
  expect(header.textContent).toContain("1 عقرب 1405 تا 30 عقرب 1405");
  expect(header.textContent).toContain(jDate(new Date("2026-11-21T12:00:00Z")));
  expect(doc.body.textContent).not.toContain("عملیات ارسال");
  const escaped = buildTableReport(source, "عنوان", new Date(), [
    { label: "نام", value: '<img src=x onerror="alert(1)">' },
  ]);
  expect(new DOMParser().parseFromString(escaped, "text/html").querySelector("img")).toBeNull();
  if (process.env["REPORT_PREVIEW_DIR"])
    writeFileSync(`${process.env["REPORT_PREVIEW_DIR"]}/supplier-report.html`, html);
});

it("removes action columns and controls without changing data or the original table", () => {
  const original = table(
    `<thead><tr><th>نام</th><th>مبلغ</th><th>عملیات</th><th></th></tr></thead><tbody><tr><td><button>احمد</button></td><td class="min-w-40" style="width:400px">1,250 ؋</td><td><button>حذف</button></td><td><input type="checkbox"></td></tr><tr><td colspan="4">هیچ موردی</td></tr></tbody>`,
  );
  const printable = preparePrintTable(original);
  expect(printable.tHead!.rows[0]!.cells).toHaveLength(2);
  expect(printable.tBodies[0]!.rows[0]!.cells).toHaveLength(2);
  expect(printable.tBodies[0]!.rows[1]!.cells[0]!.colSpan).toBe(2);
  expect(printable.textContent).toContain("احمد");
  expect(printable.textContent).toContain("1,250 ؋");
  expect(printable.textContent).not.toContain("حذف");
  expect(printable.querySelector("button,input,[style]")).toBeNull();
  expect(printable.querySelector(".numeric")?.textContent).toBe("1,250 ؋");
  expect(original.querySelectorAll("button")).toHaveLength(2);
});

it("keeps report headings repeatable, escapes titles and counts all bodies", () => {
  const source = table(
    "<thead><tr><th>نام</th><th>مبلغ</th></tr></thead><tbody><tr><td>اول</td><td>100</td></tr></tbody><tbody><tr><td>دوم</td><td>200</td></tr></tbody>",
  );
  const html = buildTableReport(source, "<img src=x onerror=bad()>", new Date(2026, 10, 15));
  const doc = new DOMParser().parseFromString(html, "text/html");
  expect(doc.querySelector("thead .report-header h1")?.textContent).toBe(
    "<img src=x onerror=bad()>",
  );
  expect(doc.querySelector("img,script")).toBeNull();
  expect(doc.querySelector(".report-meta")?.textContent).toContain("2");
  expect(doc.querySelector(".report-meta")?.textContent).toContain("1405/08/24");
  expect(html).toContain("A4 portrait");
  expect(html).not.toContain("fonts.googleapis");
});

it("formats long and wide report samples without dropping rows, dates or currencies", () => {
  for (const wide of [false, true]) {
    const columns = [
      "شماره",
      "تاریخ",
      "نام مشتری",
      "شرح",
      "مبلغ افغانی",
      "مبلغ دالری",
      ...(wide ? ["پرداخت", "باقی", "وضعیت"] : []),
    ];
    const source = table(
      `<thead><tr>${columns.map((c) => `<th>${c}</th>`).join("")}<th>عملیات</th></tr></thead><tbody>${Array.from({ length: 60 }, (_, i) => `<tr><td>${num(i + 1)}</td><td>${jDate("2026-11-15")}</td><td>مشتری نمونه ${num(i + 1)}</td><td>شرح اجناس و جزئیات پرداخت برای بررسی حساب مشتری</td><td>${money(1250 + i)}</td><td>${money(25, "USD")}</td>${wide ? `<td>${money(1000)}</td><td>${money(250 + i)}</td><td>باقی‌مانده</td>` : ""}<td><button>ویرایش</button></td></tr>`).join("")}</tbody>`,
    );
    const html = buildTableReport(
      source,
      wide ? "گزارش فروش و پرداخت‌ها" : "گزارش حساب مشتریان",
      new Date(2026, 10, 15),
    );
    const doc = new DOMParser().parseFromString(html, "text/html");
    expect(doc.querySelectorAll("tbody > tr")).toHaveLength(60);
    expect(html).toContain(wide ? "A4 landscape" : "A4 portrait");
    expect(doc.body.textContent).toContain("25 $");
    expect(doc.querySelectorAll(".date-cell")).toHaveLength(60);
    if (process.env["REPORT_PREVIEW_DIR"])
      writeFileSync(
        `${process.env["REPORT_PREVIEW_DIR"]}/${wide ? "wide" : "standard"}-report.html`,
        html,
      );
  }
});

it("applies the table design to receipt details and removes print controls", () => {
  const source = document.createElement("div");
  source.innerHTML =
    '<div><p>تأمین‌کننده: احمد</p></div><div><h2>اجناس</h2><div class="table-toolbar"><button>چاپ</button></div><table><thead><tr><th>جنس</th><th>مبلغ</th></tr></thead><tbody><tr><td>ماشین اصلاح</td><td>500 ؋</td></tr></tbody></table></div><div><p>مجموع: 500 ؋</p></div>';
  const doc = new DOMParser().parseFromString(
    buildReceiptReport(source, "فاکتور خرید"),
    "text/html",
  );
  expect(doc.querySelector("button,.table-toolbar")).toBeNull();
  expect(doc.querySelector(".receipt-content table .numeric")?.textContent).toBe("500 ؋");
  expect(doc.querySelector(".receipt-content")?.textContent).toContain("تأمین‌کننده: احمد");
  expect(doc.querySelector("h1")?.textContent).toBe("فاکتور خرید");
  if (process.env["REPORT_PREVIEW_DIR"])
    writeFileSync(
      `${process.env["REPORT_PREVIEW_DIR"]}/receipt-report.html`,
      buildReceiptReport(source, "فاکتور خرید"),
    );
});
