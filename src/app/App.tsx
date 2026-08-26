import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { BUNDLED_SKILLS } from "../data/bundled-skills.js";
import { answerQuestion, categoriesForSkills, filterSkills, findSkill } from "../domain/atlas.js";
import { parseSnapshotPayload } from "../domain/contracts.js";
import type { AskAnswer, AtlasSkill, FixtureName, SourceKind } from "../types.js";

type ViewName = "graph" | "library" | "usage" | "setup";
type RouteName = ViewName | "start" | "detail" | "activity" | "ask";

const STATIC_PUBLIC_DEMO = import.meta.env.MODE === "static";
const DEFAULT_SKILL: AtlasSkill = BUNDLED_SKILLS[0]!;
const PRIMARY_VIEWS: Array<{ view: ViewName; label: string }> = [
  { view: "graph", label: "Graph" },
  { view: "library", label: "Library" },
  { view: "usage", label: "Usage" },
];

const FIXTURE_COPY: Record<
  FixtureName,
  { icon: string; title: string; detail: string; action: string }
> = {
  success: {
    icon: "✓",
    title: "Public snapshot ready",
    detail: "The bundled Atlas is available without a connection or account.",
    action: "Ready",
  },
  loading: {
    icon: "…",
    title: "Reading the source",
    detail: "A bounded source read is in progress while the safe snapshot remains available.",
    action: "Loading",
  },
  empty: {
    icon: "∅",
    title: "No skills found",
    detail: "Broaden the filter or point the Node Atlas at a checkout with skills/ entries.",
    action: "Empty",
  },
  error: {
    icon: "!",
    title: "Source read failed",
    detail: "The bundled snapshot remains usable while an operator repairs the source.",
    action: "Fallback",
  },
  permission: {
    icon: "⊘",
    title: "Write denied",
    detail: "The public Atlas never enables Git writes or implies private repository access.",
    action: "Read only",
  },
  offline: {
    icon: "⌁",
    title: "Browsing offline",
    detail: "The packaged index still supports graph, library, search, and deterministic Ask.",
    action: "Offline",
  },
};

const TOUR_PAGES = [
  {
    label: "Atlas",
    kicker: "A map for repeatable work",
    title: "Keep team skills findable.",
    description:
      "See the instructions behind your agents in one calm, public-first product surface.",
    detail: "Start with a safe snapshot. Connect a checkout only when an owner is ready.",
  },
  {
    label: "Scattered",
    kicker: "The distribution problem",
    title: "Useful instructions scatter quickly.",
    description:
      "A laptop, an agent folder, and a project note can each hold a different copy of the same practice.",
    detail: "A shared map makes the drift visible without pretending to replace Git.",
  },
  {
    label: "Edits",
    kicker: "Local copies diverge",
    title: "Good edits should not stay isolated.",
    description:
      "When improvements remain in local copies, teammates keep running yesterday’s version.",
    detail: "The Atlas points every readable record back to one canonical source path.",
  },
  {
    label: "Library",
    kicker: "One shared shelf",
    title: "Give the team a common library.",
    description:
      "Search, inspect, and connect related skills while the repository keeps ownership of the files.",
    detail: "Public editing stays denied; a mounted checkout is a separate operator decision.",
  },
  {
    label: "Latest",
    kicker: "Reviewed distribution",
    title: "Let everyone follow the reviewed version.",
    description:
      "A stable Git path makes the latest approved skill available to each supported agent harness.",
    detail: "Enter the bundled Atlas now. No sign-in, token, or model provider is required.",
  },
] as const;

const CATEGORY_LAYOUT: Record<
  string,
  { x: string; y: string; size: string; tone: AtlasSkill["tone"] }
> = {
  "Shape the work": { x: "49%", y: "17%", size: "230px", tone: "blue" },
  "Govern the shelf": { x: "19%", y: "36%", size: "180px", tone: "mint" },
  "Route responsibly": { x: "78%", y: "36%", size: "150px", tone: "gold" },
  "Prove the result": { x: "38%", y: "70%", size: "205px", tone: "clay" },
  "Distribute the work": { x: "70%", y: "72%", size: "185px", tone: "violet" },
  "Team practice": { x: "49%", y: "45%", size: "190px", tone: "mint" },
};

const NODE_OFFSETS = [
  { x: "46%", y: "48%" },
  { x: "64%", y: "61%" },
  { x: "35%", y: "68%" },
];
function initialView(): ViewName {
  const route = window.location.hash.slice(1) as RouteName;
  if (route === "library" || route === "detail") return "library";
  if (route === "usage" || route === "activity") return "usage";
  if (route === "setup") return "setup";
  return "graph";
}

function initialTourOpen(): boolean {
  const params = new URLSearchParams(window.location.search);
  if (params.get("tour") === "1") return true;
  if (window.location.hash) return false;
  return window.localStorage.getItem("os-atlas-tour-complete") !== "1";
}

function initialAskOpen(): boolean {
  return window.location.hash.slice(1) === "ask";
}

function toneClass(tone: AtlasSkill["tone"]): string {
  return `tone-${tone}`;
}

