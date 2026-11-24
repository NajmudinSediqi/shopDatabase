import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";
import { TableDate } from "@/components/shop/widgets/table-date";

afterEach(cleanup);

it("uses RTL for both scrolling and column order even inside an LTR container", () => {
  render(
    <div dir="ltr">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>نام</TableHead>
            <TableHead>تاریخ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>احمد</TableCell>
            <TableCell>
              <TableDate value="2026-11-17" />
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>,
  );
  const table = screen.getByRole("table");
  expect(table).toHaveAttribute("dir", "rtl");
  expect(table.parentElement).toHaveAttribute("dir", "rtl");
  expect(screen.getByRole("columnheader", { name: "نام" })).toHaveAttribute("scope", "col");
  const date = table.querySelector("bdi");
  expect(date).toHaveAttribute("dir", "ltr");
  expect(date?.parentElement).toHaveAttribute("dir", "rtl");
});

it("supports an explicit LTR table when required", () => {
  render(
    <Table dir="ltr">
      <TableBody>
        <TableRow>
          <TableCell>Code</TableCell>
        </TableRow>
      </TableBody>
    </Table>,
  );
  expect(screen.getByRole("table").parentElement).toHaveAttribute("dir", "ltr");
});
