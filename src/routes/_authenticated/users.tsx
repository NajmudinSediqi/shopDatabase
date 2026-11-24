import { brandedTitle } from "@/lib/branding-shared";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound, Mail, Pencil, Plus, ShieldCheck, Settings2, Users, Lock } from "lucide-react";
import { api, apiRequest } from "@/integrations/api/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ConfirmDelete,
  EmptyRow,
  Field,
  OptionSelect,
  PageHeader,
  TableCard,
  TableDate,
  errMsg,
  NameCell,
} from "@/components/shop";
import { useInvalidate } from "@/lib/queries";
import { useMe } from "@/hooks/use-me";
import { num } from "@/lib/format";
import { ShopSettings } from "@/components/shop/shop-settings";
import { toPermCode, togglePermission, withPermissionDependencies } from "@/lib/permissions";
import { inviteUser } from "@/lib/users.functions";

export const Route = createFileRoute("/_authenticated/users")({
  head: ({ match }) => ({
    meta: [
      { title: brandedTitle("کاربران، نقش‌ها و تنظیمات", match.context.branding.platform_title) },
      {
        name: "description",
        content: "کاربران، نقش‌ها و تنظیمات در سیستم مدیریت فروشگاه، گدام و حسابات",
      },
      { property: "og:title", content: match.context.branding.platform_title },
      {
        property: "og:description",
        content: "کاربران، نقش‌ها و تنظیمات در سیستم مدیریت فروشگاه، گدام و حسابات",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UsersPage,
});

type Role = {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  is_system: boolean;
};
type Perm = { code: string; label: string; grp: string; is_system: boolean };

function useRoles() {
  return useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const { data, error } = await api.from("roles").select("*").order("created_at");
      if (error) throw error;
      return data as Role[];
    },
  });
}
function usePerms() {
  return useQuery({
    queryKey: ["permissions"],
    queryFn: async () => {
      const { data, error } = await api.from("permissions").select("*").order("created_at");
      if (error) throw error;
      return data as Perm[];
    },
  });
}

function UsersPage() {
  const { data: me } = useMe();
  if (!me?.isAdmin)
    return (
      <p className="p-8 text-center text-muted-foreground">
        فقط مدیر فروشگاه به این صفحه دسترسی دارد.
      </p>
    );
  return (
    <>
      <PageHeader
        title="کاربران، نقش‌ها و تنظیمات"
        description="دعوت کاربر، ساختن نقش و مجوز، و تنظیمات عمومی فروشگاه"
      />
      <Tabs defaultValue="users" dir="rtl">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="users">
            <Users className="size-4" /> کاربران
          </TabsTrigger>
          <TabsTrigger value="roles">
            <ShieldCheck className="size-4" /> نقش‌ها
          </TabsTrigger>
          <TabsTrigger value="perms">
            <KeyRound className="size-4" /> مجوزها
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings2 className="size-4" /> تنظیمات
          </TabsTrigger>
        </TabsList>
        <TabsContent value="users">
          <UsersTab />
        </TabsContent>
        <TabsContent value="roles">
          <RolesTab />
        </TabsContent>
        <TabsContent value="perms">
          <PermsTab />
        </TabsContent>
        <TabsContent value="settings">
          <ShopSettings />
        </TabsContent>
      </Tabs>
    </>
  );
}

function roleOptions(roles: Role[]) {
  return [
    { value: "admin", label: "مدیر فروشگاه (همه دسترسی‌ها)" },
    ...roles.map((r) => ({ value: r.id, label: r.name })),
  ];
}

function UsersTab() {
  const { data: me } = useMe();
  const { data: roles = [] } = useRoles();
  const inv = useInvalidate();
  const [inviteOpen, setInviteOpen] = useState(false);

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const [{ data: p }, { data: r }] = await Promise.all([
        api.from("profiles").select("*").order("created_at"),
        api.from("user_roles").select("*"),
      ]);
      return (p ?? []).map((u) => {
        const row = r?.find((x) => x.user_id === u.id);
        return { ...u, value: row ? (row.role === "admin" ? "admin" : (row.role_id ?? "")) : "" };
      });
    },
  });

  async function setRole(userId: string, value: string) {
    const { error } = await apiRequest("/users/role", { userId, roleId: value });
    if (error) {
      toast.error(errMsg(error));
      return;
    }
    toast.success("نقش به‌روز شد");
    inv("users");
    inv("me");
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          کاربر را با ایمیل دعوت کنید یا بعد از ثبت‌نام برایش نقش تعیین کنید.
        </p>
        <Button onClick={() => setInviteOpen(true)}>
          <Mail /> دعوت کاربر
        </Button>
      </div>
      <TableCard>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-start">نام</TableHead>
              <TableHead className="text-start">ایمیل</TableHead>
              <TableHead className="text-start">تاریخ ثبت‌نام</TableHead>
              <TableHead className="w-56 text-start">نقش</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 && <EmptyRow cols={4} />}
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <NameCell name={u.full_name} />
                </TableCell>
                <TableCell dir="ltr" className="text-right text-muted-foreground">
                  {u.email}
                </TableCell>
                <TableCell>
                  <TableDate value={u.created_at} />
                </TableCell>
                <TableCell>
                  {u.id === me?.user.id ? (
                    <span className="text-sm text-muted-foreground">مدیر (شما)</span>
                  ) : (
                    <OptionSelect
                      value={u.value}
                      onChange={(v) => setRole(u.id, v)}
                      allowNone="بدون دسترسی"
                      options={roleOptions(roles)}
                    />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableCard>
      <InviteDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        roles={roles}
        onDone={() => inv("users")}
      />
    </>
  );
}

