import { assert } from "./errors.mjs";
import { rasterImage } from "./images.mjs";

const icons = new Set([
  "trimmer",
  "epilator",
  "beauty",
  "flashlight",
  "mp3",
  "speaker",
  "calculator",
  "powerbank",
]);

export function validateCategory(data, operation) {
  if (operation === "insert" || Object.hasOwn(data, "name")) {
    assert(
      typeof data.name === "string" &&
        data.name.trim().length > 0 &&
        data.name.trim().length <= 255,
      400,
      "نام دسته ضروری است و حداکثر ۲۵۵ حرف دارد",
    );
    data.name = data.name.trim();
  }
  if (!Object.hasOwn(data, "icon") || data.icon === null) return;
  assert(typeof data.icon === "string", 400, "آیکون دسته نامعتبر است");
  if (icons.has(data.icon)) return;
  rasterImage(data.icon, 128 * 1024);
}
