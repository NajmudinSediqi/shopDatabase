import { Package } from "lucide-react";
import { CATEGORY_ICONS } from "@/lib/category-icons";
import { NOOR_CARD_IMAGE } from "@/lib/noor-brand-assets";

export function CategoryIcon({
  icon,
  size = 36,
}: {
  icon?: string | null | undefined;
  size?: number;
}) {
  const preset = CATEGORY_ICONS.find((item) => item.id === icon);
  const custom =
    !preset && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(icon ?? "");
  const scale = size / 90;
  return (
    <span
      data-category-icon
      className="shrink-0 rounded-full border border-slate-200 bg-white text-[#001a5d]"
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        flexShrink: 0,
        width: size,
        height: size,
      }}
      aria-hidden="true"
    >
      {preset ? (
        <img
          alt=""
          src={NOOR_CARD_IMAGE}
          draggable={false}
          style={{
            position: "absolute",
            width: 1080 * scale,
            height: 720 * scale,
            maxWidth: "none",
            left: -preset.x * scale,
            top: -preset.y * scale,
          }}
        />
      ) : custom ? (
        <img
          alt=""
          src={icon!}
          style={{ width: "100%", height: "100%", objectFit: "contain", padding: 2 }}
        />
      ) : (
        <Package style={{ width: size / 2, height: size / 2 }} />
      )}
    </span>
  );
}
