import { describe, expect, it } from "vitest";
import { EXAMPLE_PACK } from "../data/bundled-skills.js";
import {
  authorizedPacks,
  parsePersonalProfile,
  parsePersonalSource,
  type PersonalProfile,
  type PersonalSource,
} from "./personal.js";

describe("personal client authorization lease", () => {
  it("drops unavailable, expired and mismatched sources while renewing only independently verified access", () => {
    const source = {
      id: "a".repeat(36),
      repositoryId: 101,
      repository: "fixture/skills",
      visible: false,
      available: true,
      authorizedUntil: 2000,
    };
    const profile: PersonalProfile = {
      kind: "atlas-profile",
      deployment: "hosted",
      user: { id: 11, login: "alice" },
      csrfToken: "a".repeat(43),
      expiresAt: 1800,
      authorizedUntil: 1900,
      sources: [source],
    };
    const entry: PersonalSource = {
      kind: "atlas-source",
      source,
      pack: {
        ...EXAMPLE_PACK,
        repositoryId: 101,
        repository: source.repository,
        repositoryUrl: `https://github.com/${source.repository}`,
      },
    };
    expect(authorizedPacks(profile, { [source.id]: entry }, 1000)[source.id]?.source).toMatchObject(
      { visible: false, authorizedUntil: 1800 },
    );
    expect(authorizedPacks(profile, { [source.id]: entry }, 1800)).toEqual({});
    expect(
      authorizedPacks(
        { ...profile, sources: [{ ...source, available: false }] },
        { [source.id]: entry },
        1000,
      ),
    ).toEqual({});
    expect(
      authorizedPacks(
        profile,
        { [source.id]: { ...entry, pack: { ...entry.pack, repositoryId: 102 } } },
        1000,
      ),
    ).toEqual({});
    expect(parsePersonalProfile({ ...profile, sources: [source, source] })).toBeNull();
    expect(parsePersonalSource(entry)).toBeNull();
    expect(parsePersonalProfile(profile)?.user.id).toBe(11);
    const renamed = { ...profile, sources: [{ ...source, repository: "fixture/renamed" }] };
    expect(authorizedPacks(renamed, { [source.id]: entry }, 1000)).toEqual({});
    expect(
      authorizedPacks(
        { ...profile, sources: [{ ...source, repositoryId: 102 }] },
        { [source.id]: entry },
        1000,
      ),
    ).toEqual({});
  });
});
