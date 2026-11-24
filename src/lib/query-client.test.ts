import { QueryObserver } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAppQueryClient } from "./query-client";
import { sessionQuery } from "./session-query";
import { api } from "@/integrations/api/client";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("shared-hosting request budget", () => {
  it("reuses page data on navigation, but refreshes expired and invalidated data", async () => {
    vi.useFakeTimers();
    const client = createAppQueryClient();
    const queryFn = vi.fn().mockResolvedValue([1]);
    const query = { queryKey: ["products"], queryFn };
    try {
      await client.fetchQuery(query);
      await client.fetchQuery(query);
      vi.advanceTimersByTime(30_000);
      await client.fetchQuery(query);
      expect(queryFn).toHaveBeenCalledTimes(1);
      await client.invalidateQueries({ queryKey: ["products"] });
      await client.fetchQuery(query);
      expect(queryFn).toHaveBeenCalledTimes(2);
      vi.advanceTimersByTime(60_001);
      await client.fetchQuery(query);
      expect(queryFn).toHaveBeenCalledTimes(3);
    } finally {
      client.clear();
    }
  });

  it("does not poll an idle page every 30 seconds", async () => {
    vi.useFakeTimers();
    const client = createAppQueryClient();
    const queryFn = vi.fn().mockResolvedValue([]);
    const query = { queryKey: ["report_summary"], queryFn };
    await client.fetchQuery(query);
    const observer = new QueryObserver(client, query);
    const unsubscribe = observer.subscribe(() => {});
    try {
      await vi.advanceTimersByTimeAsync(120_000);
      expect(queryFn).toHaveBeenCalledTimes(1);
    } finally {
      unsubscribe();
      client.clear();
    }
  });

  it("deduplicates route/session consumers and expires the shared session after five minutes", async () => {
    vi.useFakeTimers();
    const getUser = vi.spyOn(api.auth, "getUser").mockResolvedValue({
      data: { user: { id: "owner", email: "owner@example.test", user_metadata: {} } },
      error: null,
    });
    const client = createAppQueryClient();
    try {
      await Promise.all([client.fetchQuery(sessionQuery), client.fetchQuery(sessionQuery)]);
      await client.fetchQuery(sessionQuery);
      expect(getUser).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(5 * 60_000 + 1);
      getUser.mockResolvedValue({ data: { user: null }, error: null });
      expect(await client.fetchQuery(sessionQuery)).toBeNull();
      expect(getUser).toHaveBeenCalledTimes(2);
    } finally {
      client.clear();
    }
  });

  it("does not turn a server outage into a signed-out session or retry denied requests", async () => {
    vi.spyOn(api.auth, "getUser").mockResolvedValue({
      data: { user: null },
      error: { message: "Unavailable", status: 502 },
    });
    const client = createAppQueryClient();
    const denied = vi.fn().mockRejectedValue({ message: "Denied", status: 403 });
    try {
      await expect(client.fetchQuery(sessionQuery)).rejects.toMatchObject({ status: 502 });
      await expect(
        client.fetchQuery({ queryKey: ["denied"], queryFn: denied }),
      ).rejects.toMatchObject({ status: 403 });
      expect(denied).toHaveBeenCalledTimes(1);
      client.clear();
      expect(client.getQueryData(sessionQuery.queryKey)).toBeUndefined();
    } finally {
      client.clear();
    }
  });
});
