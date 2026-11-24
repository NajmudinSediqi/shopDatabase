import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readQrImage } from "./qr-image";
const close = vi.fn();
const decode = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  decode.mockResolvedValue({ width: 547, height: 545, close });
  vi.stubGlobal("createImageBitmap", decode);
});
afterEach(() => vi.unstubAllGlobals());
it("keeps the original QR bytes rather than cropping or re-encoding", async () => {
  const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);
  const image = await readQrImage(new File([bytes], "qr.png", { type: "image/png" }));
  expect(image).toBe(`data:image/png;base64,${Buffer.from(bytes).toString("base64")}`);
  expect(close).toHaveBeenCalledOnce();
});
it("rejects unsupported formats, oversized files and illegible small images", async () => {
  await expect(
    readQrImage(new File(["<svg/>"], "qr.svg", { type: "image/svg+xml" })),
  ).rejects.toThrow();
  await expect(
    readQrImage(new File([new Uint8Array(256 * 1024 + 1)], "qr.png", { type: "image/png" })),
  ).rejects.toThrow();
  expect(decode).not.toHaveBeenCalled();
  decode.mockResolvedValue({ width: 20, height: 20, close });
  await expect(readQrImage(new File(["x"], "qr.png", { type: "image/png" }))).rejects.toThrow();
  expect(close).toHaveBeenCalledOnce();
});
