import type { CustomerBill } from "./customer-bill";
export const PREVIEW_BILL: CustomerBill = {
  invoice_no: 1024,
  date: "2026-11-13",
  currency: "AFN",
  total: 10500,
  discount: 500,
  paid: 4000,
  notes: "نمونه پیش‌نمایش؛ این فاکتور ثبت نمی‌شود.",
  customers: { name: "مشتری نمونه", phone: "0700 000 000", address: "کابل" },
  sale_items: [
    {
      qty: 2,
      unit_price: 2500,
      unit_kind: "piece",
      pieces: 2,
      products: { name: "ماشین اصلاح شارژی" },
    },
    { qty: 5, unit_price: 800, unit_kind: "piece", pieces: 5, products: { name: "چراغ‌قوه دستی" } },
    { qty: 1, unit_price: 1500, unit_kind: "piece", pieces: 1, products: { name: "پاوربانک" } },
  ],
  customer_payments: [{ date: "2026-11-13", amount: 1000, note: "پرداخت نقدی" }],
};
