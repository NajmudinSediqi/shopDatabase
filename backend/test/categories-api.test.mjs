import { test } from "node:test";
import assert from "node:assert/strict";
import { testDatabase } from "./database.mjs";
import { migrate } from "../src/migrate.mjs";
import { loadColumns, queryData } from "../src/data.mjs";

test("category icons persist through the data API and product joins with permission checks", async () => {
  const database = await testDatabase();
  const { sql } = database;
  try {
    await migrate(sql);
    await migrate(sql);
    const columns = await loadColumns(sql);
    const owner = {
      id: "00000000-0000-4000-8000-000000000099",
      admin: true,
      member: true,
      permissions: new Set(),
    };
    const reader = {
      id: "00000000-0000-4000-8000-000000000098",
      admin: false,
      member: true,
      permissions: new Set(["products.view"]),
    };
    const query = (table, request = {}, user = owner) =>
      queryData(sql, columns, user, { table, ...request });
    const seeded = await query("categories");
    assert.equal(seeded.length, 8);
    assert.equal(new Set(seeded.map((category) => category.icon)).size, 8);
    const [category] = await query("categories", {
      operation: "insert",
      values: { name: "  دسته آزمایشی  ", icon: "speaker" },
    });
    assert.equal(category.name, "دسته آزمایشی");
    const [product] = await query("products", {
      operation: "insert",
      values: { name: "محصول آزمایشی", category_id: category.id },
    });
    const filters = [{ column: "id", op: "eq", value: category.id }];
    const png =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXs0AAAAASUVORK5CYII=";
    await query("categories", { operation: "update", filters, values: { icon: png } });
    const rows = await query(
      "products",
      {
        selection: "*, categories(name, icon)",
        filters: [{ column: "id", op: "eq", value: product.id }],
      },
      reader,
    );
    assert.equal(rows[0].categories.icon, png);
    assert.equal((await query("categories", {}, reader)).length, 9);
    await assert.rejects(() =>
      query("categories", { operation: "update", filters, values: { icon: "calculator" } }, reader),
    );
    await assert.rejects(() =>
      query("categories", {
        operation: "update",
        filters,
        values: { icon: "javascript:alert(1)" },
      }),
    );
    assert.equal((await query("categories", { filters }))[0].icon, png);
    await query("categories", { operation: "delete", filters });
    assert.equal(
      (await query("products", { filters: [{ column: "id", op: "eq", value: product.id }] }))[0]
        .category_id,
      null,
    );
  } finally {
    await database.close();
  }
});
