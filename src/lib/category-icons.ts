export const CATEGORY_ICONS = [
  { id: "trimmer", name: "ماشین اصلاح", x: 506, y: 142 },
  { id: "epilator", name: "موکن زنانه", x: 612, y: 142 },
  { id: "beauty", name: "لوازم آرایشی", x: 720, y: 143 },
  { id: "flashlight", name: "چراغ‌قوه", x: 824, y: 143 },
  { id: "mp3", name: "پخش‌کننده موسیقی", x: 930, y: 143 },
  { id: "speaker", name: "بلندگو", x: 516, y: 326 },
  { id: "calculator", name: "ماشین حساب", x: 637, y: 324 },
  { id: "powerbank", name: "پاوربانک", x: 757, y: 324 },
] as const;

export const CATEGORY_ICON_MAX_BYTES = 128 * 1024;

export async function readCategoryIcon(file: File): Promise<string> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    throw new Error("فقط تصویر PNG، JPEG یا WebP انتخاب کنید");
  if (!file.size || file.size > CATEGORY_ICON_MAX_BYTES)
    throw new Error("حجم تصویر باید حداکثر ۱۲۸ کیلوبایت باشد");
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("خواندن تصویر ناموفق بود"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
  const image = new Image();
  image.src = data;
  try {
    await image.decode();
  } catch {
    throw new Error("فایل انتخاب‌شده تصویر معتبر نیست");
  }
  return data;
}