function App(): ReactNode {
  const [view, setView] = useState<ViewName>(initialView);
  const [skills, setSkills] = useState<AtlasSkill[]>(BUNDLED_SKILLS);
  const [source, setSource] = useState<SourceKind>("bundled");
  const [sourceWarning, setSourceWarning] = useState<string | undefined>();
  const [sourceLoading, setSourceLoading] = useState(!STATIC_PUBLIC_DEMO);
  const [selectedSlug, setSelectedSlug] = useState(BUNDLED_SKILLS[0]?.slug ?? "clarify");
  const [libraryQuery, setLibraryQuery] = useState("");
  const [libraryCategory, setLibraryCategory] = useState("All skills");
  const [detailTab, setDetailTab] = useState<"read" | "edit">("read");
  const [fixture, setFixture] = useState<FixtureName>("success");
  const [tourOpen, setTourOpen] = useState(initialTourOpen);
  const [tourStep, setTourStep] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(initialAskOpen);
  const [askQuery, setAskQuery] = useState("");
  const [askAnswer, setAskAnswer] = useState<AskAnswer | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [setupChoice, setSetupChoice] = useState("public");
  const [setupResult, setSetupResult] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLButtonElement>(null);
  const askRef = useRef<HTMLButtonElement>(null);
  const tourReturnRef = useRef<HTMLElement | null>(null);

  const selectedSkill = useMemo(
    () => findSkill(skills, selectedSlug) ?? skills[0] ?? DEFAULT_SKILL,
    [selectedSlug, skills],
  );
  const filteredSkills = useMemo(
    () => filterSkills(skills, libraryQuery, libraryCategory),
    [libraryCategory, libraryQuery, skills],
  );

  useEffect(() => {
    if (STATIC_PUBLIC_DEMO) {
      setSourceLoading(false);
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 2500);
    void fetch("/api/skills", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("api-unavailable");
        const payload: unknown = await response.json();
        const snapshot = parseSnapshotPayload(payload);
        if (!snapshot) throw new Error("invalid-api-payload");
        setSkills(snapshot.skills);
        setSource(snapshot.source);
        setSourceWarning(snapshot.warning);
      })
      .catch(() => {
        setSource("bundled");
        setSourceWarning("The live source is unavailable; the bundled snapshot remains ready.");
      })
      .finally(() => {
        window.clearTimeout(timeout);
        setSourceLoading(false);
      });
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tour") !== "1") return;
    const requested = Number.parseInt(params.get("tourStep") ?? "1", 10);
    setTourStep(Math.min(TOUR_PAGES.length - 1, Math.max(0, requested - 1)));
    setTourOpen(true);
  }, []);

  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true });
  }, [view]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeDrawer(true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function navigate(nextView: RouteName): void {
    if (nextView === "start") {
      openTour();
      return;
    }
    if (nextView === "ask") {
      setAskOpen(true);
      setDrawerOpen(false);
      return;
    }
    const normalized: ViewName =
      nextView === "detail" ? "library" : nextView === "activity" ? "usage" : nextView;
    setView(normalized);
    window.history.replaceState(null, "", `#${normalized}`);
    setDrawerOpen(false);
  }

  function openSkill(slug: string): void {
    setSelectedSlug(slug);
    setDetailTab("read");
    setView("library");
    setDrawerOpen(false);
    window.history.replaceState(null, "", "#library");
  }

  function closeDrawer(restoreFocus = false): void {
    setDrawerOpen(false);
    if (restoreFocus) window.setTimeout(() => menuRef.current?.focus(), 0);
  }

  function closeSearch(): void {
    setSearchOpen(false);
    window.setTimeout(() => searchRef.current?.focus(), 0);
  }

  function closeAsk(): void {
    setAskOpen(false);
    if (window.location.hash === "#ask") window.history.replaceState(null, "", `#${view}`);
    window.setTimeout(() => askRef.current?.focus(), 0);
  }

  function openTour(step = 0): void {
    const active = document.activeElement;
    tourReturnRef.current = active instanceof HTMLElement ? active : null;
    setTourStep(step);
    setTourOpen(true);
    writeTourUrl(step);
  }

  function writeTourUrl(step: number): void {
    const params = new URLSearchParams(window.location.search);
    params.set("tour", "1");
    params.set("tourStep", String(step + 1));
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}?${params.toString()}${window.location.hash}`,
    );
  }

  function clearTourUrl(): void {
    const params = new URLSearchParams(window.location.search);
    params.delete("tour");
    params.delete("tourStep");
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash || "#graph"}`,
    );
  }

  function closeTour(): void {
    setTourOpen(false);
    window.localStorage.setItem("os-atlas-tour-complete", "1");
    const target = tourReturnRef.current;
    tourReturnRef.current = null;
    clearTourUrl();
    window.setTimeout(() => target?.focus(), 0);
  }

  function finishTour(): void {
    setTourOpen(false);
    window.localStorage.setItem("os-atlas-tour-complete", "1");
    tourReturnRef.current = null;
    clearTourUrl();
    navigate("graph");
    window.setTimeout(() => mainRef.current?.focus({ preventScroll: true }), 0);
  }

  function runAsk(question = askQuery): void {
    setAskQuery(question);
    setAskAnswer(answerQuestion(question, skills));
  }

  const sourceDetail = source === "local" ? "Mounted checkout" : "Bundled public snapshot";

  return (
    <div className="app-shell">
      <Topbar
        view={view}
        count={skills.length}
        source={source}
        menuRef={menuRef}
        searchRef={searchRef}
        onMenu={() => setDrawerOpen(true)}
        onNavigate={navigate}
        onSearch={() => setSearchOpen(true)}
        onTour={() => openTour()}
        onSetup={() => navigate("setup")}
      />
      <div className="shell-body">
        <Sidebar
          skills={skills}
          source={source}
          sourceDetail={sourceDetail}
          category={libraryCategory}
          open={drawerOpen}
          onCategory={(category) => {
            setLibraryCategory(category);
            setDrawerOpen(false);
          }}
          onClose={() => closeDrawer(true)}
          onSetup={() => navigate("setup")}
        />
        {drawerOpen ? (
          <button
            className="drawer-backdrop"
            aria-label="Close navigation"
            onClick={() => closeDrawer(true)}
          />
        ) : null}
        <main id="main" ref={mainRef} className="product-main" tabIndex={-1}>
          {sourceWarning ? (
            <div className="source-warning" role="status">
              <span>{sourceWarning}</span>
              <button
                onClick={() => setSourceWarning(undefined)}
                aria-label="Dismiss source notice"
              >
                ×
              </button>
            </div>
          ) : null}
          {view === "graph" ? (
            <GraphView
              skills={skills}
              selectedSkill={selectedSkill}
              category={libraryCategory}
              sourceLoading={sourceLoading}
              onSelect={setSelectedSlug}
              onOpenSkill={openSkill}
            />
          ) : null}
          {view === "library" ? (
            <LibraryView
              skills={skills}
              query={libraryQuery}
              category={libraryCategory}
              filteredSkills={filteredSkills}
              selectedSkill={selectedSkill}
              detailTab={detailTab}
              onQuery={setLibraryQuery}
              onCategory={setLibraryCategory}
              onSelect={setSelectedSlug}
              onTab={setDetailTab}
              onOpenSkill={openSkill}
            />
          ) : null}
          {view === "usage" ? <UsageView skills={skills} /> : null}
          {view === "setup" ? (
            <SetupView
              choice={setupChoice}
              result={setupResult}
              fixture={fixture}
              onChoice={setSetupChoice}
              onPreview={() => setSetupResult(true)}
              onFixture={setFixture}
            />
          ) : null}
        </main>
      </div>
      <button
        ref={askRef}
        className="ask-fab"
        aria-haspopup="dialog"
        onClick={() => setAskOpen(true)}
      >
        <span className="ask-status" aria-hidden="true" />
        Ask the Atlas
      </button>
      <TourDialog
        open={tourOpen}
        step={tourStep}
        onStep={(next) => {
          setTourStep(next);
          writeTourUrl(next);
        }}
        onClose={closeTour}
        onExplore={finishTour}
      />
      <SearchDialog
        open={searchOpen}
        skills={skills}
        onClose={closeSearch}
        onOpenSkill={(slug) => {
          closeSearch();
          openSkill(slug);
        }}
      />
      <AskDialog
        open={askOpen}
        query={askQuery}
        answer={askAnswer}
        onQuery={setAskQuery}
        onAsk={() => runAsk()}
        onQuestion={runAsk}
        onOpenSkill={(slug) => {
          closeAsk();
          openSkill(slug);
        }}
        onClose={closeAsk}
      />
    </div>
  );
}

