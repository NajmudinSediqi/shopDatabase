import { randomBytes, scrypt, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
import { assert } from "./errors.mjs";
import { requirePermission } from "./data.mjs";
import { insertRecord, lockIdentity } from "./db.mjs";
import { rasterImage } from "./images.mjs";
const derive = promisify(scrypt);
export const hashToken = (value) => createHash("sha256").update(value).digest("hex");
export async function hashPassword(password) {
  assert(
    typeof password === "string" && password.length >= 8 && password.length <= 256,
    400,
    "رمز باید بین ۸ تا ۲۵۶ حرف باشد",
  );
  const salt = randomBytes(16).toString("hex");
  const key = await derive(password, salt, 64);
  return `scrypt:${salt}:${key.toString("hex")}`;
}
export async function checkPassword(password, stored) {
  if (typeof password !== "string" || password.length > 256 || !stored) return false;
  const [algorithm, salt, expected] = stored.split(":");
  if (algorithm !== "scrypt" || !salt || !expected) return false;
  const key = await derive(password, salt, 64),
    target = Buffer.from(expected, "hex");
  return key.length === target.length && timingSafeEqual(key, target);
}
export function normalizeEmail(email) {
  assert(typeof email === "string", 400, "ایمیل نامعتبر است");
  const value = email.trim().toLowerCase();
  assert(value.length <= 255 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), 400, "ایمیل نامعتبر است");
  return value;
}
export function cookieToken(request) {
  return /(?:^|;\s*)ledger_session=([a-f\d]{64})(?:;|$)/.exec(request.headers.cookie ?? "")?.[1];
}
export function sessionCookie(token, production, clear = false) {
  return `ledger_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${clear ? 0 : 604800}${production ? "; Secure" : ""}`;
}
const publicUser = (row) => ({ id: row.id, email: row.email, user_metadata: row.metadata });
export async function currentUser(sql, request) {
  const token = cookieToken(request);
  if (!token) return null;
  const [row] =
    await sql`SELECT u.id,u.email,u.metadata FROM auth_sessions s JOIN auth_users u ON u.id=s.user_id WHERE s.token_hash=${hashToken(token)} AND s.expires_at>UTC_TIMESTAMP(3)`;
  return row ? publicUser(row) : null;
}
async function newSession(sql, userId) {
  const token = randomBytes(32).toString("hex");
  await sql`DELETE FROM auth_sessions WHERE expires_at<=UTC_TIMESTAMP(3)`;
  await sql`INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES (${hashToken(token)},${userId},DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 7 DAY))`;
  return token;
}
async function createAccount(tx, email, metadata, passwordHash = null) {
  const row = await insertRecord(tx, "auth_users", {
    email,
    metadata,
    password_hash: passwordHash,
  });
  await insertRecord(tx, "profiles", {
    id: row.id,
    email,
    full_name: metadata.full_name || email.split("@")[0],
  });
  return row;
}
export async function register(sql, data, allowSignup) {
  const email = normalizeEmail(data.email),
    password = await hashPassword(data.password);
  return sql.begin(async (tx) => {
    await lockIdentity(tx);
    const [{ count }] = await tx`SELECT COUNT(*) AS count FROM auth_users`;
    assert(Number(count) === 0 || allowSignup, 403, "ثبت‌نام بسته است؛ از مدیر دعوت‌نامه بخواهید");
    const row = await createAccount(
      tx,
      email,
      {
        full_name: String(data.fullName ?? "")
          .trim()
          .slice(0, 100),
      },
      password,
    );
    if (Number(count) === 0)
      await insertRecord(tx, "user_roles", { user_id: row.id, role: "admin", role_id: null });
    return { user: publicUser(row), token: await newSession(tx, row.id) };
  });
}
const dummyHash = `scrypt:${"0".repeat(32)}:${"0".repeat(128)}`;
export async function login(sql, data) {
  const email = normalizeEmail(data.email);
  const [row] = await sql`SELECT * FROM auth_users WHERE email=${email}`;
  const valid = await checkPassword(data.password, row?.password_hash ?? dummyHash);
  assert(row && valid, 401, "ایمیل یا رمز عبور نادرست است");
  return { user: publicUser(row), token: await newSession(sql, row.id) };
}
export async function logout(sql, request) {
  const token = cookieToken(request);
  if (token) await sql`DELETE FROM auth_sessions WHERE token_hash=${hashToken(token)}`;
}
export async function invitationStatus(sql, token, lock = false) {
  assert(typeof token === "string" && /^[a-f\d]{64}$/.test(token), 400, "دعوت‌نامه نامعتبر است");
  const [row] = await sql.unsafe(
    "SELECT user_id FROM auth_invitations WHERE token_hash=? AND expires_at>UTC_TIMESTAMP(3)" +
      (lock ? " FOR UPDATE" : ""),
    [hashToken(token)],
  );
  assert(row, 400, "دعوت‌نامه نامعتبر یا منقضی شده است");
  return row;
}
export async function updatePassword(sql, request, data) {
  const password = await hashPassword(data.password);
  return sql.begin(async (tx) => {
    let user;
    if (data.invitationToken) {
      const invitation = await invitationStatus(tx, data.invitationToken, true);
      await tx`DELETE FROM auth_invitations WHERE token_hash=${hashToken(data.invitationToken)}`;
      const [row] =
        await tx`SELECT id,email,metadata FROM auth_users WHERE id=${invitation.user_id}`;
      user = publicUser(row);
    } else {
      user = await currentUser(tx, request);
      assert(user, 401, "ابتدا وارد شوید");
      const [account] =
        await tx`SELECT password_hash FROM auth_users WHERE id=${user.id} FOR UPDATE`;
      assert(
        account?.password_hash &&
          (await checkPassword(data.currentPassword, account.password_hash)),
        403,
        "رمز فعلی نادرست است",
      );
    }
    await tx`UPDATE auth_users SET password_hash=${password} WHERE id=${user.id}`;
    await tx`DELETE FROM auth_sessions WHERE user_id=${user.id}`;
    return { user, token: await newSession(tx, user.id) };
  });
}
export async function updateProfile(sql, request, data) {
  const user = await currentUser(sql, request);
  assert(user, 401, "ابتدا وارد شوید");
  const editable = ["fullName", "email", "avatarUrl", "currentPassword"];
  assert(
    Object.keys(data).length > 0 && Object.keys(data).every((key) => editable.includes(key)),
    400,
    "اطلاعات پروفایل نامعتبر است",
  );
  const fullName =
    data.fullName === undefined
      ? undefined
      : typeof data.fullName === "string" && data.fullName.trim().length <= 100
        ? data.fullName.trim()
        : null;
  assert(fullName !== null, 400, "نام باید حداکثر ۱۰۰ حرف باشد");
  const email = data.email === undefined ? undefined : normalizeEmail(data.email);
  const avatarUrl = data.avatarUrl;
  if (avatarUrl !== undefined && avatarUrl !== null) {
    rasterImage(avatarUrl, 512 * 1024);
    const match =
      typeof avatarUrl === "string" &&
      /^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(avatarUrl);
    assert(
      match &&
        Buffer.from(match[1], "base64").length <= 512 * 1024 &&
        Buffer.from(match[1], "base64").toString("base64") === match[1],
      400,
      "تصویر نامعتبر یا بزرگ‌تر از حد مجاز است",
    );
  }
  return sql.begin(async (tx) => {
    await lockIdentity(tx);
    const [account] =
      await tx`SELECT email,password_hash FROM auth_users WHERE id=${user.id} FOR UPDATE`;
    assert(account, 401, "ابتدا وارد شوید");
    const nextEmail = email ?? account.email;
    if (nextEmail !== account.email) {
      assert(
        account.password_hash && (await checkPassword(data.currentPassword, account.password_hash)),
        403,
        "برای تغییر ایمیل، رمز فعلی را وارد کنید",
      );
      const duplicate =
        await tx`SELECT id FROM auth_users WHERE email=${nextEmail} AND id<>${user.id}`;
      assert(!duplicate.length, 409, "این ایمیل قبلاً استفاده شده است");
    }
    const [profile] =
      await tx`SELECT full_name,avatar_url FROM profiles WHERE id=${user.id} FOR UPDATE`;
    assert(profile, 404, "پروفایل پیدا نشد");
    const nextName = fullName === undefined ? profile.full_name : fullName;
    const nextAvatar = avatarUrl === undefined ? profile.avatar_url : avatarUrl;
    await tx`UPDATE profiles SET email=${nextEmail},full_name=${nextName},avatar_url=${nextAvatar} WHERE id=${user.id}`;
    if (nextEmail !== account.email) {
      await tx`UPDATE auth_users SET email=${nextEmail} WHERE id=${user.id}`;
      const keep = hashToken(cookieToken(request));
      await tx`DELETE FROM auth_sessions WHERE user_id=${user.id} AND token_hash<>${keep}`;
    }
    if (fullName !== undefined)
      await tx`UPDATE auth_users SET metadata=JSON_SET(metadata,'$.full_name',${nextName}) WHERE id=${user.id}`;
    return { ok: true };
  });
}
async function validateRole(tx, roleId) {
  if (roleId && roleId !== "admin") {
    const rows = await tx`SELECT id FROM roles WHERE id=${roleId}`;
    assert(rows.length, 400, "نقش نامعتبر است");
  }
}
async function setRole(tx, userId, roleId) {
  const rows = await tx`SELECT * FROM user_roles WHERE user_id=${userId} FOR UPDATE`;
  if (rows.some((r) => r.role === "admin") && roleId !== "admin") {
    const [{ count }] =
      await tx`SELECT COUNT(*) AS count FROM user_roles WHERE role='admin' AND user_id<>${userId}`;
    assert(Number(count) > 0, 400, "آخرین مدیر فروشگاه را نمی‌توان حذف کرد");
  }
  await tx`DELETE FROM user_roles WHERE user_id=${userId}`;
  if (roleId)
    await insertRecord(tx, "user_roles", {
      user_id: userId,
      role: roleId === "admin" ? "admin" : "staff",
      role_id: roleId === "admin" ? null : roleId,
    });
}
export async function invite(sql, user, data, config, sendMail) {
  requirePermission(user, "admin");
  assert(
    config.smtpHost && config.smtpFrom,
    503,
    "ارسال ایمیل تنظیم نشده است؛ SMTP را در سرور تنظیم کنید",
  );
  const email = normalizeEmail(data.email),
    roleId = String(data.roleId ?? ""),
    token = randomBytes(32).toString("hex");
  await sql.begin(async (tx) => {
    await lockIdentity(tx);
    await validateRole(tx, roleId);
    let [row] = await tx`SELECT * FROM auth_users WHERE email=${email} FOR UPDATE`;
    assert(!row?.password_hash, 409, "این ایمیل قبلاً ثبت شده است");
    if (!row)
      row = await createAccount(tx, email, {
        full_name: String(data.fullName ?? "")
          .trim()
          .slice(0, 100),
      });
    await setRole(tx, row.id, roleId);
    await tx`INSERT INTO auth_invitations(token_hash,user_id,expires_at) VALUES (${hashToken(token)},${row.id},DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 24 HOUR)) ON DUPLICATE KEY UPDATE token_hash=VALUES(token_hash),expires_at=VALUES(expires_at)`;
    await sendMail({
      from: config.smtpFrom,
      to: email,
      subject: "دعوت به سیستم مدیریت فروشگاه",
      text: `برای تعیین رمز عبور این لینک را باز کنید (اعتبار: ۲۴ ساعت):\n${config.appOrigin}/set-password#invitation=${token}`,
    });
  });
  return { ok: true, error: null };
}
export async function assignRole(sql, owner, data) {
  requirePermission(owner, "admin");
  assert(
    typeof data.userId === "string" && /^[a-f\d-]{36}$/i.test(data.userId),
    400,
    "Invalid user",
  );
  const roleId = String(data.roleId ?? "");
  return sql.begin(async (tx) => {
    await lockIdentity(tx);
    await validateRole(tx, roleId);
    const rows = await tx`SELECT id FROM auth_users WHERE id=${data.userId}`;
    assert(rows.length, 404, "User not found");
    await setRole(tx, data.userId, roleId);
    return { ok: true };
  });
}