function InviteDialog({
  open,
  onClose,
  roles,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  roles: Role[];
  onDone: () => void;
}) {
  const invite = inviteUser;
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [roleId, setRoleId] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setEmail("");
      setName("");
      setRoleId(roles.find((r) => r.is_system)?.id ?? "");
    }
  }, [open, roles]);

  async function send() {
    setBusy(true);
    try {
      const res = await invite({
        data: {
          email,
          fullName: name,
          roleId,
          redirectTo: `${window.location.origin}/set-password`,
        },
      });
      if (!res.ok) {
        toast.error(res.error ?? "خطا");
        return;
      }
      toast.success("دعوت‌نامه به ایمیل ارسال شد");
      onDone();
      onClose();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>دعوت کاربر جدید</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="ایمیل">
            <Input
              type="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="نام">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="نقش">
            <OptionSelect
              value={roleId}
              onChange={setRoleId}
              allowNone="بدون دسترسی"
              options={roleOptions(roles)}
            />
          </Field>
          <p className="text-xs text-muted-foreground">
            یک لینک به ایمیل ارسال می‌شود؛ کاربر با آن رمز خود را تعیین و وارد می‌شود.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={send} disabled={busy || !email}>
            <Mail /> ارسال دعوت
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function groupPerms(perms: Perm[]) {
  const m = new Map<string, Perm[]>();
  for (const p of perms) m.set(p.grp, [...(m.get(p.grp) ?? []), p]);
  return [...m.entries()];
}

function RolesTab() {
  const { data: roles = [] } = useRoles();
  const { data: perms = [] } = usePerms();
  const inv = useInvalidate();
  const [edit, setEdit] = useState<Partial<Role> | null>(null);
  const label = (c: string) => perms.find((p) => p.code === c)?.label ?? c;

  async function remove(id: string) {
    const { error } = await api.from("roles").delete().eq("id", id);
    if (error) {
      toast.error(errMsg(error));
      return;
    }
    toast.success("نقش حذف شد؛ کاربران این نقش بدون دسترسی شدند");
    inv("roles");
    inv("users");
    inv("me");
  }

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button onClick={() => setEdit({ name: "", description: "", permissions: [] })}>
          <Plus /> نقش جدید
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {roles.map((r) => (
          <Card key={r.id} className="p-4 shadow-soft">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-bold">
                  <ShieldCheck className="size-4 text-primary" /> {r.name}
                  {r.is_system && (
                    <Badge variant="outline" className="text-[10px]">
                      پیش‌فرض
                    </Badge>
                  )}
                </div>
                {r.description && (
                  <p className="mt-1 text-xs text-muted-foreground">{r.description}</p>
                )}
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  size="icon"
                  variant="outline"
                  className="size-8"
                  onClick={() => setEdit(r)}
                  aria-label="ویرایش"
                >
                  <Pencil className="size-4" />
                </Button>
                {!r.is_system && <ConfirmDelete outline onConfirm={() => remove(r.id)} />}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {r.permissions.length === 0 && (
                <span className="text-xs text-muted-foreground">هیچ مجوزی ندارد</span>
              )}
              {r.permissions.map((c) => (
                <Badge key={c} variant="secondary" className="text-[10px] font-normal">
                  {label(c)}
                </Badge>
              ))}
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              {num(r.permissions.length)} مجوز
            </div>
          </Card>
        ))}
      </div>
      <RoleDialog
        role={edit}
        perms={perms}
        onClose={() => setEdit(null)}
        onSaved={() => {
          inv("roles");
          inv("me");
        }}
      />
    </>
  );
}

function RoleDialog({
  role,
  perms,
  onClose,
  onSaved,
}: {
  role: Partial<Role> | null;
  perms: Perm[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [sel, setSel] = useState<string[]>([]);
  useEffect(() => {
    if (role) {
      setName(role.name ?? "");
      setDesc(role.description ?? "");
      setSel(
        withPermissionDependencies(
          (role.permissions ?? []).filter((code) => code !== "assistant.view"),
        ),
      );
    }
  }, [role]);
  const groups = useMemo(
    () => groupPerms(perms.filter((permission) => permission.code !== "assistant.view")),
    [perms],
  );
  const toggle = (c: string, on: boolean) => setSel((s) => togglePermission(s, c, on));

  async function save() {
    if (!name.trim()) {
      toast.error("نام نقش را بنویسید");
      return;
    }
    const row = { name: name.trim(), description: desc.trim() || null, permissions: sel };
    const { error } = role?.id
      ? await api.from("roles").update(row).eq("id", role.id)
      : await api.from("roles").insert(row);
    if (error) {
      toast.error(
        /duplicate|unique/i.test(error.message) ? "نقشی با این نام وجود دارد" : errMsg(error),
      );
      return;
    }
    toast.success("نقش ذخیره شد");
    onSaved();
    onClose();
  }

  return (
    <Dialog open={!!role} onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{role?.id ? "ویرایش نقش" : "نقش جدید"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="نام نقش">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="توضیحات">
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} />
          </Field>
        </div>
        <div className="space-y-3">
          <p className="text-xs leading-6 text-muted-foreground">
            انتخاب عملیات، مجوز دیدن بخش مربوط را نیز فعال می‌کند. با برداشتن مجوز دیدن، عملیات
            وابسته نیز غیرفعال می‌شود. چاپ / PDF مجوز جداگانه دارد.
          </p>
          {groups.map(([g, list]) => {
            const all = list.every((p) => sel.includes(p.code));
            return (
              <div key={g} className="rounded-xl border p-3">
                <label className="mb-2 flex items-center gap-2 text-sm font-bold">
                  <Checkbox
                    checked={all}
                    onCheckedChange={(v) => list.forEach((p) => toggle(p.code, !!v))}
                  />{" "}
                  {g}
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {list.map((p) => (
                    <label
                      key={p.code}
                      className="flex items-center gap-2 rounded-lg bg-muted/40 px-2 py-1.5 text-xs"
                    >
                      <Checkbox
                        checked={sel.includes(p.code)}
                        onCheckedChange={(v) => toggle(p.code, !!v)}
                      />
                      <span className="flex-1">{p.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button onClick={save}>ذخیره نقش</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PermsTab() {
  const { data: perms = [] } = usePerms();
  const inv = useInvalidate();
  const [label, setLabel] = useState("");
  const [code, setCode] = useState("");
  const [grp, setGrp] = useState("سفارشی");

  async function add() {
    const c = toPermCode(code || label);
    if (!label.trim() || !c) {
      toast.error("نام و کد مجوز را بنویسید (کد به انگلیسی)");
      return;
    }
    const { error } = await api
      .from("permissions")
      .insert({ code: c, label: label.trim(), grp: grp.trim() || "سفارشی" });
    if (error) {
      toast.error(/duplicate|unique/i.test(error.message) ? "این کد وجود دارد" : errMsg(error));
      return;
    }
    toast.success("مجوز اضافه شد");
    setLabel("");
    setCode("");
    inv("permissions");
  }
  async function remove(c: string) {
    const { error } = await api.from("permissions").delete().eq("code", c);
    if (error) {
      toast.error(errMsg(error));
      return;
    }
    inv("permissions");
  }

  return (
    <>
      <Card className="mb-4 grid gap-3 p-4 shadow-soft sm:grid-cols-4 sm:items-end">
        <Field label="نام مجوز">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="مثلاً: چاپ گزارش"
          />
        </Field>
        <Field label="کد (انگلیسی)">
          <Input
            dir="ltr"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="custom.print"
          />
        </Field>
        <Field label="گروه">
          <Input value={grp} onChange={(e) => setGrp(e.target.value)} />
        </Field>
        <Button onClick={add}>
          <Plus /> افزودن مجوز
        </Button>
      </Card>
      <TableCard>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-start">مجوز</TableHead>
              <TableHead className="text-start">کد</TableHead>
              <TableHead className="text-start">گروه</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {perms.map((p) => (
              <TableRow key={p.code}>
                <TableCell className="font-medium">{p.label}</TableCell>
                <TableCell dir="ltr" className="text-right font-mono text-xs text-muted-foreground">
                  {p.code}
                </TableCell>
                <TableCell>{p.grp}</TableCell>
                <TableCell>
                  {p.is_system ? (
                    <Lock
                      className="ms-auto size-4 text-muted-foreground"
                      aria-label="مجوز سیستمی"
                    />
                  ) : (
                    <ConfirmDelete outline onConfirm={() => remove(p.code)} />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableCard>
    </>
  );
}
