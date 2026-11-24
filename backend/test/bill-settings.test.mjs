import { test } from "node:test";
import assert from "node:assert/strict";
import { validateBillSettings } from "../src/bill-settings.mjs";
import { readFileSync } from "node:fs";
test("bill settings accept safe themes and layout switches", () => {
  assert.doesNotThrow(() =>
    validateBillSettings({
      primaryColor: "#09256b",
      accentColor: "#d40b20",
      title: "فاکتور فروش",
      showLogo: true,
      minimumRows: 6,
    }),
  );
});
test("bill settings reject CSS injection, invalid switches, excess rows and unknown fields", () => {
  for (const value of [
    null,
    [],
    { primaryColor: "red; color:white" },
    { accentColor: "#fff" },
    { showLogo: "true" },
    { minimumRows: 11 },
    { minimumRows: 1.5 },
    { logoUrl: "javascript:bad()" },
    { terms: "x".repeat(1001) },
  ])
    assert.throws(() => validateBillSettings(value));
});
test("QR settings accept the owner's raster image and removal but reject executable or oversized content", () => {
  const bytes = readFileSync(new URL("../../src/assets/noor-whatsapp-qr.jpg", import.meta.url));
  assert.doesNotThrow(() =>
    validateBillSettings({
      qrCodeImage: `data:image/jpeg;base64,${bytes.toString("base64")}`,
      qrCaption: "واتساپ",
      showQrCode: true,
    }),
  );
  assert.doesNotThrow(() => validateBillSettings({ qrCodeImage: "" }));
  for (const qrCodeImage of [
    "javascript:bad()",
    "data:image/svg+xml;base64,PHN2Zz4=",
    "data:image/png;base64,AAAA",
    `data:image/jpeg;base64,${Buffer.alloc(256 * 1024 + 1).toString("base64")}`,
  ])
    assert.throws(() => validateBillSettings({ qrCodeImage }));
  assert.throws(() => validateBillSettings({ qrCaption: "x".repeat(121) }));
});
