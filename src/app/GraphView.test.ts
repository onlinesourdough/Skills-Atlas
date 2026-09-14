import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GraphView } from "./GraphView.js";
import { visibleWorkspace } from "../domain/workspace.js";
import { sixRepositoryFixture } from "../domain/workspace.fixture.js";

afterEach(() => vi.unstubAllGlobals());

describe("repository graph render contract (not browser/layout acceptance)", () => {
  it("renders source identity labels and directed aggregate references separately from overlap entry", () => {
    vi.stubGlobal("window", { matchMedia: () => ({ matches: false }) });
    const sources = sixRepositoryFixture();
    const skills = visibleWorkspace(sources);
    const html = renderToStaticMarkup(
      createElement(GraphView, {
        pack: { ...sources[0]!, skills },
        sources,
        layoutSkills: skills,
        category: "All skills",
        selectedId: "",
        focus: { serial: 0, center: false },
        fitVersion: 0,
        onSelect: () => {},
        onOpen: () => {},
      }),
    );
    expect(html.match(/class="repository-label"/gu)).toHaveLength(6);
    expect(html.match(/class="repository-bridge"/gu)).toHaveLength(2);
    for (const pack of sources)
      expect(html).toContain(`Focus ${pack.repository}, ${pack.skills.length} skills`);
    expect(html).toContain("Possible overlaps");
    expect(html).not.toContain('aria-label="Possible overlaps"'); // closed panel, not graph edges
    expect(html).toContain(
      "synthetic-organization/authoring → synthetic-organization/reviewing: 1 documented references",
    );
  });

  it("renders current evidence in the inspector and excludes removed target enrichment", () => {
    vi.stubGlobal("window", { matchMedia: () => ({ matches: false }) });
    const all = sixRepositoryFixture();
    all[5]!.skills[0]!.name = "WITHHELD SYNTHETIC TITLE";
    const sources = all.slice(0, 5);
    const skills = visibleWorkspace(sources);
    const html = renderToStaticMarkup(
      createElement(GraphView, {
        pack: { ...sources[0]!, skills },
        sources,
        layoutSkills: skills,
        category: "All skills",
        selectedId: sources[0]!.skills[0]!.id,
        focus: { serial: 0, center: false },
        fitVersion: 0,
        onSelect: () => {},
        onOpen: () => {},
      }),
    );
    expect(html).toContain(
      "No unique visible loaded file at this exact repository, revision and path.",
    );
    expect(html).toContain(
      "Shared check · synthetic-organization/reviewing · skills/shared/SKILL.md",
    );
    expect(html).not.toContain("WITHHELD SYNTHETIC TITLE");
    expect(html).not.toContain(all[5]!.skills[0]!.id);
    expect(html.match(/class="graph-edge active cross-repository"/gu)).toHaveLength(1);
  });
});
