/** Read the original QR without cropping, compression or changes to its quiet zone. */
export async function readQrImage(file: File): Promise<string> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    throw Error("یک تصویر PNG، JPEG یا WebP انتخاب کنید");
  if (!file.size || file.size > 256 * 1024)
    throw Error("حجم تصویر QR باید کمتر از 256 کیلوبایت باشد");
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width < 100 || bitmap.height < 100 || bitmap.width > 4096 || bitmap.height > 4096)
      throw Error("اندازه تصویر QR باید بین 100 و 4096 پیکسل باشد");
  } finally {
    bitmap.close();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(Error("خواندن تصویر QR ممکن نشد"));
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(Error("تصویر نامعتبر است"));
    reader.readAsDataURL(file);
  });
}
