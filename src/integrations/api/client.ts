import type { Database } from "./types";

type Schema = Database["public"];
type Resources = Schema["Tables"] & Schema["Views"];
type Resource = keyof Resources;
type Row<K extends Resource> = Resources[K]["Row"];
type Joined = {
  products: { categories: Row<"categories"> | null };
  user_roles: { roles: Row<"roles"> | null };
  sales: {
    customer_payments: Row<"customer_payments">[];
    customers: Row<"customers"> | null;
    sale_items: (Row<"sale_items"> & { products: Row<"products"> })[];
  };
  purchases: {
    supplier_payments: Row<"supplier_payments">[];
    suppliers: Row<"suppliers"> | null;
    purchase_items: (Row<"purchase_items"> & { products: Row<"products"> })[];
  };
  sale_items: { products: Row<"products">; sales: Row<"sales"> };
  purchase_items: { products: Row<"products">; purchases: Row<"purchases"> };
  stock_movements: { products: Row<"products"> };
  salary_payments: { employees: Row<"employees"> };
  expenses: { expense_categories: Row<"expense_categories"> | null };
};
type QueryRow<K extends Resource> = Row<K> & (K extends keyof Joined ? Joined[K] : object);
export type ApiError = { message: string; status?: number };
export type Result<T> = { data: T; error: null } | { data: null; error: ApiError };

