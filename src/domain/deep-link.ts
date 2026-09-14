export interface SkillDestination {
  account: number;
  source: string;
  skill: string;
}

export function skillDestination(search: string): SkillDestination | null {
  const q = new URLSearchParams(search);
  if (!["account", "source", "skill"].every((key) => q.getAll(key).length === 1)) return null;
  const account = Number(q.get("account"));
  const source = q.get("source")!;
  const skill = q.get("skill")!;
  if (
    !Number.isSafeInteger(account) ||
    account <= 0 ||
    !/^[a-f0-9-]{36}$/u.test(source) ||
    !skill ||
    skill.length > 1024
  )
    return null;
  return { account, source, skill };
}

export function internalDestination(value: string | null, origin: string): string | null {
  if (
    !value ||
    value.length > 8192 ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    [...value].some((character) => character.charCodeAt(0) < 32)
  )
    return null;
  const url = new URL(value, origin);
  if (url.origin !== origin) return null;
  if (url.pathname === "/agent/authorize" && !url.hash) return `${url.pathname}${url.search}`;
  if (
    url.pathname !== "/" ||
    !skillDestination(url.search) ||
    !["#library", "#graph"].includes(url.hash) ||
    [...url.searchParams.keys()].some((key) => !["account", "source", "skill"].includes(key))
  )
    return null;
  return `${url.pathname}${url.search}${url.hash}`;
}
