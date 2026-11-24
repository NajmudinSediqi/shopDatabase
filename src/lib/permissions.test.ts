import { describe, expect, it } from "vitest";
import { canDo, toPermCode, togglePermission, withPermissionDependencies } from "./permissions";

describe("permissions", () => {
  it("reserves the assistant for owners despite legacy role grants", () => {
    expect(canDo(false, ["assistant.view", "reports.view"], "assistant.view")).toBe(false);
    expect(canDo(true, [], "assistant.view")).toBe(true);
  });
  it("owner can do anything", () => expect(canDo(true, [], "sales.manage")).toBe(true));
  it("role without the code is denied", () =>
    expect(canDo(false, ["sales.view"], "sales.manage")).toBe(false));
  it("role with the code is allowed", () =>
    expect(canDo(false, ["sales.view"], "sales.view")).toBe(true));
  it("custom codes get a prefix", () =>
    expect(toPermCode("Print Reports")).toBe("custom.print_reports"));
  it("adds nested dependencies and removes dependent actions when viewing is disabled", () => {
    const codes = withPermissionDependencies(["payroll.manage", "sales.list.view"]);
    expect(codes).toEqual(
      expect.arrayContaining(["employees.view", "payroll.view", "payroll.manage"]),
    );
    expect(canDo(false, codes, "payroll.manage")).toBe(true);
    expect(togglePermission(codes, "employees.view", false)).toEqual(["sales.list.view"]);
    expect(canDo(false, ["payroll.manage"], "payroll.manage")).toBe(false);
  });
  it("keeps page viewing separate from creation, payment and print actions", () => {
    for (const code of ["sales.create", "sales.list.view", "documents.print"])
      expect(canDo(false, ["sales.view"], code)).toBe(false);
    expect(togglePermission([], "customers.payments.manage", true)).toContain("customers.view");
    expect(canDo(false, ["customers.manage", "customers.view"], "customers.payments.manage")).toBe(
      false,
    );
  });
});