export async function apiRequest<T>(path: string, body?: unknown): Promise<Result<T>> {
  try {
    const response = await fetch(`/api${path}`, {
      method: body === undefined ? "GET" : "POST",
      credentials: "same-origin",
      ...(body === undefined
        ? {}
        : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    });
    const result = (await response.json()) as Result<T>;
    if (!response.ok)
      return {
        data: null,
        error: result.error ?? { message: "درخواست ناموفق بود", status: response.status },
      };
    return result;
  } catch {
    return { data: null, error: { message: "ارتباط با سرور ممکن نشد" } };
  }
}

type Filter = { column: string; op: string; value: unknown };
class Query<T> implements PromiseLike<Result<T[]>> {
  private request: {
    table: Resource;
    operation: string;
    selection: string;
    filters: Filter[];
    order: { column: string; ascending: boolean }[];
    limit: number;
    values?: unknown;
  };
  constructor(table: Resource) {
    this.request = {
      table,
      operation: "select",
      selection: "*",
      filters: [],
      order: [],
      limit: 1000,
    };
  }
  select(selection = "*") {
    this.request.selection = selection;
    return this;
  }
  insert(values: unknown) {
    this.request.operation = "insert";
    this.request.values = values;
    return this;
  }
  update(values: unknown) {
    this.request.operation = "update";
    this.request.values = values;
    return this;
  }
  delete() {
    this.request.operation = "delete";
    return this;
  }
  private filter(column: string, op: string, value: unknown) {
    this.request.filters.push({ column, op, value });
    return this;
  }
  eq(column: string, value: unknown) {
    return this.filter(column, "eq", value);
  }
  neq(column: string, value: unknown) {
    return this.filter(column, "neq", value);
  }
  gte(column: string, value: unknown) {
    return this.filter(column, "gte", value);
  }
  lte(column: string, value: unknown) {
    return this.filter(column, "lte", value);
  }
  not(column: string, operator: string, value: unknown) {
    return this.filter(column, `not.${operator}`, value);
  }
  order(column: string, options?: { ascending?: boolean }) {
    this.request.order.push({ column, ascending: options?.ascending !== false });
    return this;
  }
  limit(count: number) {
    this.request.limit = count;
    return this;
  }
  single() {
    return apiRequest<T>("/data/query", { ...this.request, single: "required" });
  }
  maybeSingle() {
    return apiRequest<T | null>("/data/query", { ...this.request, single: "optional" });
  }
  then<TResult1 = Result<T[]>, TResult2 = never>(
    onfulfilled?: ((value: Result<T[]>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return apiRequest<T[]>("/data/query", this.request).then(onfulfilled, onrejected);
  }
}

export type User = { id: string; email: string; user_metadata: { full_name?: string } };
type AuthEvent = "SIGNED_IN" | "SIGNED_OUT" | "USER_UPDATED";
const listeners = new Set<(event: AuthEvent) => void>();
function emit(event: AuthEvent) {
  for (const listener of listeners) listener(event);
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("ledger-auth-event", JSON.stringify({ event, at: Date.now() }));
    } catch {
      /* Cookie authentication still works when browser storage is unavailable. */
    }
  }
}
if (typeof window !== "undefined")
  window.addEventListener("storage", (event) => {
    if (event.key !== "ledger-auth-event" || !event.newValue) return;
    try {
      const value = JSON.parse(event.newValue) as { event: AuthEvent };
      if (["SIGNED_IN", "SIGNED_OUT", "USER_UPDATED"].includes(value.event))
        for (const listener of listeners) listener(value.event);
    } catch {
      /* Ignore unrelated invalid storage values. */
    }
  });
async function authSession() {
  const result = await apiRequest<{ user: User | null }>("/auth/session");
  return { data: { user: result.data?.user ?? null }, error: result.error };
}
async function authenticate(path: string, body: unknown) {
  const result = await apiRequest<{ user: User }>(path, body);
  if (result.data) emit("SIGNED_IN");
  return {
    data: {
      user: result.data?.user ?? null,
      session: result.data ? { user: result.data.user } : null,
    },
    error: result.error,
  };
}
export const api = {
  from<K extends Resource>(table: K) {
    return new Query<QueryRow<K>>(table);
  },
  rpc<K extends keyof Schema["Functions"]>(name: K, args: Schema["Functions"][K]["Args"]) {
    return apiRequest<Schema["Functions"][K]["Returns"]>(`/actions/${name}`, args);
  },
  async mutateBusiness(name: "update_sale" | "update_purchase" | "change_stock_movement", args: { id: string; payload?: unknown; values?: unknown }): Promise<Result<string>> {
    const result = await apiRequest<string>(`/actions/${name}`, args);
    if (result.error?.status === 404 && result.error.message === "Unknown action") {
      return { data: null, error: { status: 404, message: "سرور نسخه قدیمی را اجرا می‌کند. سرور backend را دوباره راه‌اندازی کنید (برای توسعه: npm run backend:dev)." } };
    }
    return result;
  },
  auth: {
    getUser: authSession,
    async getSession() {
      const { data, error } = await authSession();
      return { data: { session: data.user ? { user: data.user } : null }, error };
    },
    signInWithPassword(data: { email: string; password: string }) {
      return authenticate("/auth/login", data);
    },
    signUp(data: {
      email: string;
      password: string;
      options?: { emailRedirectTo?: string; data?: { full_name?: string } };
    }) {
      return authenticate("/auth/register", {
        email: data.email,
        password: data.password,
        fullName: data.options?.data?.full_name,
      });
    },
    async signOut() {
      const result = await apiRequest("/auth/logout", {});
      if (!result.error) emit("SIGNED_OUT");
      return result;
    },
    async updateUser(data: {
      password: string;
      currentPassword?: string;
      invitationToken?: string;
    }) {
      const result = await apiRequest<{ user: User }>("/auth/password", data);
      if (result.data) emit("USER_UPDATED");
      return result;
    },
    async updateProfile(data: {
      fullName?: string;
      email?: string;
      avatarUrl?: string | null;
      currentPassword?: string;
    }) {
      const result = await apiRequest<{ ok: boolean }>("/profile/update", data);
      if (result.data) emit("USER_UPDATED");
      return result;
    },
    onAuthStateChange(callback: (event: AuthEvent) => void) {
      listeners.add(callback);
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              listeners.delete(callback);
            },
          },
        },
      };
    },
  },
};
