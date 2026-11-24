import { assert } from "./errors.mjs";

export function validateInvoiceNumberSettings(settings) {
  for (const key of ["sale_invoice_prefix", "purchase_invoice_prefix"])
    assert(
      typeof settings[key] === "string" && /^[A-Z]{1,12}$/.test(settings[key]),
      400,
      "پیشوند فاکتور باید از 1 تا 12 حرف بزرگ انگلیسی باشد",
    );
  assert(
    settings.sale_invoice_prefix !== settings.purchase_invoice_prefix,
    400,
    "پیشوند فروش و خرید باید متفاوت باشد",
  );
  assert(
    Number.isInteger(settings.invoice_number_digits) &&
      settings.invoice_number_digits >= 3 &&
      settings.invoice_number_digits <= 10,
    400,
    "تعداد رقم فاکتور باید بین 3 تا 10 باشد",
  );
}

/** One locked counter per prefix, shared by both invoice kinds; deletion never resets it. */
export async function nextInvoiceCode(tx, kind) {
  const [settings] =
    await tx`SELECT sale_invoice_prefix,purchase_invoice_prefix,invoice_number_digits FROM settings WHERE id=1`;
  validateInvoiceNumberSettings(settings);
  const prefix = kind === "sale" ? settings.sale_invoice_prefix : settings.purchase_invoice_prefix;
  await tx`INSERT IGNORE INTO invoice_sequences(prefix,next_number) VALUES(${prefix},1)`;
  const [sequence] =
    await tx`SELECT next_number FROM invoice_sequences WHERE prefix=${prefix} FOR UPDATE`;
  const number = String(sequence.next_number);
  await tx`UPDATE invoice_sequences SET next_number=next_number+1 WHERE prefix=${prefix}`;
  return `${prefix}-${number.padStart(settings.invoice_number_digits, "0")}`;
}