interface TopbarProps {
  view: ViewName;
  count: number;
  source: SourceKind;
  menuRef: RefObject<HTMLButtonElement | null>;
  searchRef: RefObject<HTMLButtonElement | null>;
  onMenu: () => void;
  onNavigate: (view: RouteName) => void;
  onSearch: () => void;
  onTour: () => void;
  onSetup: () => void;
}

function Topbar({
  view,
  count,
  source,
  menuRef,
  searchRef,
  onMenu,
  onNavigate,
  onSearch,
  onTour,
  onSetup,
}: TopbarProps): ReactNode {
  return (
    <header className="topbar">
      <button
        ref={menuRef}
        className="icon-button menu-button"
        aria-label="Open navigation"
        onClick={onMenu}
      >
        ☰
      </button>
      <button className="topbar-brand" onClick={onTour} aria-label="Replay Atlas onboarding">
        <span className="brand-mark" aria-hidden="true">
          os
        </span>
        <strong>Skills Atlas</strong>
      </button>
      <nav className="primary-tabs" aria-label="Primary">
        {PRIMARY_VIEWS.map((item) => (
          <button
            key={item.view}
            aria-current={view === item.view ? "page" : undefined}
            onClick={() => onNavigate(item.view)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <span className="topbar-spacer" />
      <button className="source-trigger" onClick={onSetup}>
        <span className={`source-dot${source === "local" ? " local" : ""}`} />
        {source === "local" ? "Local source" : "Public source"}
      </button>
      <span className="skill-count">{count} skills</span>
      <button
        ref={searchRef}
        className="search-trigger"
        onClick={onSearch}
        aria-haspopup="dialog"
        aria-label="Search skills"
      >
        <span aria-hidden="true">⌕</span>
        <span>Search skills</span>
        <kbd>⌘ K</kbd>
      </button>
      <span className="avatar" aria-label="Online Sourdough public preview">
        OS
      </span>
    </header>
  );
}

interface SidebarProps {
  skills: AtlasSkill[];
  source: SourceKind;
  sourceDetail: string;
  category: string;
  open: boolean;
  onCategory: (category: string) => void;
  onClose: () => void;
  onSetup: () => void;
}

function Sidebar({
  skills,
  source,
  sourceDetail,
  category,
  open,
  onCategory,
  onClose,
  onSetup,
}: SidebarProps): ReactNode {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia("(max-width: 820px)").matches);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 820px)");
    const syncMobileState = () => setIsMobile(mediaQuery.matches);
    mediaQuery.addEventListener("change", syncMobileState);
    return () => mediaQuery.removeEventListener("change", syncMobileState);
  }, []);

  const closedMobile = isMobile && !open;
  const categories = categoriesForSkills(skills);
  const counts = new Map<string, number>();
  for (const skill of skills) counts.set(skill.category, (counts.get(skill.category) ?? 0) + 1);

  return (
    <aside
      className={`rail${open ? " rail-open" : ""}`}
      aria-label="Atlas taxonomy"
      aria-hidden={closedMobile ? true : undefined}
      inert={closedMobile}
    >
      <div className="rail-mobile-head">
        <span className="label">Atlas filters</span>
        <button className="icon-button rail-close" aria-label="Close navigation" onClick={onClose}>
          ×
        </button>
      </div>
      <section className="taxonomy-section" aria-labelledby="departments-title">
        <h2 id="departments-title" className="rail-heading">
          Departments
        </h2>
        <button
          className="taxonomy-item all-skills"
          aria-pressed={category === "All skills"}
          onClick={() => onCategory("All skills")}
        >
          <span>All skills</span>
          <small>{skills.length}</small>
        </button>
        {categories.slice(1).map((item, index) => (
          <button
            className="taxonomy-item"
            key={item}
            aria-pressed={category === item}
            onClick={() => onCategory(item)}
          >
            <i className={`taxonomy-dot category-${index + 1}`} aria-hidden="true" />
            <span>{item}</span>
            <small>{counts.get(item) ?? 0}</small>
          </button>
        ))}
      </section>
      <section className="taxonomy-section packs" aria-labelledby="packs-title">
        <h2 id="packs-title" className="rail-heading">
          Source groups · read only
        </h2>
        <button className="taxonomy-item source-group" onClick={() => onCategory("All skills")}>
          <i className="source-ring" aria-hidden="true" />
          <span>Public snapshot</span>
          <small>{skills.length}</small>
        </button>
        <button className="taxonomy-item source-group" onClick={onSetup}>
          <i className="source-ring" aria-hidden="true" />
          <span>{source === "local" ? "Mounted checkout" : "Local checkout"}</span>
          <small>{source === "local" ? skills.length : "—"}</small>
        </button>
      </section>
      <div className="rail-key">
        <span>
          <i className="relation-key connected" /> related
        </span>
        <span>
          <i className="relation-key faint" /> indirect
        </span>
      </div>
      <button className="rail-source" onClick={onSetup}>
        <span className="label">Current source</span>
        <strong>{sourceDetail}</strong>
        <small>Git canonical · read only</small>
      </button>
    </aside>
  );
}

