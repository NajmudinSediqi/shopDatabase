import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { TableCard } from "./table-card";
import { Pager, usePaged } from "./pager";
import { SearchInput } from "./search-input";
import { DateRangeFilter } from "./date-range-filter";
import { Table, TableBody, TableRow, TableCell } from "@/components/ui/table";

const print = vi.hoisted(() => vi.fn());
const access = vi.hoisted(() => ({ print: true }));
vi.mock("@/lib/print", () => ({ printTable: print }));
vi.mock("@/hooks/use-me", () => ({ useMe: () => ({ data: { can: () => access.print } }) }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  access.print = true;
});

it("keeps table data visible without offering PDF printing when the role cannot print", () => {
  access.print = false;
  render(
    <TableCard title="Records">
      <p>Visible data</p>
    </TableCard>,
  );
  expect(screen.getByText("Visible data")).toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

it("keeps paging, search clearing and the printable table independent", () => {
  function Example() {
    const [q, setQ] = useState("");
    const rows = ["Alpha", "Beta", "Gamma"].filter((name) => name.includes(q));
    const page = usePaged(rows, 2);
    return (
      <TableCard
        title="Records"
        count={rows.length}
        toolbar={<SearchInput value={q} onChange={setQ} placeholder="Search" />}
      >
        <Table>
          <TableBody>
            {page.items.map((name) => (
              <TableRow key={name}>
                <TableCell>{name}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pager {...page} />
      </TableCard>
    );
  }
  render(<Example />);
  fireEvent.click(screen.getByRole("button", { name: "صفحه بعدی" }));
  expect(screen.getByText("Gamma")).toBeInTheDocument();
  fireEvent.change(screen.getByRole("textbox", { name: "Search" }), { target: { value: "Beta" } });
  expect(screen.getByText("Beta")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "صفحه بعدی" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "پاک کردن جستجو" }));
  expect(screen.getByText("Alpha")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "چاپ / PDF" }));
  const target = print.mock.calls[0]?.[0] as HTMLElement;
  expect(target.querySelector("table")).not.toBeNull();
  expect(target.querySelector("nav")).toBeNull();
});

it("opens the compact date filter and clears both bounds", () => {
  const from = vi.fn();
  const to = vi.fn();
  render(<DateRangeFilter from="2026-01-01" to="2026-01-31" onFromChange={from} onToChange={to} />);
  expect(screen.queryByText("از تاریخ")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /فیلتر تاریخ:/ }));
  expect(screen.getByText("از تاریخ")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "پاک کردن تاریخ" }));
  expect(from).toHaveBeenCalledWith("");
  expect(to).toHaveBeenCalledWith("");
  fireEvent.click(screen.getByRole("button", { name: "انجام شد" }));
  expect(screen.queryByText("از تاریخ")).not.toBeInTheDocument();
});
