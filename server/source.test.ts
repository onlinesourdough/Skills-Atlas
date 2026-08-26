import { mkdtemp, mkdir, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { BUNDLED_SKILLS } from "../src/data/bundled-skills.js";
import { MAX_SKILL_BYTES } from "../src/domain/skill-parser.js";
import { isSafeSourcePath, loadAtlasSnapshot, readLocalSkills } from "./source.js";

const fixtures: string[] = [];

async function fixtureRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "skills-atlas-"));
  fixtures.push(root);
  await mkdir(join(root, "skills", "clarify"), { recursive: true });
  await writeFile(
    join(root, "skills", "clarify", "SKILL.md"),
    "---\nname: clarify\ndescription: Make an uncertain request bounded.\n---\n\n# Clarify\n\nA safe local fixture.\n",
  );
  return root;
}

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(fixtures.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("local skill source", () => {
  it("rejects paths that escape their configured root", () => {
    expect(isSafeSourcePath("/tmp/atlas", "/tmp/atlas/skills/clarify/SKILL.md")).toBe(true);
    expect(isSafeSourcePath("/tmp/atlas", "/tmp/atlas/../outside/SKILL.md")).toBe(false);
  });

  it("reads a valid canonical checkout", async () => {
    const skills = await readLocalSkills(await fixtureRoot());
    expect(skills).toHaveLength(1);
    expect(skills[0]?.sourcePath).toBe("skills/clarify/SKILL.md");
  });

  it("denies an empty source and falls back without exposing a path", async () => {
    const root = await mkdtemp(join(tmpdir(), "skills-atlas-empty-"));
    fixtures.push(root);
    await mkdir(join(root, "skills"));
    await expect(readLocalSkills(root)).rejects.toMatchObject({ code: "empty-source" });
    const snapshot = await loadAtlasSnapshot(root);
    expect(snapshot.source).toBe("bundled");
    expect(snapshot.skills).toEqual(BUNDLED_SKILLS);
    expect(snapshot.warning).toContain("empty-source");
    expect(snapshot.warning).not.toContain(root);
  });

  it("denies symlinked skill directories", async () => {
    const root = await fixtureRoot();
    await symlink(join(root, "skills", "clarify"), join(root, "skills", "linked"));
    await expect(readLocalSkills(root)).rejects.toMatchObject({ code: "unsafe-symlink" });
  });

  it("denies oversized skill files", async () => {
    const root = await fixtureRoot();
    await writeFile(join(root, "skills", "clarify", "SKILL.md"), "x".repeat(MAX_SKILL_BYTES + 1));
    await expect(readLocalSkills(root)).rejects.toMatchObject({ code: "file-too-large" });
  });

  it("denies a source directory over the entry bound", async () => {
    const root = await mkdtemp(join(tmpdir(), "skills-atlas-many-"));
    fixtures.push(root);
    await mkdir(join(root, "skills"));
    await Promise.all(
      Array.from({ length: 101 }, (_, index) => mkdir(join(root, "skills", `skill-${index}`))),
    );
    await expect(readLocalSkills(root)).rejects.toMatchObject({ code: "too-many-skills" });
  });

  it("denies invalid frontmatter and malformed skill paths", async () => {
    const root = await fixtureRoot();
    await writeFile(join(root, "skills", "clarify", "SKILL.md"), "not markdown frontmatter");
    await expect(readLocalSkills(root)).rejects.toMatchObject({ code: "invalid-skill" });
    await expect(readLocalSkills(join(root, "..", "missing-root"))).rejects.toMatchObject({
      code: "invalid-root",
    });
  });
});
