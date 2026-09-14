import type { AtlasPack, ImportPreview } from "../types.js";
import { isRepositoryName, parsePackPayload } from "./contracts.js";

export interface SourcePreference {
  id: string;
  repositoryId: number | null;
  repository: string;
  visible: boolean;
  available: boolean;
  authorizedUntil: number;
}

export interface PersonalProfile {
  kind: "atlas-profile";
  deployment: "hosted" | "self-hosted";
  user: { id: number; login: string };
  csrfToken: string;
  expiresAt: number;
  authorizedUntil: number;
  sources: SourcePreference[];
}

export interface PersonalSource {
  kind: "atlas-source";
  source: SourcePreference;
  pack: AtlasPack;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function timestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function sourcePreference(value: unknown): SourcePreference | null {
  const item = record(value);
  if (
    !item ||
    typeof item.id !== "string" ||
    !/^[a-f0-9-]{36}$/u.test(item.id) ||
    (item.repositoryId !== null &&
      (!Number.isSafeInteger(item.repositoryId) || Number(item.repositoryId) <= 0)) ||
    typeof item.repository !== "string" ||
    !isRepositoryName(item.repository) ||
    typeof item.visible !== "boolean" ||
    typeof item.available !== "boolean" ||
    !timestamp(item.authorizedUntil)
  )
    return null;
  return {
    id: item.id,
    repositoryId: item.repositoryId === null ? null : Number(item.repositoryId),
    repository: item.repository,
    visible: item.visible,
    available: item.available,
    authorizedUntil: item.authorizedUntil,
  };
}

export function parsePersonalProfile(value: unknown): PersonalProfile | null {
  const profile = record(value);
  const user = record(profile?.user);
  if (
    !profile ||
    profile.kind !== "atlas-profile" ||
    !user ||
    (profile.deployment !== "hosted" && profile.deployment !== "self-hosted") ||
    !Number.isSafeInteger(user.id) ||
    Number(user.id) <= 0 ||
    typeof user.login !== "string" ||
    !/^[A-Za-z0-9-]{1,39}$/u.test(user.login) ||
    typeof profile.csrfToken !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/u.test(profile.csrfToken) ||
    !timestamp(profile.expiresAt) ||
    !timestamp(profile.authorizedUntil) ||
    !Array.isArray(profile.sources) ||
    profile.sources.length > 20
  )
    return null;
  const sources = profile.sources.map(sourcePreference);
  if (sources.some((source) => source === null)) return null;
  const valid = sources.filter((source): source is SourcePreference => source !== null);
  if (new Set(valid.map((source) => source.id)).size !== valid.length) return null;
  return {
    kind: "atlas-profile",
    deployment: profile.deployment,
    user: { id: Number(user.id), login: user.login },
    csrfToken: profile.csrfToken,
    expiresAt: profile.expiresAt,
    authorizedUntil: profile.authorizedUntil,
    sources: valid,
  };
}

export function parsePersonalSource(value: unknown): PersonalSource | null {
  const item = record(value);
  const source = sourcePreference(item?.source);
  const pack = parsePackPayload(item?.pack);
  if (
    item?.kind !== "atlas-source" ||
    !source ||
    !source.available ||
    !pack ||
    pack.source !== "github" ||
    pack.access !== "read" ||
    pack.repositoryId !== source.repositoryId ||
    pack.repository !== source.repository
  )
    return null;
  return { kind: "atlas-source", source, pack };
}

export function parseImportPreview(value: unknown): ImportPreview | null {
  const item = record(value);
  const pack = parsePackPayload(item?.pack);
  if (
    item?.kind !== "atlas-source-preview" ||
    !pack ||
    pack.source !== "github" ||
    pack.access !== "read" ||
    !timestamp(item.authorizedUntil)
  )
    return null;
  return { pack, authorizedUntil: item.authorizedUntil };
}

export function authorizedPacks(
  profile: PersonalProfile,
  packs: Record<string, PersonalSource>,
  now: number,
): Record<string, PersonalSource> {
  if (profile.expiresAt <= now || profile.authorizedUntil <= now) return {};
  return Object.fromEntries(
    profile.sources.flatMap((source) => {
      const entry = packs[source.id];
      return source.available &&
        source.authorizedUntil > now &&
        entry &&
        entry.pack.repositoryId === source.repositoryId &&
        entry.pack.repository === source.repository &&
        entry.pack.repositoryUrl === `https://github.com/${source.repository}`
        ? [
            [
              source.id,
              {
                ...entry,
                source: {
                  ...source,
                  authorizedUntil: Math.min(
                    source.authorizedUntil,
                    profile.authorizedUntil,
                    profile.expiresAt,
                  ),
                },
              },
            ],
          ]
        : [];
    }),
  );
}

export class PersonalApiError extends Error {
  constructor(readonly code: string) {
    super(personalMessage(code));
  }
}

export function personalMessage(code: string): string {
  const messages: Record<string, string> = {
    "login-required": "Sign in with GitHub to open your Atlas profile.",
    "session-expired": "Your access has expired or changed. Sign in again to continue.",
    "access-denied":
      "This GitHub account does not have access to this Atlas. Check your membership or switch accounts.",
    "membership-pending":
      "Your organization invitation is pending. Accept it on GitHub, then sign in again.",
    "authorization-rate-limited":
      "GitHub’s read limit was reached. Content is locked until access can be checked again. Retry later.",
    "authorization-unavailable":
      "GitHub access could not be verified. Content is locked. Retry when the connection is available.",
    "service-unavailable":
      "Atlas could not complete the request. Retry, or contact the operator if it continues.",
    "login-unavailable": "GitHub sign-in is not configured for this Atlas. Contact the operator.",
    "oauth-invalid": "GitHub sign-in could not be completed. Start a new sign-in attempt.",
    "oauth-expired": "This sign-in attempt expired. Start again.",
    "login-rate-limited": "Too many sign-in attempts are pending. Try again later.",
    "source-unavailable":
      "Source unavailable. Check your GitHub access and the app’s selected repositories, then retry.",
    "source-limit":
      "This profile supports up to 20 sources. Remove a source before adding another.",
    "source-name-changed":
      "A saved repository has changed its name. Refresh that saved source, then retry this import.",
    "preview-changed": "This repository changed after preview. Preview it again before importing.",
    "csrf-denied": "The request could not be verified. Refresh your access and try again.",
    "origin-denied": "Open this Atlas at its configured address and try again.",
    "invalid-repository": "Use a repository in owner/name format.",
    "read-only": "This Atlas currently supports read-only GitHub access.",
    "legacy-auth-retired":
      "Shared admin login has been retired. Use the personal GitHub login edition.",
    "provider-timeout": "GitHub did not respond in time. Retry the source.",
    "rate-limited": "GitHub’s read limit was reached. Retry the source later.",
    "empty-repository":
      "No supported SKILL.md files were found in the repository’s root skills or .agents/skills shelves.",
  };
  return (
    messages[code] ?? "Atlas could not load this source safely. Check the repository and try again."
  );
}
