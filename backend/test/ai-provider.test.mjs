import { test } from "node:test";
import assert from "node:assert/strict";
import { completeLedger, NVIDIA_MODEL } from "../src/ai-provider.mjs";
import { askLedger } from "../src/ai.mjs";

test("NVIDIA uses server credentials, bounded reasoning and returns only final content", async () => {
  const messages = [{ role: "user", content: "Authorized ledger question" }];
  const answer = await completeLedger(
    messages,
    { AI_API_KEY: "test-key" },
    async (url, request) => {
      assert.equal(url, "https://integrate.api.nvidia.com/v1/chat/completions");
      assert.equal(request.headers.Authorization, "Bearer test-key");
      const body = JSON.parse(request.body);
      assert.equal(body.model, NVIDIA_MODEL);
      assert.equal(body.stream, false);
      assert.equal(body.chat_template_kwargs.enable_thinking, false);
      assert.deepEqual(body.response_format, { type: "json_object" });
      assert.equal(body.temperature, 0.3);
      assert.ok(body.max_tokens > 0);
      assert.deepEqual(body.messages, messages);
      return Response.json({
        choices: [
          {
            finish_reason: "stop",
            message: { content: "Final answer", reasoning_content: "Private reasoning" },
          },
        ],
      });
    },
  );
  assert.equal(answer, "Final answer");
});

test("provider failures are useful and never expose upstream content or credentials", async () => {
  for (const [status, expected] of [
    [401, 503],
    [403, 503],
    [429, 429],
    [500, 502],
  ]) {
    await assert.rejects(
      () =>
        completeLedger(
          [],
          { AI_API_KEY: "secret" },
          async () => new Response("secret provider payload", { status }),
        ),
      (error) => error.status === expected && !error.message.includes("secret"),
    );
  }
  await assert.rejects(
    () =>
      completeLedger([], {}, () => {
        throw Error("Must not call provider");
      }),
    { status: 503 },
  );
  await assert.rejects(
    () =>
      completeLedger([], { AI_API_KEY: "secret" }, async () => {
        throw Error("network");
      }),
    { status: 502 },
  );
  for (const body of [
    { choices: [{ finish_reason: "length", message: { content: "Partial" } }] },
    { choices: [{ message: { reasoning_content: "No final answer" } }] },
  ])
    await assert.rejects(
      () => completeLedger([], { AI_API_KEY: "secret" }, async () => Response.json(body)),
      { status: 502 },
    );
});

test("assistant and topic permissions are checked before ledger or provider access", async () => {
  for (const permissions of [[], ["assistant.view"]]) {
    const user = { id: "staff", member: true, admin: false, permissions: new Set(permissions) };
    await assert.rejects(
      () =>
        askLedger(
          null,
          {},
          user,
          { question: "Show payroll", kind: "business" },
          { AI_API_KEY: "test-key" },
        ),
      { status: 403 },
    );
  }
});

test("recovers once from a temporary gateway failure", async () => {
  let calls = 0;
  const result = await completeLedger([], { AI_API_KEY: "test" }, async () => {
    if (++calls === 1) return new Response("unavailable", { status: 503 });
    return Response.json({ choices: [{ message: { content: "Recovered" } }] });
  });
  assert.equal(result, "Recovered");
  assert.equal(calls, 2);
  for (const status of [401, 429]) {
    calls = 0;
    await assert.rejects(() =>
      completeLedger([], { AI_API_KEY: "test" }, async () => {
        calls++;
        return new Response("unavailable", { status });
      }),
    );
    assert.equal(calls, 1);
  }
});
