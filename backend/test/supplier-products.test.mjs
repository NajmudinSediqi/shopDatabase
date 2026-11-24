import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { testDatabase } from "./database.mjs";
import { migrate } from "../src/migrate.mjs";
import { insertRecord } from "../src/db.mjs";
import { runAction, queryData, loadColumns } from "../src/data.mjs";

test("supplier product settlement is atomic, repeat-safe, scoped to merchandise suppliers and immutable independently", async () => {
  const db = await testDatabase();
  const { sql } = db;
  const owner = { id: randomUUID(), admin: true, member: true, permissions: new Set() };
  try {
    await migrate(sql);
    const columns = await loadColumns(sql);
    const supplier = await insertRecord(sql, "suppliers", { name: "Shopkeeper" });
    const payee = await insertRecord(sql, "suppliers", { name: "Changer", supplier_type: "payee" });
    const product = await insertRecord(sql, "products", { name: "Product", pack_size: 6 });
    await runAction(sql, owner, "create_purchase", {
      payload: {
        supplier_id: supplier.id,
        currency: "AFN",
        rate: 1,
        date: "2026-11-21",
        paid: 0,
        items: [{ product_id: product.id, qty: 20, unit_price: 50 }],
      },
    });
    const payload = {
      request_id: randomUUID(),
      supplier_id: supplier.id,
      currency: "AFN",
      rate: 1,
      date: "2026-11-21",
      notes: "Goods delivered instead of cash",
      items: [{ product_id: product.id, qty: 2, unit_price: 350, unit_kind: "pack" }],
    };
    const sale = await runAction(sql, owner, "pay_supplier_products", { payload });
    assert.equal(await runAction(sql, owner, "pay_supplier_products", { payload }), sale);
    await assert.rejects(
      () =>
        runAction(sql, owner, "pay_supplier_products", {
          payload: { ...payload, notes: "Changed after successful retry" },
        }),
      { status: 409 },
    );
    assert.equal(
      Number(
        (await sql`SELECT shop_qty FROM product_stock WHERE product_id=${product.id}`)[0].shop_qty,
      ),
      8,
    );
    assert.equal(
      Number(
        (
          await sql`SELECT balance FROM supplier_balances WHERE supplier_id=${supplier.id} AND currency='AFN'`
        )[0].balance,
      ),
      300,
    );
    const history = await runAction(sql, owner, "supplier_product_history", {
      supplier_id: supplier.id,
    });
    assert.equal(history.length, 1);
    assert.equal(Number(history[0].pieces), 12);
    assert.equal(Number(history[0].total), 700);
    assert.equal(Number(history[0].unit_price), 350);
    assert.equal(history[0].notes, payload.notes);
    const [savedItem] = await sql`SELECT unit_cost_afn FROM sale_items WHERE sale_id=${sale}`;
    assert.equal(Number(savedItem.unit_cost_afn), 300);
    const filters = [{ column: "id", op: "eq", value: payload.request_id }];
    for (const operation of ["delete", "update"])
      await assert.rejects(
        () =>
          queryData(sql, columns, owner, {
            table: "supplier_payments",
            operation,
            filters,
            values: { amount: 1 },
          }),
        { status: 403 },
      );
    await assert.rejects(
      () =>
        queryData(sql, columns, owner, {
          table: "sales",
          operation: "delete",
          filters: [{ column: "id", op: "eq", value: sale }],
        }),
      { status: 403 },
    );
    await assert.rejects(
      () => runAction(sql, owner, "update_sale", { id: sale, payload: { ...payload, paid: 700 } }),
      { status: 403 },
    );
    await assert.rejects(
      () =>
        queryData(sql, columns, owner, {
          table: "supplier_payments",
          operation: "insert",
          values: {
            supplier_id: supplier.id,
            amount: 1,
            currency: "AFN",
            settlement_sale_id: sale,
          },
        }),
      { status: 403 },
    );
    for (const change of [
      { supplier_id: payee.id },
      { items: [{ product_id: product.id, qty: 9, unit_price: 1 }] },
      { date: "2026-02-30" },
    ])
      await assert.rejects(
        () =>
          runAction(sql, owner, "pay_supplier_products", {
            payload: { ...payload, request_id: randomUUID(), ...change },
          }),
        { status: 400 },
      );
    assert.equal((await sql`SELECT id FROM sales`).length, 1);
    assert.equal((await sql`SELECT id FROM supplier_payments`).length, 1);
    assert.equal(
      Number(
        (await sql`SELECT shop_qty FROM product_stock WHERE product_id=${product.id}`)[0].shop_qty,
      ),
      8,
    );
    await insertRecord(sql, "supplier_debts", {
      supplier_id: supplier.id,
      amount: 20,
      currency: "USD",
      date: payload.date,
    });
    await runAction(sql, owner, "pay_supplier_products", {
      payload: {
        ...payload,
        request_id: randomUUID(),
        currency: "USD",
        rate: 70,
        items: [{ product_id: product.id, qty: 1, unit_price: 5 }],
      },
    });
    assert.equal(
      Number(
        (
          await sql`SELECT balance FROM supplier_balances WHERE supplier_id=${supplier.id} AND currency='USD'`
        )[0].balance,
      ),
      15,
    );
    const staff = {
      ...owner,
      admin: false,
      permissions: new Set(["suppliers.view", "suppliers.payments.manage"]),
    };
    await assert.rejects(() => runAction(sql, staff, "pay_supplier_products", { payload }), {
      status: 403,
    });
    assert.equal(
      (await runAction(sql, staff, "supplier_product_history", { supplier_id: supplier.id }))
        .length,
      2,
    );
    const attempts = await Promise.allSettled(
      [1, 2].map(() =>
        runAction(sql, owner, "pay_supplier_products", {
          payload: {
            ...payload,
            request_id: randomUUID(),
            items: [{ product_id: product.id, qty: 2, unit_price: 100 }],
          },
        }),
      ),
    );
    assert.equal(attempts.filter((result) => result.status === "fulfilled").length, 2);
    assert.equal(
      Number(
        (
          await sql`SELECT balance FROM supplier_balances WHERE supplier_id=${supplier.id} AND currency='AFN'`
        )[0].balance,
      ),
      -100,
    );
    const change = {
      supplier_id: supplier.id,
      id: sale,
      payload: {
        ...payload,
        items: [
          {
            id: (await sql`SELECT id FROM sale_items WHERE sale_id=${sale}`)[0].id,
            product_id: product.id,
            qty: 1,
            unit_price: 350,
            unit_kind: "pack",
          },
        ],
      },
    };
    await assert.rejects(() => runAction(sql, staff, "update_supplier_products", change), {
      status: 403,
    });
    await assert.rejects(() => runAction(sql, staff, "delete_supplier_products", change), {
      status: 403,
    });
    await assert.rejects(
      () =>
        runAction(sql, owner, "update_supplier_products", {
          ...change,
          payload: { ...change.payload, rate: 0 },
        }),
      { status: 400 },
    );
    assert.equal(
      Number(
        (await sql`SELECT shop_qty FROM product_stock WHERE product_id=${product.id}`)[0].shop_qty,
      ),
      3,
    );
    await sql`UPDATE products SET pack_size=10 WHERE id=${product.id}`;
    await runAction(sql, owner, "update_supplier_products", change);
    const [edited] =
      await sql`SELECT qty,pieces,unit_cost_afn FROM sale_items WHERE sale_id=${sale}`;
    assert.equal(Number(edited.pieces), 6);
    assert.equal(Number(edited.unit_cost_afn), 300);
    assert.equal(
      Number(
        (
          await sql`SELECT balance FROM supplier_balances WHERE supplier_id=${supplier.id} AND currency='AFN'`
        )[0].balance,
      ),
      250,
    );
    assert.equal(
      Number(
        (await sql`SELECT shop_qty FROM product_stock WHERE product_id=${product.id}`)[0].shop_qty,
      ),
      9,
    );
    await runAction(sql, owner, "delete_supplier_products", change);
    await runAction(sql, owner, "delete_supplier_products", change);
    assert.equal((await sql`SELECT id FROM sales WHERE id=${sale}`).length, 0);
    assert.equal(
      (await sql`SELECT id FROM supplier_payments WHERE settlement_sale_id=${sale}`).length,
      0,
    );
    assert.equal(
      Number(
        (
          await sql`SELECT balance FROM supplier_balances WHERE supplier_id=${supplier.id} AND currency='AFN'`
        )[0].balance,
      ),
      600,
    );
    assert.equal(
      Number(
        (await sql`SELECT shop_qty FROM product_stock WHERE product_id=${product.id}`)[0].shop_qty,
      ),
      15,
    );
  } finally {
    await db.close();
  }
});
