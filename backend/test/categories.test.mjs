import { test } from "node:test";
import assert from "node:assert/strict";
import { validateCategory } from "../src/categories.mjs";

test("category names and all eight business-card icons are validated", () => {
  for (const icon of [
    "trimmer",
    "epilator",
    "beauty",
    "flashlight",
    "mp3",
    "speaker",
    "calculator",
    "powerbank",
    null,
  ]) {
    const data = { name: "  دسته نمونه  ", icon };
    validateCategory(data, "insert");
    assert.equal(data.name, "دسته نمونه");
  }
  assert.doesNotThrow(() => validateCategory({ icon: null }, "update"));
  for (const name of ["", "  ", null, 123, "x".repeat(256)])
    assert.throws(() => validateCategory({ name }, "insert"));
});

test("custom category icons accept raster images and reject unsafe or oversized values", () => {
  const png =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXs0AAAAASUVORK5CYII=";
  assert.doesNotThrow(() => validateCategory({ icon: png }, "update"));
  for (const icon of [
    "unknown",
    "https://example.com/icon.png",
    "data:image/svg+xml;base64,PHN2Zz4=",
    "data:image/png;base64,AAAA",
    123,
    [],
    `data:image/png;base64,${Buffer.alloc(128 * 1024 + 1).toString("base64")}`,
  ])
    assert.throws(() => validateCategory({ icon }, "update"));
});
