export async function squareImageDataUrl(file: File, kind: "avatar" | "favicon") {
  const allowed = [
    "image/png",
    "image/jpeg",
    "image/webp",
    ...(kind === "favicon" ? ["image/x-icon", "image/vnd.microsoft.icon"] : []),
  ];
  if (
    !allowed.includes(file.type) &&
    !(kind === "favicon" && !file.type && /\.ico$/i.test(file.name))
  )
    throw Error("یک تصویر PNG، JPEG، WebP یا نشان ICO انتخاب کنید");
  if (file.size > 5 * 1024 * 1024) throw Error("حجم تصویر باید کمتر از پنج مگابایت باشد");
  const image = await createImageBitmap(file);
  try {
    const size = kind === "avatar" ? 384 : 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) throw Error("پردازش تصویر ممکن نشد");
    const sourceSize = Math.min(image.width, image.height);
    context.drawImage(
      image,
      (image.width - sourceSize) / 2,
      (image.height - sourceSize) / 2,
      sourceSize,
      sourceSize,
      0,
      0,
      size,
      size,
    );
    const result = canvas.toDataURL(kind === "favicon" ? "image/png" : "image/webp", 0.85);
    if (result.length > (kind === "favicon" ? 170_000 : 700_000))
      throw Error("حجم تصویر پس از فشرده‌سازی هنوز زیاد است");
    return result;
  } finally {
    image.close();
  }
}
