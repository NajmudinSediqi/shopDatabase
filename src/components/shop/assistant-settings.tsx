import { useState } from "react";
import { toast } from "sonner";
import { useAssistantSettings } from "@/hooks/use-assistant-settings";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

export function AssistantSettings() {
  const settings = useAssistantSettings();
  const [saving, setSaving] = useState(false);
  return (
    <Card className="flex flex-row items-center justify-between gap-4 p-5">
      <div>
        <label htmlFor="assistant-enabled" className="font-medium">
          دستیار هوشمند
        </label>
        <p className="mt-1 text-sm text-muted-foreground">
          فقط مدیر اصلی می‌تواند دستیار را روشن، خاموش و استفاده کند. تاریخچه با خاموش کردن حذف
          نمی‌شود.
        </p>
        {settings.error && (
          <p role="alert" className="text-sm text-destructive">
            {settings.error.message}
          </p>
        )}
      </div>
      <Switch
        id="assistant-enabled"
        checked={settings.data?.enabled ?? false}
        disabled={saving || !settings.data}
        onCheckedChange={async (enabled) => {
          setSaving(true);
          try {
            await settings.setEnabled(enabled);
            toast.success(enabled ? "دستیار روشن شد" : "دستیار خاموش شد");
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "تنظیمات ذخیره نشد");
          } finally {
            setSaving(false);
          }
        }}
      />
    </Card>
  );
}
