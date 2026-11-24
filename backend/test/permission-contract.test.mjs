import { test } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { actionPermissions } from "../src/data.mjs";
import dependencies from "../../shared/permission-dependencies.json" with { type: "json" };

test("all frontend checks, navigation codes, action permissions and dependencies exist in migrations", async () => {
  const migrations = new URL("../migrations/", import.meta.url);
  const catalogue = new Set();
  for (const file of await readdir(migrations)) {
    const text = await readFile(new URL(file, migrations), "utf8");
    for (const match of text.matchAll(/\('([a-z][a-z_.]+)'\s*,/g)) catalogue.add(match[1]);
  }
  assert.ok(catalogue.size >= 37);
  const check = (code) => assert.ok(catalogue.has(code), `Missing assignable permission: ${code}`);
  Object.values(actionPermissions).filter(Boolean).forEach(check);
  for (const [code, required] of Object.entries(dependencies)) {
    check(code);
    required.forEach(check);
    assert.ok(!required.includes(code));
  }
  async function scan(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
      if (entry.isDirectory()) await scan(path);
      else if (/\.tsx?$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name)) {
        const text = await readFile(path, "utf8");
        for (const match of text.matchAll(/(?:\.can\(|perm:)\s*"([a-z_.]+)"/g)) check(match[1]);
      }
    }
  }
  await scan(new URL("../../src/", import.meta.url));
});