function GraphView({
  skills,
  selectedSkill,
  category,
  sourceLoading,
  onSelect,
  onOpenSkill,
}: {
  skills: AtlasSkill[];
  selectedSkill: AtlasSkill;
  category: string;
  sourceLoading: boolean;
  onSelect: (slug: string) => void;
  onOpenSkill: (slug: string) => void;
}): ReactNode {
  return (
    <section className="graph-view" aria-labelledby="graph-title">
      <div className="surface-heading">
        <div>
          <p className="eyebrow">Relationship map · public read</p>
          <h1 id="graph-title">Skills connect into a working system.</h1>
        </div>
        <p>
          {sourceLoading
            ? "Checking configured source…"
            : "Select a node to inspect its safe record."}
        </p>
      </div>
      <RelationMap
        skills={skills}
        selectedSlug={selectedSkill.slug}
        category={category}
        onSelect={onSelect}
      />
      <SkillPreview skill={selectedSkill} onOpen={onOpenSkill} />
    </section>
  );
}

function RelationMap({
  skills,
  selectedSlug,
  category,
  onSelect,
}: {
  skills: AtlasSkill[];
  selectedSlug: string;
  category: string;
  onSelect: (slug: string) => void;
}): ReactNode {
  const categories = categoriesForSkills(skills)
    .slice(1)
    .filter((categoryName) => skills.some((skill) => skill.category === categoryName));
  return (
    <div className="relation-map" aria-label="Selectable clustered skill relation graph">
      <svg
        className="cluster-links"
        viewBox="0 0 1000 680"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d="M490 160 C380 230 300 280 205 300" />
        <path d="M520 160 C630 220 710 260 780 300" />
        <path d="M480 205 C460 330 410 410 390 520" />
        <path d="M540 205 C590 330 660 420 695 530" />
        <path d="M225 345 C330 430 510 500 680 545" />
        <path d="M760 350 C650 430 540 475 405 520" />
      </svg>
      {categories.map((categoryName) => {
        const layout = CATEGORY_LAYOUT[categoryName] ?? CATEGORY_LAYOUT["Team practice"]!;
        const categorySkills = skills.filter((skill) => skill.category === categoryName);
        const muted = category !== "All skills" && category !== categoryName;
        const style = {
          "--cluster-x": layout.x,
          "--cluster-y": layout.y,
          "--cluster-size": layout.size,
        } as CSSProperties;
        return (
          <div
            className={`skill-cluster ${toneClass(layout.tone)}${muted ? " is-muted" : ""}`}
            style={style}
            key={categoryName}
            role="group"
            aria-label={`${categoryName}, ${categorySkills.length} skills`}
          >
            <span className="cluster-label">
              {categoryName} <small>{categorySkills.length}</small>
            </span>
            <span className="satellite satellite-a" aria-hidden="true" />
            <span className="satellite satellite-b" aria-hidden="true" />
            <span className="satellite satellite-c" aria-hidden="true" />
            {categorySkills.map((skill, index) => {
              const position = NODE_OFFSETS[index] ?? NODE_OFFSETS[0]!;
              const nodeStyle = {
                "--node-x": position.x,
                "--node-y": position.y,
              } as CSSProperties;
              return (
                <button
                  className="cluster-node"
                  style={nodeStyle}
                  key={skill.slug}
                  aria-pressed={selectedSlug === skill.slug}
                  aria-label={`${skill.name}, ${skill.category}`}
                  onClick={() => onSelect(skill.slug)}
                >
                  <i aria-hidden="true" />
                  <span>{skill.name}</span>
                </button>
              );
            })}
          </div>
        );
      })}
      <p className="graph-caption">
        Decorative satellite nodes show library density, not customer records.
      </p>
    </div>
  );
}

