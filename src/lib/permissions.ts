import dependencies from "../../shared/permission-dependencies.json";

const requirements: Record<string, string[]> = dependencies;
const dependenciesFor = (code: string) =>
  Object.hasOwn(requirements, code) ? requirements[code]! : [];

/** Add the page/read permissions needed by selected actions. */
export function withPermissionDependencies(codes: readonly string[]): string[] {
  const result = new Set(codes);
  for (const code of result) for (const dependency of dependenciesFor(code)) result.add(dependency);
  return [...result];
}

/** Turning off a page also turns off actions which require that page. */
export function togglePermission(
  codes: readonly string[],
  code: string,
  enabled: boolean,
): string[] {
  if (enabled) return withPermissionDependencies([...codes, code]);
  let result = codes.filter((item) => item !== code);
  let previous: number;
  do {
    previous = result.length;
    result = result.filter((item) =>
      dependenciesFor(item).every((dependency) => result.includes(dependency)),
    );
  } while (result.length !== previous);
  return result;
}

/** Owner can do everything; actions also require their page permissions. */
export function canDo(isAdmin: boolean, perms: readonly string[], code: string): boolean {
  return (
    isAdmin ||
    (code !== "assistant.view" &&
      perms.includes(code) &&
      dependenciesFor(code).every((dependency) => canDo(false, perms, dependency)))
  );
}

/** Turn a typed label into a safe permission code, e.g. "Print reports" -> "custom.print_reports". */
export function toPermCode(raw: string) {
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!s) return "";
  return s.includes(".") ? s : `custom.${s}`;
}