function SkillPreview({
  skill,
  onOpen,
}: {
  skill: AtlasSkill;
  onOpen: (slug: string) => void;
}): ReactNode {
  return (
    <aside className="skill-preview" aria-live="polite">
      <div className="preview-title">
        <i className={`preview-dot ${toneClass(skill.tone)}`} aria-hidden="true" />
        <div>
          <span className="label">Selected skill</span>
          <h2>{skill.name}</h2>
        </div>
        <span className="version-pill">{skill.version}</span>
      </div>
      <p>{skill.description}</p>
      <code>{skill.sourcePath}</code>
      <div className="preview-relations">
        {skill.relations.slice(0, 3).map((relation) => (
          <span key={relation}>{relation}</span>
        ))}
      </div>
      <button className="text-button" onClick={() => onOpen(skill.slug)}>
        Inspect in Library <span aria-hidden="true">→</span>
      </button>
    </aside>
  );
}

function LibraryView({
  skills,
  query,
  category,
  filteredSkills,
  selectedSkill,
  detailTab,
  onQuery,
  onCategory,
  onSelect,
  onTab,
  onOpenSkill,
}: {
  skills: AtlasSkill[];
  query: string;
  category: string;
  filteredSkills: AtlasSkill[];
  selectedSkill: AtlasSkill;
  detailTab: "read" | "edit";
  onQuery: (query: string) => void;
  onCategory: (category: string) => void;
  onSelect: (slug: string) => void;
  onTab: (tab: "read" | "edit") => void;
  onOpenSkill: (slug: string) => void;
}): ReactNode {
  return (
    <section className="library-workspace" aria-labelledby="library-title">
      <div className="library-pane">
        <header className="library-head">
          <div>
            <p className="eyebrow">Library · public snapshot</p>
            <h1 id="library-title">{category}</h1>
          </div>
          <span>
            {filteredSkills.length} of {skills.length}
          </span>
        </header>
        <div className="library-controls">
          <label className="search-field" htmlFor="library-search">
            <span aria-hidden="true">⌕</span>
            <input
              id="library-search"
              value={query}
              onChange={(event) => onQuery(event.target.value)}
              placeholder="Search skills"
            />
          </label>
          <label className="select-field" htmlFor="library-category">
            <span className="sr-only">Department</span>
            <select
              id="library-category"
              value={category}
              onChange={(event) => onCategory(event.target.value)}
            >
              {categoriesForSkills(skills).map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="library-list" aria-live="polite">
          {filteredSkills.length ? (
            filteredSkills.map((skill) => (
              <button
                className={`skill-list-row${selectedSkill.slug === skill.slug ? " is-selected" : ""}`}
                key={skill.slug}
                aria-pressed={selectedSkill.slug === skill.slug}
                onClick={() => {
                  onSelect(skill.slug);
                  onTab("read");
                }}
              >
                <span className="row-title">
                  <i className={`row-dot ${toneClass(skill.tone)}`} aria-hidden="true" />
                  <strong>{skill.name}</strong>
                  <small>{skill.usage} demo refs</small>
                </span>
                <span className="row-summary">{skill.description}</span>
                <code>{skill.sourcePath}</code>
              </button>
            ))
          ) : (
            <div className="empty-state">
              <strong>No skill matches that filter.</strong>
              <p>Try a wider term or return to the complete bundled shelf.</p>
              <button
                className="button"
                onClick={() => {
                  onQuery("");
                  onCategory("All skills");
                }}
              >
                Reset library
              </button>
            </div>
          )}
        </div>
      </div>
      <SkillDetailPane
        skill={selectedSkill}
        tab={detailTab}
        onTab={onTab}
        onOpenSkill={onOpenSkill}
      />
    </section>
  );
}

function SkillDetailPane({
  skill,
  tab,
  onTab,
  onOpenSkill,
}: {
  skill: AtlasSkill;
  tab: "read" | "edit";
  onTab: (tab: "read" | "edit") => void;
  onOpenSkill: (slug: string) => void;
}): ReactNode {
  return (
    <aside className="detail-pane" aria-labelledby="skill-detail-title">
      <header className="detail-pane-head">
        <div>
          <p className="eyebrow">Skill record · public read</p>
          <h2 id="skill-detail-title">{skill.name}</h2>
          <p>
            {skill.category} · {skill.slug}
          </p>
        </div>
        <button className="button compact" onClick={() => onTab(tab === "read" ? "edit" : "read")}>
          {tab === "read" ? "Edit shape" : "Cancel"}
        </button>
      </header>
      <div className="detail-meta">
        <span>{skill.version}</span>
        <code>{skill.sourcePath}</code>
      </div>
      {tab === "read" ? (
        <div className="detail-copy">
          <p className="detail-lede">{skill.description}</p>
          <h3>Safe excerpt</h3>
          <p>{skill.excerpt}</p>
          <blockquote>
            This preview is deliberately short. Follow the source path for the canonical skill.
          </blockquote>
          <h3>Frontmatter shape</h3>
          <pre>{`---\nname: ${skill.slug}\ndescription: ${skill.description}\n---`}</pre>
          <h3>Related skills</h3>
          <div className="detail-relations">
            {skill.relations.map((relation) => (
              <button key={relation} onClick={() => onOpenSkill(relation)}>
                {relation} →
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="detail-copy edit-shape">
          <div className="permission" role="status">
            <strong>Editing is denied in the public Atlas.</strong>
            <p>Git remains canonical. This surface performs no write or provider action.</p>
          </div>
          <label htmlFor="skill-editor">Read-only editor preview</label>
          <textarea
            id="skill-editor"
            value={`---\nname: ${skill.slug}\ndescription: ${skill.description}\n---\n\n${skill.excerpt}`}
            readOnly
            rows={16}
          />
          <div className="editor-actions">
            <span>Permission required</span>
            <button className="button primary" disabled>
              Save to Git
            </button>
          </div>
        </div>
      )}
      <footer className="detail-foot">
        {skill.usage} demo references · {skill.relations.length} relations · write denied
      </footer>
    </aside>
  );
}

function UsageView({ skills }: { skills: AtlasSkill[] }): ReactNode {
  const ranked = [...skills].sort((left, right) => right.usage - left.usage);
  const maximum = ranked[0]?.usage ?? 1;
  const total = skills.reduce((sum, skill) => sum + skill.usage, 0);
  const quiet = ranked.filter((skill) => skill.usage <= 18);
  const events = [
    ["09:42", "Proof loop opened from Graph", "Bundled fixture · not a Git write"],
    ["09:18", "Source audit inspected", "Public snapshot · read only"],
    ["Yesterday", "Route models related", "Demo activity · no model call"],
  ];
  return (
    <section className="usage-view" aria-labelledby="usage-title">
      <header className="usage-head">
        <div>
          <p className="eyebrow">Demo fixture · not live telemetry</p>
          <h1 id="usage-title">Usage</h1>
        </div>
        <span className="demo-badge">DEMO DATA</span>
      </header>
      <div className="usage-metrics">
        <div>
          <strong>{total}</strong>
          <span>fixture references</span>
        </div>
        <div>
          <strong>{skills.length}</strong>
          <span>skills represented</span>
        </div>
        <div>
          <strong>0</strong>
          <span>telemetry writes</span>
        </div>
      </div>
      <p className="usage-note">Deterministic bundled numbers for reviewing the product shape.</p>
      <section className="ranked-usage" aria-labelledby="most-used-title">
        <h2 id="most-used-title">Most used</h2>
        <ol>
          {ranked.map((skill, index) => (
            <li key={skill.slug}>
              <span className="rank">{index + 1}</span>
              <strong>{skill.name}</strong>
              <span className="usage-bar" aria-hidden="true">
                <i
                  className={toneClass(skill.tone)}
                  style={{ width: `${Math.max(8, Math.round((skill.usage / maximum) * 100))}%` }}
                />
              </span>
              <span>{skill.usage}</span>
              <small>fixture</small>
            </li>
          ))}
        </ol>
      </section>
      <section className="quiet-skills" aria-labelledby="quiet-title">
        <h2 id="quiet-title">
          Quiet <span>{quiet.length}</span>
        </h2>
        <p>Lower-frequency demo records. No pruning recommendation is implied.</p>
        <div>
          {quiet.map((skill) => (
            <span key={skill.slug}>
              <i className={toneClass(skill.tone)} /> {skill.slug}
            </span>
          ))}
        </div>
      </section>
      <details className="activity-log">
        <summary>
          Activity fixture <span>NOT LIVE</span>
        </summary>
        <ol>
          {events.map(([time, title, detail]) => (
            <li key={`${time}-${title}`}>
              <time>{time}</time>
              <div>
                <strong>{title}</strong>
                <p>{detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </details>
    </section>
  );
}

function SetupView({
  choice,
  result,
  fixture,
  onChoice,
  onPreview,
  onFixture,
}: {
  choice: string;
  result: boolean;
  fixture: FixtureName;
  onChoice: (choice: string) => void;
  onPreview: () => void;
  onFixture: (fixture: FixtureName) => void;
}): ReactNode {
  return (
    <section className="setup-view" aria-labelledby="setup-title">
      <header className="setup-head">
        <div>
          <p className="eyebrow">Source and distribution</p>
          <h1 id="setup-title">Keep the path honest.</h1>
          <p>Choose the public static Atlas or one operator-controlled Node read path.</p>
        </div>
        <span className="permission-badge">READ ONLY</span>
      </header>
      <div className="setup-grid">
        <section className="setup-card" aria-labelledby="source-choice-title">
          <h2 id="source-choice-title">Source mode</h2>
          <fieldset>
            <legend className="sr-only">Choose a source mode</legend>
            <label className="option-card">
              <input
                type="radio"
                name="source"
                checked={choice === "public"}
                onChange={() => onChoice("public")}
              />
              <span>
                <strong>Bundled public snapshot</strong>
                <small>Static-safe · no API required</small>
              </span>
            </label>
            <label className="option-card">
              <input
                type="radio"
                name="source"
                checked={choice === "local"}
                onChange={() => onChoice("local")}
              />
              <span>
                <strong>Mounted local checkout</strong>
                <small>Node only · SKILLS_REPO_PATH</small>
              </span>
            </label>
            <label className="option-card">
              <input
                type="radio"
                name="source"
                checked={choice === "token"}
                onChange={() => onChoice("token")}
              />
              <span>
                <strong>Provider token</strong>
                <small>Not implemented · no OAuth action</small>
              </span>
            </label>
          </fieldset>
          <button className="button primary" onClick={onPreview}>
            Preview safe connection
          </button>
          {result ? (
            <div className="setup-result" role="status">
              <strong>
                {choice === "public" ? "Public snapshot ready." : "No connection was made."}
              </strong>
              <p>
                {choice === "public"
                  ? "The packaged snapshot is the normal static source."
                  : choice === "local"
                    ? "Set the documented server environment locally; this browser action does not mount files."
                    : "Provider access is outside this Build; no provider action was taken."}
              </p>
            </div>
          ) : null}
        </section>
        <section className="setup-card capability-card" aria-labelledby="capability-title">
          <h2 id="capability-title">Capability boundary</h2>
          <table>
            <thead>
              <tr>
                <th>Capability</th>
                <th>Static public</th>
                <th>Node self-host</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Bundled graph, library, Ask</td>
                <td>Yes</td>
                <td>Yes</td>
              </tr>
              <tr>
                <td>Mounted Git checkout</td>
                <td>—</td>
                <td>Read only</td>
              </tr>
              <tr>
                <td>Health endpoint</td>
                <td>—</td>
                <td>
                  <code>/api/health</code>
                </td>
              </tr>
              <tr>
                <td>Git writes / OAuth / telemetry</td>
                <td>No</td>
                <td>No</td>
              </tr>
            </tbody>
          </table>
          <div className="command-block">
            <span>Static review build</span>
            <code>npm run build:static</code>
            <span>Node self-host</span>
            <code>SKILLS_REPO_PATH=/checkout npm run boot</code>
          </div>
        </section>
        <section className="setup-card distribution-card" aria-labelledby="distribution-title">
          <h2 id="distribution-title">Harness distribution</h2>
          <p>
            The Atlas explains distribution; it does not install skills. Use the canonical Skills
            repository’s pinned project-local command and verify the source revision separately.
          </p>
          <code>npx skills@1.5.23 add onlinesourdough/Skills#v0.1.0 …</code>
          <ul>
            <li>Repository remains canonical</li>
            <li>Public client receives no credential</li>
            <li>Updates and rollback stay explicit</li>
          </ul>
        </section>
      </div>
      <StateFixtures active={fixture} onSelect={onFixture} />
    </section>
  );
}

function StateFixtures({
  active,
  onSelect,
}: {
  active: FixtureName;
  onSelect: (fixture: FixtureName) => void;
}): ReactNode {
  const names = Object.keys(FIXTURE_COPY) as FixtureName[];
  const copy = FIXTURE_COPY[active];
  return (
    <section className="state-fixtures" aria-labelledby="states-title">
      <header>
        <div>
          <p className="eyebrow">Review fixtures</p>
          <h2 id="states-title">Required interface states</h2>
        </div>
        <p>Deterministic review controls, not customer telemetry.</p>
      </header>
      <div className="fixture-tabs" aria-label="State fixtures">
        {names.map((name) => (
          <button key={name} aria-pressed={active === name} onClick={() => onSelect(name)}>
            {name}
          </button>
        ))}
      </div>
      <div className={`fixture-output fixture-${active}`} role="status" aria-live="polite">
        <b aria-hidden="true">{copy.icon}</b>
        <span>
          <strong>{copy.title}</strong>
          <small>{copy.detail}</small>
        </span>
        <em>{copy.action}</em>
      </div>
    </section>
  );
}

function useDialogFocusTrap(
  dialogRef: React.RefObject<HTMLDialogElement | null>,
  open: boolean,
): void {
  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          "button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex='-1'])",
        ),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    dialog.addEventListener("keydown", onKeyDown);
    return () => dialog.removeEventListener("keydown", onKeyDown);
  }, [dialogRef, open]);
}

function TourDialog({
  open,
  step,
  onStep,
  onClose,
  onExplore,
}: {
  open: boolean;
  step: number;
  onStep: (step: number) => void;
  onClose: () => void;
  onExplore: () => void;
}): ReactNode {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useDialogFocusTrap(dialogRef, open);
  const page = TOUR_PAGES[step] ?? TOUR_PAGES[0];

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (open) window.requestAnimationFrame(() => headingRef.current?.focus());
  }, [open, step]);

  return (
    <dialog
      ref={dialogRef}
      className="tour-dialog"
      aria-labelledby="tour-title"
      aria-describedby="tour-description"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="tour-shell">
        <button className="tour-skip" onClick={onClose}>
          Skip tour
        </button>
        <div className="tour-progress-row">
          <p aria-live="polite">
            Step {step + 1} of {TOUR_PAGES.length}
          </p>
          <ol className="tour-track" aria-label="Tour progress">
            {TOUR_PAGES.map((item, index) => (
              <li
                key={item.label}
                aria-current={index === step ? "step" : undefined}
                className={index <= step ? "complete" : ""}
              />
            ))}
          </ol>
        </div>
        <TourArt step={step} />
        <div className="tour-copy">
          <p className="eyebrow">{page.kicker}</p>
          <h2 ref={headingRef} id="tour-title" tabIndex={-1}>
            {page.title}
          </h2>
          <p id="tour-description">{page.description}</p>
          <small>{page.detail}</small>
        </div>
        <footer className="tour-footer">
          {step > 0 ? (
            <button
              className="round-button"
              aria-label="Previous tour page"
              onClick={() => onStep(step - 1)}
            >
              ←
            </button>
          ) : (
            <span />
          )}
          {step < TOUR_PAGES.length - 1 ? (
            <button className="button primary" onClick={() => onStep(step + 1)}>
              Next <span aria-hidden="true">→</span>
            </button>
          ) : (
            <button className="button primary" onClick={onExplore}>
              Enter the public Atlas <span aria-hidden="true">→</span>
            </button>
          )}
        </footer>
      </div>
    </dialog>
  );
}

function TourArt({ step }: { step: number }): ReactNode {
  if (step === 1)
    return (
      <div className="tour-art scattered-art" aria-hidden="true">
        <div>
          <strong>Laptop</strong>
          <i />
          <i />
        </div>
        <div>
          <strong>Agent folder</strong>
          <i />
          <i />
        </div>
        <div>
          <strong>Project notes</strong>
          <i />
          <i />
        </div>
      </div>
    );
  if (step === 2)
    return (
      <div className="tour-art edits-art" aria-hidden="true">
        <span>
          local A <i>×</i>
        </span>
        <span className="tour-repo">
          Git
          <br />
          <small>canonical</small>
        </span>
        <span>
          local B <i>×</i>
        </span>
      </div>
    );
  if (step === 3)
    return (
      <div className="tour-art shared-art" aria-hidden="true">
        <span className="tour-repo">
          OS
          <br />
          <small>shared shelf</small>
        </span>
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>
    );
  if (step === 4)
    return (
      <div className="tour-art latest-art" aria-hidden="true">
        <span className="tour-repo">
          v0.1
          <br />
          <small>reviewed</small>
        </span>
        <div className="people">
          <i>F</i>
          <i>O</i>
          <i>A</i>
          <i>S</i>
        </div>
      </div>
    );
  return (
    <div className="tour-art intro-art" aria-hidden="true">
      <span className="intro-orbit">
        <i />
        <i />
        <i />
        <i />
        <i />
      </span>
      <span className="tour-repo">
        os
        <br />
        <small>skills atlas</small>
      </span>
    </div>
  );
}

function SearchDialog({
  open,
  skills,
  onClose,
  onOpenSkill,
}: {
  open: boolean;
  skills: AtlasSkill[];
  onClose: () => void;
  onOpenSkill: (slug: string) => void;
}): ReactNode {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  useDialogFocusTrap(dialogRef, open);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    if (open) window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  const results = filterSkills(skills, query, "All skills").slice(0, 6);
  return (
    <dialog
      ref={dialogRef}
      className="search-dialog"
      aria-labelledby="search-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="dialog-head">
        <div>
          <span className="label">Global search</span>
          <h2 id="search-title">Find a skill or source path.</h2>
        </div>
        <button className="icon-button" aria-label="Close search" onClick={onClose}>
          ×
        </button>
      </div>
      <input
        ref={inputRef}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search the public Atlas"
        aria-label="Search skills"
      />
      {query ? (
        <div className="search-results" aria-live="polite">
          {results.length ? (
            results.map((skill) => (
              <button key={skill.slug} onClick={() => onOpenSkill(skill.slug)}>
                <strong>{skill.name}</strong>
                <span>{skill.sourcePath}</span>
              </button>
            ))
          ) : (
            <p className="empty-search">No result. Try a skill name or `skills/` path.</p>
          )}
        </div>
      ) : (
        <p className="search-hint">Search names, descriptions, departments, and source paths.</p>
      )}
      <p className="dialog-foot">
        <kbd>Esc</kbd> closes · <kbd>⌘ K</kbd> opens anywhere
      </p>
    </dialog>
  );
}

function AskDialog({
  open,
  query,
  answer,
  onQuery,
  onAsk,
  onQuestion,
  onOpenSkill,
  onClose,
}: {
  open: boolean;
  query: string;
  answer: AskAnswer | null;
  onQuery: (query: string) => void;
  onAsk: () => void;
  onQuestion: (question: string) => void;
  onOpenSkill: (slug: string) => void;
  onClose: () => void;
}): ReactNode {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useDialogFocusTrap(dialogRef, open);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    if (open) window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  const questions = [
    "Where is the canonical Git source?",
    "How do I share the reviewed version?",
    "What does route models do?",
  ];

  return (
    <dialog
      ref={dialogRef}
      className="ask-dialog"
      aria-labelledby="ask-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className="ask-head">
        <div>
          <span className="ask-status" aria-hidden="true" />
          <h2 id="ask-title">Ask the Atlas</h2>
          <small>Bundled answers · runtime AI off</small>
        </div>
        <button className="icon-button" aria-label="Close Ask the Atlas" onClick={onClose}>
          ×
        </button>
      </header>
      <div className="ask-body">
        {answer ? (
          <div className="ask-answer" aria-live="polite">
            <span className="label">Bundled answer · {answer.matched ? "matched" : "broaden"}</span>
            <h3>{answer.title}</h3>
            <p>{answer.body}</p>
            <div>
              {answer.related.map((slug) => (
                <button key={slug} onClick={() => onOpenSkill(slug)}>
                  {slug} →
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="ask-empty">
            <strong>Ask where a skill lives or how it connects.</strong>
            <p>The answer is generated deterministically from the packaged index.</p>
            <div>
              {questions.map((question) => (
                <button key={question} onClick={() => onQuestion(question)}>
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <form
        className="ask-form"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          onAsk();
        }}
      >
        <input
          ref={inputRef}
          id="ask-input"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Which skill should I use for…"
          aria-label="Ask the Atlas question"
        />
        <button type="submit" aria-label="Ask bundled index">
          →
        </button>
      </form>
    </dialog>
  );
}

export { App };
