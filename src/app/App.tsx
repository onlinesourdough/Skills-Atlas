import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { EXAMPLE_PACK } from "../data/bundled-skills.js";
import {
  categoriesForSkills,
  filterSkills,
  findSkill,
  graphCategoryEmphasis,
  relationCount,
  relationEdges,
  repositoryHealth,
} from "../domain/atlas.js";
import { parsePackPayload, parseProposalResult, parseSessionPayload } from "../domain/contracts.js";
import {
  createGitHubFetchTransport,
  ProviderError,
  readGitHubPack,
  type ProviderErrorCode,
} from "../domain/github.js";
import { pluginComponentLabels, resolveDefaultPlugin, upsertPlugin } from "../domain/plugin.js";
import { parseSkillMarkdown } from "../domain/skill-parser.js";
import type { AtlasPack, AtlasSkill, GraphTone, ProposalResult, SessionState } from "../types.js";

type ViewName = "graph" | "library" | "usage" | "plugins";
type ReaderMode = "rendered" | "source";
type DefaultLoadState =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "fallback"; code: string };

const STATIC_EDITION = import.meta.env.MODE === "static";
const PRIMARY_VIEWS: Array<{ view: Exclude<ViewName, "plugins">; label: string }> = [
  { view: "graph", label: "Graph" },
  { view: "library", label: "Library" },
  { view: "usage", label: "Usage" },
];

const STATIC_SESSION: SessionState = {
  kind: "atlas-session",
  mode: "static",
  authenticated: false,
  adminAvailable: false,
  providerAvailable: false,
};

const TOUR_PAGES = [
  {
    eyebrow: "Scattered skills",
    title: "Useful instructions end up everywhere.",
    description:
      "A laptop, project folder, and agent can each carry a different copy of the same team practice.",
    note: "The problem is not finding another tool. It is knowing which instruction is current.",
  },
  {
    eyebrow: "Isolated edits",
    title: "A good improvement can stay trapped in one copy.",
    description:
      "One teammate fixes the process while everyone else keeps running yesterday’s version.",
    note: "Local edits need a shared review path before they become team knowledge.",
  },
  {
    eyebrow: "One shared library",
    title: "Git becomes the source everyone can return to.",
    description:
      "Each skill has one repository path, one reviewed history, and one place to recover an earlier version.",
    note: "The repository stays canonical. Skill Atlas makes it easier to understand.",
  },
  {
    eyebrow: "Inspect and improve",
    title: "Work with the library without living in GitHub.",
    description:
      "Search, read complete skills, follow relationships, and propose an improvement from one calm surface.",
    note: "Edits become a branch and pull request only when write permission is verified.",
  },
  {
    eyebrow: "Reviewed distribution",
    title: "The current version can reach the whole team.",
    description:
      "After review, every supported agent can follow the same Git-backed skill instead of a disconnected copy.",
    note: "Atlas loads the shared library when GitHub is available and keeps an offline example for recovery.",
  },
] as const;

const TONE_COLORS: Record<GraphTone, string> = {
  blue: "#4178c7",
  mint: "#3e9b82",
  gold: "#c59624",
  violet: "#8661b8",
  clay: "#c55b55",
};

function viewFromHash(hash: string): ViewName | null {
  const value = hash.slice(1);
  return value === "graph" || value === "library" || value === "usage" || value === "plugins"
    ? value
    : null;
}

function initialView(): ViewName {
  return viewFromHash(window.location.hash) ?? "graph";
}

function initialTourOpen(): boolean {
  const params = new URLSearchParams(window.location.search);
  if (params.get("tour") === "1") return true;
  if (window.location.hash) return false;
  return window.localStorage.getItem("skill-atlas-tour-complete") !== "1";
}

function providerMessage(code: ProviderErrorCode | string): string {
  const messages: Partial<Record<ProviderErrorCode, string>> = {
    "invalid-repository": "Use a repository in owner/name format.",
    "repository-unavailable": "Repository unavailable or private.",
    "authentication-required": "Provider authentication is unavailable or no longer valid.",
    "permission-denied": "The configured repository permission does not allow this action.",
    "rate-limited": "GitHub rate limit reached. Keep this plugin and try again later.",
    "provider-timeout": "GitHub did not respond within the bounded read window.",
    "tree-truncated": "The repository tree is too large to inspect safely.",
    "too-many-files": "The repository contains more files than this Atlas accepts.",
    "too-many-skills": "The repository contains more skills than this Atlas accepts.",
    "skill-too-large": "A skill file is larger than the accepted limit.",
    "aggregate-too-large": "The skill library is larger than the accepted total limit.",
    "empty-repository": "No skills/<slug>/SKILL.md files were found.",
    "invalid-skill": "A skill does not meet the bounded Markdown contract.",
    "manifest-too-large": "The plugin manifest is larger than the accepted limit.",
    "invalid-plugin-manifest": "The plugin manifest contains an invalid component declaration.",
    "stale-source": "The default branch changed. Refresh the plugin before proposing an edit.",
    "duplicate-branch": "That proposal branch already exists. Start a new proposal.",
  };
  return messages[code as ProviderErrorCode] ?? "GitHub could not complete the bounded request.";
}

async function responseError(response: Response): Promise<{ code: string; message: string }> {
  try {
    const payload = (await response.json()) as {
      error?: { code?: unknown; message?: unknown };
    };
    if (typeof payload.error?.code === "string" && typeof payload.error.message === "string") {
      return { code: payload.error.code, message: payload.error.message };
    }
  } catch {
    // The stable local fallback below intentionally hides provider response detail.
  }
  return { code: "provider-error", message: providerMessage("provider-error") };
}

function App(): ReactNode {
  const [view, setView] = useState<ViewName>(initialView);
  const [packs, setPacks] = useState<AtlasPack[]>([EXAMPLE_PACK]);
  const [activePackId, setActivePackId] = useState(EXAMPLE_PACK.id);
  const [selectedSlug, setSelectedSlug] = useState(EXAMPLE_PACK.skills[0]?.slug ?? "");
  const [category, setCategory] = useState("All skills");
  const [libraryQuery, setLibraryQuery] = useState("");
  const [readerMode, setReaderMode] = useState<ReaderMode>("rendered");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(initialTourOpen);
  const [tourStep, setTourStep] = useState(0);
  const [session, setSession] = useState<SessionState>(STATIC_SESSION);
  const [defaultLoad, setDefaultLoad] = useState<DefaultLoadState>({ status: "loading" });
  const mainRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLButtonElement>(null);
  const accountRef = useRef<HTMLButtonElement>(null);
  const tourReturnRef = useRef<HTMLElement | null>(null);
  const activePackIdRef = useRef(EXAMPLE_PACK.id);
  const defaultAttemptRef = useRef(0);

  const activePack = useMemo(
    () => packs.find((pack) => pack.id === activePackId) ?? EXAMPLE_PACK,
    [activePackId, packs],
  );
  const selectedSkill = useMemo(
    () => findSkill(activePack.skills, selectedSlug) ?? activePack.skills[0],
    [activePack.skills, selectedSlug],
  );
  const filteredSkills = useMemo(
    () => filterSkills(activePack.skills, libraryQuery, category),
    [activePack.skills, category, libraryQuery],
  );

  useEffect(() => {
    const syncViewFromHash = () => {
      const requested = viewFromHash(window.location.hash);
      const next = requested ?? "graph";
      setView(next);
      setDrawerOpen(false);
      if (!requested) {
        window.history.replaceState(
          null,
          "",
          `${window.location.pathname}${window.location.search}#graph`,
        );
      }
    };
    window.addEventListener("hashchange", syncViewFromHash);
    syncViewFromHash();
    return () => window.removeEventListener("hashchange", syncViewFromHash);
  }, []);

  useEffect(() => {
    if (STATIC_EDITION) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 2500);
    void fetch("/api/session", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("session-unavailable");
        const parsed = parseSessionPayload(await response.json());
        if (!parsed) throw new Error("invalid-session");
        setSession(parsed);
      })
      .catch(() => {
        setSession({ ...STATIC_SESSION, mode: "self-hosted" });
      })
      .finally(() => window.clearTimeout(timer));
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    void loadDefaultPlugin();
    return () => {
      defaultAttemptRef.current += 1;
    };
  }, []);

  useEffect(() => {
    const requested = Number.parseInt(
      new URLSearchParams(window.location.search).get("tourStep") ?? "1",
      10,
    );
    if (new URLSearchParams(window.location.search).get("tour") === "1") {
      setTourStep(Math.min(TOUR_PAGES.length - 1, Math.max(0, requested - 1)));
    }
  }, []);

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

  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDrawer(true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  function navigate(next: ViewName): void {
    setView(next);
    setDrawerOpen(false);
    window.history.replaceState(null, "", `#${next}`);
    window.setTimeout(() => mainRef.current?.focus({ preventScroll: true }), 0);
  }

  function openSkill(slug: string): void {
    setSelectedSlug(slug);
    setReaderMode("rendered");
    setLibraryQuery("");
    setCategory("All skills");
    navigate("library");
  }

  function activatePack(pack: AtlasPack): void {
    activePackIdRef.current = pack.id;
    setActivePackId(pack.id);
    setSelectedSlug(pack.skills[0]?.slug ?? "");
    setCategory("All skills");
    setLibraryQuery("");
    setReaderMode("rendered");
  }

  async function readRepository(repository: string, publicOnly = false): Promise<AtlasPack> {
    let pack: AtlasPack;
    if (STATIC_EDITION) {
      pack = await readGitHubPack(createGitHubFetchTransport(), repository);
    } else {
      const response = await fetch(
        `/api/packs/import?repository=${encodeURIComponent(repository)}`,
        { credentials: publicOnly ? "omit" : "same-origin" },
      );
      if (!response.ok) {
        const error = await responseError(response);
        throw new ProviderError(error.code as ProviderErrorCode);
      }
      const parsed = parsePackPayload(await response.json());
      if (!parsed) throw new ProviderError("provider-payload-invalid");
      pack = parsed;
    }
    return pack;
  }

  async function loadDefaultPlugin(): Promise<void> {
    const attempt = defaultAttemptRef.current + 1;
    defaultAttemptRef.current = attempt;
    setDefaultLoad({ status: "loading" });
    const result = await resolveDefaultPlugin((repository) => readRepository(repository, true));
    if (defaultAttemptRef.current !== attempt) return;
    if (result.status === "fallback") {
      setDefaultLoad(result);
      return;
    }
    setPacks((current) => upsertPlugin(current, result.plugin));
    if (activePackIdRef.current === EXAMPLE_PACK.id) activatePack(result.plugin);
    setDefaultLoad({ status: "ready" });
  }

  async function importRepository(repository: string): Promise<AtlasPack> {
    const pack = await readRepository(repository);
    defaultAttemptRef.current += 1;
    setPacks((current) => upsertPlugin(current, pack));
    activatePack(pack);
    setDefaultLoad({ status: "ready" });
    return pack;
  }

  function closeDrawer(restore = false): void {
    setDrawerOpen(false);
    if (restore) window.setTimeout(() => menuRef.current?.focus(), 0);
  }

  function openTour(step = 0): void {
    tourReturnRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
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

  function closeTour(destination?: ViewName): void {
    setTourOpen(false);
    window.localStorage.setItem("skill-atlas-tour-complete", "1");
    const params = new URLSearchParams(window.location.search);
    params.delete("tour");
    params.delete("tourStep");
    const query = params.toString();
    const nextView = destination ?? view;
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${query ? `?${query}` : ""}#${nextView}`,
    );
    if (destination) {
      setView(destination);
      window.setTimeout(() => mainRef.current?.focus({ preventScroll: true }), 0);
    } else {
      const target = tourReturnRef.current;
      window.setTimeout(() => target?.focus(), 0);
    }
    tourReturnRef.current = null;
  }

  return (
    <div className="app-shell">
      <Topbar
        view={view}
        session={session}
        menuRef={menuRef}
        searchRef={searchRef}
        accountRef={accountRef}
        onMenu={() => setDrawerOpen(true)}
        onNavigate={navigate}
        onSearch={() => setSearchOpen(true)}
        onAccount={() => setAccountOpen(true)}
        onTour={() => openTour()}
      />
      <div className="shell-body">
        <Sidebar
          pack={activePack}
          category={category}
          open={drawerOpen}
          view={view}
          onCategory={(next) => {
            setCategory(next);
            setLibraryQuery("");
            if (next !== "All skills") {
              const first = activePack.skills.find((skill) => skill.category === next);
              if (first) setSelectedSlug(first.slug);
            }
            if (view === "plugins" || view === "usage") navigate("graph");
            closeDrawer();
          }}
          onPlugins={() => navigate("plugins")}
          onClose={() => closeDrawer(true)}
        />
        {drawerOpen ? (
          <button
            className="drawer-backdrop"
            aria-label="Close navigation"
            onClick={() => closeDrawer(true)}
          />
        ) : null}
        <main id="main" ref={mainRef} className="product-main" tabIndex={-1}>
          <DefaultLoadStatus state={defaultLoad} onRetry={() => void loadDefaultPlugin()} />
          {view === "graph" ? (
            <GraphView
              pack={activePack}
              category={category}
              selectedSlug={selectedSkill?.slug ?? ""}
              onSelect={setSelectedSlug}
              onOpen={openSkill}
            />
          ) : null}
          {view === "library" ? (
            <LibraryView
              pack={activePack}
              session={session}
              query={libraryQuery}
              filteredSkills={filteredSkills}
              selectedSkill={selectedSkill}
              readerMode={readerMode}
              onQuery={setLibraryQuery}
              onCategory={setCategory}
              onSelect={(slug) => {
                setSelectedSlug(slug);
                setReaderMode("rendered");
              }}
              onReaderMode={setReaderMode}
              onOpenAccount={() => setAccountOpen(true)}
            />
          ) : null}
          {view === "usage" ? <UsageView pack={activePack} /> : null}
          {view === "plugins" ? (
            <PluginsView
              packs={packs}
              activePack={activePack}
              session={session}
              onActivate={activatePack}
              onImport={importRepository}
              onOpenAccount={() => setAccountOpen(true)}
            />
          ) : null}
        </main>
      </div>
      <TourDialog
        open={tourOpen}
        step={tourStep}
        onStep={(step) => {
          setTourStep(step);
          writeTourUrl(step);
        }}
        onClose={() => closeTour()}
        onExample={() => closeTour("graph")}
        onImport={() => closeTour("plugins")}
      />
      <SearchDialog
        open={searchOpen}
        pack={activePack}
        returnRef={searchRef}
        onClose={() => setSearchOpen(false)}
        onOpenSkill={(slug) => {
          setSearchOpen(false);
          openSkill(slug);
        }}
      />
      <AccountDialog
        open={accountOpen}
        session={session}
        returnRef={accountRef}
        onClose={() => setAccountOpen(false)}
        onSession={setSession}
        onReplay={() => {
          setAccountOpen(false);
          openTour();
        }}
      />
    </div>
  );
}

function Topbar({
  view,
  session,
  menuRef,
  searchRef,
  accountRef,
  onMenu,
  onNavigate,
  onSearch,
  onAccount,
  onTour,
}: {
  view: ViewName;
  session: SessionState;
  menuRef: RefObject<HTMLButtonElement | null>;
  searchRef: RefObject<HTMLButtonElement | null>;
  accountRef: RefObject<HTMLButtonElement | null>;
  onMenu: () => void;
  onNavigate: (view: ViewName) => void;
  onSearch: () => void;
  onAccount: () => void;
  onTour: () => void;
}): ReactNode {
  const accountLabel = session.authenticated
    ? "Admin"
    : session.mode === "self-hosted" && session.adminAvailable
      ? "Sign in"
      : "Public";
  return (
    <header className="topbar">
      <div className="brand-cell">
        <button
          ref={menuRef}
          className="icon-button menu-button"
          onClick={onMenu}
          aria-label="Open navigation"
        >
          <MenuIcon />
        </button>
        <button
          className="product-name"
          onClick={onTour}
          aria-label="Replay Skill Atlas onboarding"
        >
          Skill Atlas
        </button>
      </div>
      <div className="topbar-main">
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
        <button
          ref={searchRef}
          className="search-trigger"
          onClick={onSearch}
          aria-haspopup="dialog"
          aria-label="Search skills"
        >
          <SearchIcon />
          <span>Search</span>
          <kbd>⌘ K</kbd>
        </button>
      </div>
      <div className="topbar-actions">
        <a
          className="github-link"
          href="https://github.com/onlinesourdough/Skills-Atlas"
          target="_blank"
          rel="noreferrer noopener"
          aria-label="View Skills Atlas source on GitHub"
          title="View Skills Atlas source on GitHub"
        >
          <GitHubIcon />
        </a>
        <button
          ref={accountRef}
          className="account-trigger"
          onClick={onAccount}
          aria-haspopup="dialog"
        >
          <span
            className={`avatar${session.authenticated ? " authenticated" : ""}`}
            aria-hidden="true"
          >
            {session.authenticated ? "A" : "P"}
          </span>
          <span>{accountLabel}</span>
        </button>
      </div>
    </header>
  );
}

function DefaultLoadStatus({
  state,
  onRetry,
}: {
  state: DefaultLoadState;
  onRetry: () => void;
}): ReactNode {
  if (state.status === "ready") return null;
  const message =
    state.status === "loading"
      ? "Loading live skills from GitHub…"
      : state.code === "rate-limited"
        ? "GitHub’s read limit was reached. Showing Offline example."
        : "Live skills are unavailable. Showing Offline example.";
  return (
    <div className={`default-load-status ${state.status}`} role="status" aria-live="polite">
      <span>
        {state.status === "loading" ? <LoadingIcon /> : <AttentionIcon />}
        {message}
      </span>
      {state.status === "fallback" ? <button onClick={onRetry}>Retry</button> : null}
    </div>
  );
}

function Sidebar({
  pack,
  category,
  open,
  view,
  onCategory,
  onPlugins,
  onClose,
}: {
  pack: AtlasPack;
  category: string;
  open: boolean;
  view: ViewName;
  onCategory: (category: string) => void;
  onPlugins: () => void;
  onClose: () => void;
}): ReactNode {
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width: 820px)").matches);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 820px)");
    const update = () => setMobile(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const categories = categoriesForSkills(pack.skills);
  const counts = new Map<string, number>();
  for (const skill of pack.skills)
    counts.set(skill.category, (counts.get(skill.category) ?? 0) + 1);
  const categoryTones = new Map<string, GraphTone>();
  for (const skill of pack.skills)
    if (!categoryTones.has(skill.category)) categoryTones.set(skill.category, skill.tone);
  return (
    <aside
      className={`taxonomy-rail${open ? " open" : ""}`}
      aria-label="Skill taxonomy"
      aria-hidden={mobile && !open ? true : undefined}
      inert={mobile && !open}
    >
      <div className="rail-mobile-head">
        <strong>Browse</strong>
        <button className="icon-button" onClick={onClose} aria-label="Close navigation">
          <CloseIcon />
        </button>
      </div>
      <section aria-labelledby="categories-title">
        <h2 id="categories-title" className="rail-label">
          Categories
        </h2>
        {categories.map((item, index) => (
          <button
            key={item}
            className="taxonomy-item"
            aria-pressed={category === item}
            onClick={() => onCategory(item)}
          >
            {index > 0 ? (
              <i
                className="taxonomy-dot"
                style={
                  {
                    "--dot": TONE_COLORS[categoryTones.get(item) ?? "blue"],
                  } as CSSProperties
                }
                aria-hidden="true"
              />
            ) : null}
            <span>{item}</span>
            <small>{index === 0 ? pack.skills.length : (counts.get(item) ?? 0)}</small>
          </button>
        ))}
      </section>
      <section className="rail-pack" aria-labelledby="plugin-title">
        <h2 id="plugin-title" className="rail-label">
          Plugin
        </h2>
        <button
          className="pack-rail-button"
          aria-current={view === "plugins" ? "page" : undefined}
          onClick={onPlugins}
        >
          <span className="repo-glyph" aria-hidden="true">
            <RepoIcon />
          </span>
          <span>
            <strong>{pack.repository}</strong>
            <small>Manage plugins</small>
          </span>
        </button>
      </section>
    </aside>
  );
}

interface GraphNodeLayout {
  skill: AtlasSkill;
  x: number;
  y: number;
}

interface GraphCategoryLayout {
  category: string;
  tone: GraphTone;
  x: number;
  y: number;
  radius: number;
  nodes: GraphNodeLayout[];
}

function graphLayout(skills: AtlasSkill[]): GraphCategoryLayout[] {
  const grouped = new Map<string, AtlasSkill[]>();
  for (const skill of skills)
    grouped.set(skill.category, [...(grouped.get(skill.category) ?? []), skill]);
  const categories = [...grouped.entries()];
  const centers = [
    { x: 470, y: 190 },
    { x: 250, y: 350 },
    { x: 690, y: 350 },
    { x: 350, y: 555 },
    { x: 595, y: 555 },
    { x: 470, y: 380 },
  ];
  if (categories.length === 1) centers[0] = { x: 470, y: 365 };
  if (categories.length === 2) {
    centers[0] = { x: 320, y: 360 };
    centers[1] = { x: 620, y: 360 };
  }
  return categories.map(([name, group], categoryIndex) => {
    const center = centers[categoryIndex % centers.length] ?? { x: 470, y: 365 };
    const radius = Math.max(76, 54 + Math.sqrt(group.length) * 34);
    const nodes = group.map((skill, index) => {
      const nodeRadius =
        group.length === 1
          ? 0
          : group.length >= 5
            ? Math.min(radius - 35, 95)
            : Math.min(radius - 30, 28 + group.length * 5);
      const angle = (Math.PI * 2 * index) / group.length - Math.PI / 2;
      return {
        skill,
        x: center.x + Math.cos(angle) * nodeRadius,
        y: center.y + Math.sin(angle) * nodeRadius,
      };
    });
    return {
      category: name,
      tone: group[0]?.tone ?? "blue",
      x: center.x,
      y: center.y,
      radius,
      nodes,
    };
  });
}

function graphNodeLabel(name: string): string[] {
  const words = name.trim().split(/\s+/u);
  if (words.length < 2) return words;
  const split = Math.ceil(words.length / 2);
  return [words.slice(0, split).join(" "), words.slice(split).join(" ")];
}

function GraphView({
  pack,
  category,
  selectedSlug,
  onSelect,
  onOpen,
}: {
  pack: AtlasPack;
  category: string;
  selectedSlug: string;
  onSelect: (slug: string) => void;
  onOpen: (slug: string) => void;
}): ReactNode {
  const emphasis = useMemo(
    () =>
      new Map(
        graphCategoryEmphasis(pack.skills, category).map((item) => [item.slug, item.emphasized]),
      ),
    [category, pack.skills],
  );
  const layout = useMemo(() => graphLayout(pack.skills), [pack.skills]);
  const nodes = layout.flatMap((item) => item.nodes);
  const nodeBySlug = new Map(nodes.map((node) => [node.skill.slug, node]));
  const edges = useMemo(() => relationEdges(pack.skills), [pack.skills]);
  const selected = findSkill(pack.skills, selectedSlug) ?? pack.skills[0];
  const connected = new Set<string>(selected?.relations ?? []);
  for (const skill of pack.skills)
    if (skill.relations.includes(selected?.slug ?? "")) connected.add(skill.slug);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{
    pointerId: number;
    x: number;
    y: number;
    originX: number;
    originY: number;
  } | null>(null);

  function startPan(event: ReactPointerEvent<SVGSVGElement>): void {
    if ((event.target as Element).closest("[data-skill-node]")) return;
    drag.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      originX: pan.x,
      originY: pan.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function movePan(event: ReactPointerEvent<SVGSVGElement>): void {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    setPan({
      x: drag.current.originX + (event.clientX - drag.current.x) / zoom,
      y: drag.current.originY + (event.clientY - drag.current.y) / zoom,
    });
  }

  function stopPan(event: ReactPointerEvent<SVGSVGElement>): void {
    if (drag.current?.pointerId === event.pointerId) drag.current = null;
  }

  return (
    <section className="graph-view" aria-labelledby="graph-title">
      <header className="view-heading graph-heading">
        <h1 id="graph-title">Skill relationships</h1>
        <span>
          {pack.skills.length} skills · {relationCount(pack.skills)} connections
        </span>
      </header>
      <div className="graph-stage">
        <div className="graph-controls" aria-label="Graph controls">
          <button
            onClick={() => setZoom((value) => Math.min(1.8, value + 0.15))}
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            onClick={() => setZoom((value) => Math.max(0.65, value - 0.15))}
            aria-label="Zoom out"
          >
            −
          </button>
          <button
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
          >
            Reset
          </button>
        </div>
        {pack.skills.length ? (
          <svg
            className="relationship-graph"
            viewBox="0 0 940 720"
            role="img"
            aria-labelledby="graph-svg-title graph-svg-description"
            onPointerDown={startPan}
            onPointerMove={movePan}
            onPointerUp={stopPan}
            onPointerCancel={stopPan}
          >
            <title id="graph-svg-title">Relationship graph for {pack.repository}</title>
            <desc id="graph-svg-description">
              Only loaded skills and explicit source relations are shown. Drag to pan and use the
              controls to zoom.
            </desc>
            <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
              {layout.map((cluster) => (
                <g
                  key={cluster.category}
                  className={`graph-cluster${
                    category !== "All skills" && cluster.category !== category
                      ? " category-muted"
                      : " category-emphasized"
                  }`}
                >
                  <circle
                    cx={cluster.x}
                    cy={cluster.y}
                    r={cluster.radius}
                    fill={TONE_COLORS[cluster.tone]}
                  />
                  <text x={cluster.x} y={cluster.y - cluster.radius - 14} textAnchor="middle">
                    {cluster.category} · {cluster.nodes.length}
                  </text>
                </g>
              ))}
              {edges.map((edge) => {
                const start = nodeBySlug.get(edge.startSlug);
                const end = nodeBySlug.get(edge.endSlug);
                if (!start || !end) return null;
                const active =
                  selected && (edge.startSlug === selected.slug || edge.endSlug === selected.slug);
                const categoryMuted =
                  category !== "All skills" &&
                  !emphasis.get(edge.startSlug) &&
                  !emphasis.get(edge.endSlug);
                return (
                  <line
                    key={`${edge.startSlug}-${edge.endSlug}`}
                    className={`graph-edge${active ? " active" : ""}${
                      categoryMuted ? " category-muted" : " category-emphasized"
                    }`}
                    x1={start.x}
                    y1={start.y}
                    x2={end.x}
                    y2={end.y}
                  />
                );
              })}
              {nodes.map((node) => {
                const active = node.skill.slug === selected?.slug;
                const related = connected.has(node.skill.slug);
                const categoryMuted = !emphasis.get(node.skill.slug);
                return (
                  <g
                    key={node.skill.slug}
                    data-skill-node="true"
                    className={`skill-node${active ? " selected" : ""}${related ? " related" : ""}${
                      categoryMuted ? " category-muted" : " category-emphasized"
                    }`}
                    transform={`translate(${node.x} ${node.y})`}
                    role="button"
                    tabIndex={0}
                    aria-label={`${node.skill.name}, ${node.skill.relations.length} outgoing relations`}
                    onClick={() => onSelect(node.skill.slug)}
                    onDoubleClick={() => onOpen(node.skill.slug)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelect(node.skill.slug);
                      }
                    }}
                  >
                    <circle r={active ? 12 : 9} fill={TONE_COLORS[node.skill.tone]} />
                    <text textAnchor="middle">
                      {graphNodeLabel(node.skill.name).map((line, index) => (
                        <tspan key={line} x="0" y={24 + index * 10}>
                          {line}
                        </tspan>
                      ))}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        ) : (
          <EmptyState
            title="No loaded skills"
            detail="Import a plugin with valid skill files to build the graph."
          />
        )}
        <div className="mobile-relationship-list" aria-label="Skill relationship list">
          {pack.skills.map((skill) => (
            <button
              key={skill.slug}
              className={emphasis.get(skill.slug) ? "category-emphasized" : "category-muted"}
              onClick={() => onOpen(skill.slug)}
            >
              <i style={{ "--node": TONE_COLORS[skill.tone] } as CSSProperties} />
              <span>
                <strong>{skill.name}</strong>
                <small>
                  {skill.relations.length
                    ? `Links to ${skill.relations.join(", ")}`
                    : "No explicit relations"}
                </small>
              </span>
              <ArrowIcon />
            </button>
          ))}
        </div>
        {selected ? (
          <div className="graph-selection" aria-live="polite">
            <i style={{ "--node": TONE_COLORS[selected.tone] } as CSSProperties} />
            <span>
              <strong>{selected.name}</strong>
              <small>
                {connected.size ? `${connected.size} connected skills` : "No explicit relations"}
              </small>
            </span>
            <button onClick={() => onOpen(selected.slug)}>
              Open in Library <ArrowIcon />
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function LibraryView({
  pack,
  session,
  query,
  filteredSkills,
  selectedSkill,
  readerMode,
  onQuery,
  onCategory,
  onSelect,
  onReaderMode,
  onOpenAccount,
}: {
  pack: AtlasPack;
  session: SessionState;
  query: string;
  filteredSkills: AtlasSkill[];
  selectedSkill: AtlasSkill | undefined;
  readerMode: ReaderMode;
  onQuery: (query: string) => void;
  onCategory: (category: string) => void;
  onSelect: (slug: string) => void;
  onReaderMode: (mode: ReaderMode) => void;
  onOpenAccount: () => void;
}): ReactNode {
  return (
    <section className="library-view" aria-labelledby="library-title">
      <div className="library-index">
        <header className="library-toolbar">
          <h1 id="library-title">Library</h1>
          <label className="inline-search">
            <SearchIcon />
            <span className="sr-only">Filter the skill library</span>
            <input
              value={query}
              onChange={(event) => onQuery(event.target.value)}
              placeholder="Filter skills"
            />
          </label>
        </header>
        <div className="skill-list">
          {filteredSkills.length ? (
            filteredSkills.map((skill) => (
              <button
                key={skill.slug}
                className={selectedSkill?.slug === skill.slug ? "selected" : ""}
                onClick={() => onSelect(skill.slug)}
              >
                <i style={{ "--node": TONE_COLORS[skill.tone] } as CSSProperties} />
                <span>
                  <strong>{skill.name}</strong>
                  <small>{skill.description}</small>
                </span>
              </button>
            ))
          ) : (
            <EmptyState
              title="No matching skills"
              detail="Clear the text or category filter to return to this plugin."
              action="Clear filters"
              onAction={() => {
                onQuery("");
                onCategory("All skills");
              }}
            />
          )}
        </div>
      </div>
      <SkillReader
        pack={pack}
        skill={selectedSkill}
        session={session}
        mode={readerMode}
        onMode={onReaderMode}
        onSelectRelation={onSelect}
        onOpenAccount={onOpenAccount}
      />
    </section>
  );
}

function markdownBody(markdown: string): string {
  return markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/u, "").trim();
}

function SkillReader({
  pack,
  skill,
  session,
  mode,
  onMode,
  onSelectRelation,
  onOpenAccount,
}: {
  pack: AtlasPack;
  skill: AtlasSkill | undefined;
  session: SessionState;
  mode: ReaderMode;
  onMode: (mode: ReaderMode) => void;
  onSelectRelation: (slug: string) => void;
  onOpenAccount: () => void;
}): ReactNode {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [proposalState, setProposalState] = useState<"idle" | "saving" | "success" | "error">(
    "idle",
  );
  const [proposalError, setProposalError] = useState("");
  const [proposalResult, setProposalResult] = useState<ProposalResult | null>(null);

  useEffect(() => {
    setEditing(false);
    setDraft(skill?.markdown ?? "");
    setProposalState("idle");
    setProposalError("");
    setProposalResult(null);
  }, [skill?.slug, skill?.markdown]);

  if (!skill) {
    return (
      <aside className="skill-reader empty-reader">
        <EmptyState
          title="Choose a skill"
          detail="Select a library row to read its complete Markdown."
        />
      </aside>
    );
  }

  const canEdit = pack.source === "github" && pack.access === "write" && session.authenticated;

  async function submitProposal(): Promise<void> {
    try {
      parseSkillMarkdown(draft, skill!.slug);
    } catch {
      setProposalState("error");
      setProposalError(
        "Keep valid frontmatter, the matching skill name, and a non-empty Markdown body.",
      );
      return;
    }
    setProposalState("saving");
    setProposalError("");
    try {
      const response = await fetch("/api/proposals", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          repository: pack.repository,
          path: skill!.sourcePath,
          baseSha: pack.revision,
          content: draft,
          title: `Update ${skill!.slug} from Skill Atlas`,
          proposalId: crypto.randomUUID(),
        }),
      });
      if (!response.ok) {
        const error = await responseError(response);
        throw new Error(error.message);
      }
      const parsed = parseProposalResult(await response.json());
      if (!parsed) throw new Error("The proposal response was invalid.");
      setProposalResult(parsed);
      setProposalState("success");
      setEditing(false);
    } catch (error) {
      setProposalState("error");
      setProposalError(error instanceof Error ? error.message : providerMessage("provider-error"));
    }
  }

  return (
    <aside className="skill-reader" aria-labelledby="skill-reader-title">
      <header className="reader-head">
        <div>
          <div className="reader-title-row">
            <i style={{ "--node": TONE_COLORS[skill.tone] } as CSSProperties} />
            <h2 id="skill-reader-title">{skill.name}</h2>
          </div>
          <p>
            {skill.category} <span>·</span> {skill.slug}
          </p>
        </div>
        {canEdit ? (
          <button
            className="button secondary compact"
            onClick={() => {
              setEditing(true);
              setDraft(skill.markdown);
              setProposalState("idle");
            }}
          >
            <EditIcon /> Propose edit
          </button>
        ) : pack.access === "write" && !session.authenticated ? (
          <button className="button secondary compact" onClick={onOpenAccount}>
            Sign in to edit
          </button>
        ) : (
          <span className="reader-access">
            <LockIcon /> Read only
          </span>
        )}
      </header>
      <details className="reader-source">
        <summary>
          <RepoIcon />
          <span>
            {pack.repository} · <code>{skill.sourcePath}</code>
          </span>
          <small>{pack.access === "write" ? "Can edit" : "Read only"}</small>
          <i aria-hidden="true">
            <ArrowIcon />
          </i>
        </summary>
        <div>
          <span>
            Default branch <code>{pack.defaultBranch}</code>
          </span>
          <span>
            Revision <code>{pack.revision.slice(0, 12)}</code>
          </span>
        </div>
      </details>
      {skill.relations.length ? (
        <nav className="reader-relations" aria-label="Related skills">
          <span>Related</span>
          {skill.relations.map((slug) => (
            <button key={slug} onClick={() => onSelectRelation(slug)}>
              {slug}
            </button>
          ))}
        </nav>
      ) : (
        <p className="no-relations">No related skills declared.</p>
      )}
      {editing ? (
        <div className="editor-pane">
          <div className="editor-message">
            <strong>Propose through GitHub</strong>
            <p>
              Atlas validates the full source, creates a branch, and opens a pull request. The
              default branch is never written directly.
            </p>
          </div>
          <label>
            <span>Complete Markdown source</span>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              spellCheck={false}
            />
          </label>
          {proposalState === "error" ? (
            <p className="inline-error" role="alert">
              {proposalError}
            </p>
          ) : null}
          <div className="editor-actions">
            <button
              className="button secondary"
              onClick={() => {
                setEditing(false);
                setProposalState("idle");
              }}
            >
              Cancel
            </button>
            <button
              className="button primary"
              disabled={proposalState === "saving"}
              onClick={() => void submitProposal()}
            >
              {proposalState === "saving" ? "Creating proposal…" : "Create branch & pull request"}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="reader-tabs" role="tablist" aria-label="Skill content">
            <button
              role="tab"
              aria-selected={mode === "rendered"}
              onClick={() => onMode("rendered")}
            >
              Rendered
            </button>
            <button role="tab" aria-selected={mode === "source"} onClick={() => onMode("source")}>
              Full source
            </button>
          </div>
          <div className="reader-scroll">
            {proposalState === "success" && proposalResult ? (
              <div className="proposal-success" role="status">
                <SuccessIcon />
                <span>
                  <strong>Pull request #{proposalResult.pullRequestNumber} opened</strong>
                  <small>Branch {proposalResult.branch}</small>
                </span>
                <a href={proposalResult.pullRequestUrl} target="_blank" rel="noreferrer">
                  Review on GitHub <ExternalIcon />
                </a>
              </div>
            ) : null}
            {mode === "rendered" ? (
              <article className="markdown-body">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  skipHtml
                  components={{
                    a: ({ href, children }) => {
                      const external = href?.startsWith("https://") || href?.startsWith("http://");
                      return (
                        <a
                          href={href}
                          {...(external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
                        >
                          {children}
                        </a>
                      );
                    },
                    img: ({ alt }) => (
                      <span className="markdown-image-note" role="note">
                        Image omitted{alt ? `: ${alt}` : ""}
                      </span>
                    ),
                  }}
                >
                  {markdownBody(skill.markdown)}
                </ReactMarkdown>
              </article>
            ) : (
              <pre className="source-code">
                <code>{skill.markdown}</code>
              </pre>
            )}
          </div>
        </>
      )}
    </aside>
  );
}

function UsageView({ pack }: { pack: AtlasPack }): ReactNode {
  const signals = repositoryHealth(pack.skills);
  return (
    <section className="usage-view" aria-labelledby="usage-title">
      <header className="usage-heading">
        <h1 id="usage-title">Usage & health</h1>
        <p>
          {pack.repository} · {pack.snapshotLabel}
        </p>
      </header>
      <section className="usage-empty" aria-labelledby="usage-empty-title">
        <div className="empty-icon">
          <PulseIcon />
        </div>
        <div>
          <h2 id="usage-empty-title">Usage data isn’t connected.</h2>
          <p>
            This Atlas has not received team activity events. It will not invent totals, people,
            last-used dates, or “never used” claims.
          </p>
        </div>
      </section>
      <section className="health-section" aria-labelledby="health-title">
        <header>
          <div>
            <h2 id="health-title">Repository health</h2>
            <p>{pack.skills.length} loaded skill files · source-backed signals only</p>
          </div>
        </header>
        <div className="health-list">
          {signals.map((signal) => (
            <div key={signal.id} className={`health-row ${signal.severity}`}>
              <i aria-hidden="true">
                {signal.severity === "good" ? <SuccessIcon /> : <AttentionIcon />}
              </i>
              <span>
                <strong>{signal.label}</strong>
                <small>{signal.detail}</small>
              </span>
              <em>{signal.count}</em>
            </div>
          ))}
        </div>
      </section>
      <p className="health-summary">
        {relationCount(pack.skills)} explicit connections. Graph and health use only relations
        declared or referenced by the loaded source.
      </p>
    </section>
  );
}

function PluginsView({
  packs,
  activePack,
  session,
  onActivate,
  onImport,
  onOpenAccount,
}: {
  packs: AtlasPack[];
  activePack: AtlasPack;
  session: SessionState;
  onActivate: (pack: AtlasPack) => void;
  onImport: (repository: string) => Promise<AtlasPack>;
  onOpenAccount: () => void;
}): ReactNode {
  const [repository, setRepository] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setState("loading");
    setMessage("");
    try {
      const pack = await onImport(repository.trim());
      setState("success");
      setMessage(`${pack.repository} imported with ${pack.skills.length} skills.`);
      setRepository("");
    } catch (error) {
      const code = error instanceof ProviderError ? error.code : "provider-error";
      setState("error");
      setMessage(providerMessage(code));
    }
  }

  return (
    <section className="packs-view" aria-labelledby="plugins-title">
      <header className="packs-heading">
        <h1 id="plugins-title">Plugins</h1>
        {session.mode === "self-hosted" && session.adminAvailable && !session.authenticated ? (
          <button className="button secondary" onClick={onOpenAccount}>
            <LockIcon /> Admin sign in
          </button>
        ) : null}
      </header>
      <div className="plugin-guide">
        <RepoIcon />
        <p>
          <strong>A plugin is a Git-backed collection.</strong> It includes skills and may declare
          apps or MCP servers. Atlas shows only what the repository declares. Access determines Read
          only or Can edit; edits create a branch and pull request.
        </p>
      </div>
      <section className="import-panel" aria-labelledby="import-title">
        <div className="import-copy">
          <h2 id="import-title">Import from GitHub</h2>
          <p>
            Public repositories work without a credential. Private repositories require self-hosted
            admin access.
          </p>
        </div>
        <form onSubmit={(event) => void submit(event)}>
          <label>
            <span className="sr-only">GitHub repository</span>
            <input
              value={repository}
              onChange={(event) => setRepository(event.target.value)}
              placeholder="owner/repository"
              autoCapitalize="none"
              spellCheck={false}
            />
          </label>
          <button className="button primary" disabled={state === "loading"}>
            {state === "loading" ? "Importing…" : "Import repository"}
          </button>
        </form>
        {state === "error" ? (
          <div className="import-result error" role="alert">
            <AttentionIcon />
            <span>
              <strong>Import failed</strong>
              <small>{message}</small>
            </span>
          </div>
        ) : null}
        {state === "success" ? (
          <div className="import-result success" role="status">
            <SuccessIcon />
            <span>
              <strong>Plugin ready</strong>
              <small>{message}</small>
            </span>
          </div>
        ) : null}
        <footer>
          <span>
            <LockIcon /> Credentials are never requested or stored by the public UI.
          </span>
        </footer>
      </section>
      <section className="pack-list-section" aria-labelledby="connected-plugins-title">
        <header>
          <h2 id="connected-plugins-title">Your plugins</h2>
          <p>Imports remain in this browser session. GitHub stays canonical.</p>
        </header>
        <div className="pack-list">
          {packs.map((pack) => {
            const active = pack.id === activePack.id;
            const declaredExtensions = pluginComponentLabels(pack).filter(
              (component) => component !== "Skills",
            );
            return (
              <article key={pack.id} className={active ? "active" : ""}>
                <div className="pack-identity">
                  <span className="pack-icon">
                    <RepoIcon />
                  </span>
                  <div>
                    <h3>{pack.repository}</h3>
                    <p>
                      {pack.source === "example"
                        ? "Built-in fictional demo · available offline · not repository data"
                        : pack.repositoryUrl}
                    </p>
                  </div>
                </div>
                <p className="plugin-meta">
                  <span>{pack.skills.length} skills</span>
                  {declaredExtensions.map((component) => (
                    <span key={component}>{component}</span>
                  ))}
                  {pack.source === "github" ? <code>{pack.revision.slice(0, 12)}</code> : null}
                  <span className={pack.access === "write" ? "can-edit" : "read-only"}>
                    {pack.access === "write" ? <EditIcon /> : <LockIcon />}
                    {pack.access === "write" ? "Can edit" : "Read only"}
                  </span>
                </p>
                <div className="pack-actions">
                  {active ? (
                    <span className="active-pack">
                      <SuccessIcon /> In use
                    </span>
                  ) : (
                    <button className="button secondary compact" onClick={() => onActivate(pack)}>
                      Use plugin
                    </button>
                  )}
                  {pack.repositoryUrl ? (
                    <a
                      href={pack.repositoryUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Open ${pack.repository} on GitHub`}
                    >
                      <ExternalIcon />
                    </a>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </section>
  );
}

function TourDialog({
  open,
  step,
  onStep,
  onClose,
  onExample,
  onImport,
}: {
  open: boolean;
  step: number;
  onStep: (step: number) => void;
  onClose: () => void;
  onExample: () => void;
  onImport: () => void;
}): ReactNode {
  const ref = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useDialog(ref, open);
  useFocusTrap(ref, open);
  useEffect(() => {
    if (open) window.requestAnimationFrame(() => headingRef.current?.focus());
  }, [open, step]);
  const page = TOUR_PAGES[step] ?? TOUR_PAGES[0];
  return (
    <dialog
      ref={ref}
      className="tour-dialog"
      aria-labelledby="tour-title"
      aria-describedby="tour-description"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="tour-layout">
        <section className="tour-card">
          <button className="tour-skip" onClick={onClose}>
            Skip
          </button>
          <AtlasMark />
          <div className="tour-copy">
            <p>{page.eyebrow}</p>
            <h2 ref={headingRef} tabIndex={-1} id="tour-title">
              {page.title}
            </h2>
            <p id="tour-description">{page.description}</p>
          </div>
          <TourArt step={step} />
          <small className="tour-note">{page.note}</small>
          <footer className="tour-actions">
            <button
              className="round-button"
              onClick={() => onStep(step - 1)}
              aria-label="Previous step"
              disabled={step === 0}
            >
              <BackIcon />
            </button>
            <ol aria-label="Onboarding progress">
              {TOUR_PAGES.map((item, index) => (
                <li key={item.eyebrow}>
                  <button
                    aria-label={`Onboarding step ${index + 1}`}
                    aria-current={index === step ? "step" : undefined}
                    onClick={() => onStep(index)}
                  />
                </li>
              ))}
            </ol>
            {step < TOUR_PAGES.length - 1 ? (
              <button className="button primary tour-next" onClick={() => onStep(step + 1)}>
                Next <ArrowIcon />
              </button>
            ) : (
              <span className="tour-end-marker" aria-hidden="true" />
            )}
          </footer>
          {step === TOUR_PAGES.length - 1 ? (
            <div className="tour-final-actions">
              <button className="button secondary" onClick={onExample}>
                Explore Atlas
              </button>
              <button className="button primary" onClick={onImport}>
                Import repository <ArrowIcon />
              </button>
            </div>
          ) : null}
        </section>
      </div>
    </dialog>
  );
}

function AtlasMark(): ReactNode {
  return (
    <span className="atlas-mark" aria-hidden="true">
      {Array.from({ length: 7 }, (_, index) => (
        <i key={index} />
      ))}
    </span>
  );
}

function TourArt({ step }: { step: number }): ReactNode {
  if (step === 0)
    return (
      <div className="tour-art scattered" aria-hidden="true">
        <span>
          <LaptopIcon />
          <small>Laptop</small>
        </span>
        <span>
          <FolderIcon />
          <small>Project</small>
        </span>
        <span>
          <BotIcon />
          <small>Agent</small>
        </span>
        <i />
        <i />
      </div>
    );
  if (step === 1)
    return (
      <div className="tour-art isolated" aria-hidden="true">
        <span>
          <FileIcon />
          <small>Version A</small>
        </span>
        <b>×</b>
        <span>
          <FileIcon />
          <small>Version B</small>
        </span>
        <b>×</b>
        <span>
          <FileIcon />
          <small>Version C</small>
        </span>
      </div>
    );
  if (step === 2)
    return (
      <div className="tour-art shared" aria-hidden="true">
        <span className="center-repo">
          <RepoIcon />
          <small>Shared Git library</small>
        </span>
        {[0, 1, 2, 3].map((item) => (
          <i key={item} />
        ))}
        {[0, 1, 2, 3].map((item) => (
          <b key={item}>
            <PersonIcon />
          </b>
        ))}
      </div>
    );
  if (step === 3)
    return (
      <div className="tour-art inspect" aria-hidden="true">
        <div>
          <span />
          <span />
          <span />
        </div>
        <aside>
          <strong>Skill</strong>
          <i />
          <i />
          <i />
          <small>Propose edit</small>
        </aside>
      </div>
    );
  return (
    <div className="tour-art distributed" aria-hidden="true">
      <span className="center-repo">
        <SuccessIcon />
        <small>Reviewed</small>
      </span>
      {[0, 1, 2, 3].map((item) => (
        <b key={item}>
          <PersonIcon />
          <i>✓</i>
        </b>
      ))}
    </div>
  );
}

function SearchDialog({
  open,
  pack,
  returnRef,
  onClose,
  onOpenSkill,
}: {
  open: boolean;
  pack: AtlasPack;
  returnRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onOpenSkill: (slug: string) => void;
}): ReactNode {
  const ref = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  useDialog(ref, open);
  useFocusTrap(ref, open);
  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);
  const results = filterSkills(pack.skills, query, "All skills").slice(0, 8);
  function close(): void {
    onClose();
    window.setTimeout(() => returnRef.current?.focus(), 0);
  }
  return (
    <dialog
      ref={ref}
      className="search-dialog"
      aria-labelledby="search-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <header>
        <SearchIcon />
        <div>
          <h2 id="search-title">Search {pack.repository}</h2>
          <p>Names, descriptions, paths, and complete Markdown</p>
        </div>
        <button className="icon-button" onClick={close} aria-label="Close search">
          <CloseIcon />
        </button>
      </header>
      <label>
        <span className="sr-only">Search active skill plugin</span>
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search skills"
        />
      </label>
      <div className="search-results" aria-live="polite">
        {query && results.length === 0 ? (
          <EmptyState title="No matching skills" detail="Try a name, phrase, or skills/ path." />
        ) : (
          results.map((skill) => (
            <button key={skill.slug} onClick={() => onOpenSkill(skill.slug)}>
              <i style={{ "--node": TONE_COLORS[skill.tone] } as CSSProperties} />
              <span>
                <strong>{skill.name}</strong>
                <small>{skill.sourcePath}</small>
              </span>
              <ArrowIcon />
            </button>
          ))
        )}
      </div>
      <footer>
        <kbd>Esc</kbd> closes <span>·</span> <kbd>⌘ K</kbd> opens anywhere
      </footer>
    </dialog>
  );
}

function AccountDialog({
  open,
  session,
  returnRef,
  onClose,
  onSession,
  onReplay,
}: {
  open: boolean;
  session: SessionState;
  returnRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onSession: (session: SessionState) => void;
  onReplay: () => void;
}): ReactNode {
  const ref = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  useDialog(ref, open);
  useFocusTrap(ref, open);
  useEffect(() => {
    if (open && session.adminAvailable && !session.authenticated)
      window.setTimeout(() => inputRef.current?.focus(), 0);
    if (!open) {
      setPassword("");
      setState("idle");
    }
  }, [open, session.adminAvailable, session.authenticated]);
  function close(): void {
    onClose();
    window.setTimeout(() => returnRef.current?.focus(), 0);
  }
  async function login(event: FormEvent): Promise<void> {
    event.preventDefault();
    setState("loading");
    try {
      const response = await fetch("/api/session/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) throw new Error("denied");
      const parsed = parseSessionPayload(await response.json());
      if (!parsed) throw new Error("invalid");
      onSession(parsed);
      setPassword("");
      setState("idle");
    } catch {
      setState("error");
    }
  }
  async function logout(): Promise<void> {
    const response = await fetch("/api/session", { method: "DELETE", credentials: "same-origin" });
    const parsed = response.ok ? parseSessionPayload(await response.json()) : null;
    if (parsed) onSession(parsed);
  }
  const title = session.authenticated
    ? "Self-hosted admin"
    : session.mode === "static"
      ? "Public static edition"
      : session.adminAvailable
        ? "Admin sign in"
        : "Public self-hosted edition";
  return (
    <dialog
      ref={ref}
      className="account-dialog"
      aria-labelledby="account-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <header>
        <span className={`large-avatar${session.authenticated ? " authenticated" : ""}`}>
          {session.authenticated ? "A" : "P"}
        </span>
        <div>
          <h2 id="account-title">{title}</h2>
          <p>
            {session.authenticated
              ? "Private reads and verified provider permissions are available."
              : "No GitHub identity is claimed."}
          </p>
        </div>
        <button className="icon-button" onClick={close} aria-label="Close account">
          <CloseIcon />
        </button>
      </header>
      <div className="account-status-list">
        <div>
          <span>Atlas session</span>
          <strong>{session.authenticated ? "Authenticated" : "Public"}</strong>
        </div>
        <div>
          <span>GitHub provider</span>
          <strong>
            {session.providerAvailable
              ? "Server configured"
              : session.mode === "static"
                ? "Public reads only"
                : "Not configured"}
          </strong>
        </div>
        <div>
          <span>Session storage</span>
          <strong>{session.mode === "static" ? "None" : "Memory only"}</strong>
        </div>
      </div>
      {session.adminAvailable && !session.authenticated ? (
        <form className="account-login" onSubmit={(event) => void login(event)}>
          <label>
            <span>Admin password</span>
            <input
              ref={inputRef}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </label>
          {state === "error" ? <p role="alert">Sign-in was not accepted.</p> : null}
          <button className="button primary" disabled={state === "loading"}>
            {state === "loading" ? "Signing in…" : "Sign in"}
          </button>
          <small>
            The password is sent only to this self-hosted Node process and is never stored in the
            browser.
          </small>
        </form>
      ) : null}
      <footer>
        {session.authenticated ? (
          <button className="button secondary" onClick={() => void logout()}>
            Sign out
          </button>
        ) : (
          <button className="button secondary" onClick={onReplay}>
            Replay onboarding
          </button>
        )}
      </footer>
    </dialog>
  );
}

function EmptyState({
  title,
  detail,
  action,
  onAction,
}: {
  title: string;
  detail: string;
  action?: string;
  onAction?: () => void;
}): ReactNode {
  return (
    <div className="empty-state">
      <span>
        <EmptyIcon />
      </span>
      <strong>{title}</strong>
      <p>{detail}</p>
      {action && onAction ? <button onClick={onAction}>{action}</button> : null}
    </div>
  );
}

function useDialog(ref: RefObject<HTMLDialogElement | null>, open: boolean): void {
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open, ref]);
}

function useFocusTrap(ref: RefObject<HTMLDialogElement | null>, open: boolean): void {
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const focusable = [
        ...dialog.querySelectorAll<HTMLElement>(
          "button:not([disabled]), input:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])",
        ),
      ];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    dialog.addEventListener("keydown", onKeyDown);
    return () => dialog.removeEventListener("keydown", onKeyDown);
  }, [open, ref]);
}

function Icon({
  children,
  viewBox = "0 0 24 24",
}: {
  children: ReactNode;
  viewBox?: string;
}): ReactNode {
  return (
    <svg viewBox={viewBox} aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}
function MenuIcon(): ReactNode {
  return (
    <Icon>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Icon>
  );
}
function CloseIcon(): ReactNode {
  return (
    <Icon>
      <path d="m6 6 12 12M18 6 6 18" />
    </Icon>
  );
}
function SearchIcon(): ReactNode {
  return (
    <Icon>
      <circle cx="11" cy="11" r="6" />
      <path d="m16 16 4 4" />
    </Icon>
  );
}
function ArrowIcon(): ReactNode {
  return (
    <Icon>
      <path d="M5 12h14m-5-5 5 5-5 5" />
    </Icon>
  );
}
function BackIcon(): ReactNode {
  return (
    <Icon>
      <path d="M19 12H5m5 5-5-5 5-5" />
    </Icon>
  );
}
function RepoIcon(): ReactNode {
  return (
    <Icon>
      <path d="M6 3h10a2 2 0 0 1 2 2v16H7a3 3 0 0 1-3-3V5a2 2 0 0 1 2-2Z" />
      <path d="M7 17h11M8 7h6M8 11h7" />
    </Icon>
  );
}
function LockIcon(): ReactNode {
  return (
    <Icon>
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </Icon>
  );
}
function EditIcon(): ReactNode {
  return (
    <Icon>
      <path d="m4 20 4.2-1 10.6-10.6a2 2 0 0 0-2.8-2.8L5.4 16.2 4 20Z" />
      <path d="m14.5 7 2.8 2.8" />
    </Icon>
  );
}
function ExternalIcon(): ReactNode {
  return (
    <Icon>
      <path d="M14 4h6v6M20 4l-9 9" />
      <path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6" />
    </Icon>
  );
}
function SuccessIcon(): ReactNode {
  return (
    <Icon>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 3 3 5-6" />
    </Icon>
  );
}
function AttentionIcon(): ReactNode {
  return (
    <Icon>
      <path d="M12 3 2.8 20h18.4L12 3Z" />
      <path d="M12 9v5m0 3h.01" />
    </Icon>
  );
}
function LoadingIcon(): ReactNode {
  return (
    <Icon>
      <path d="M20 12a8 8 0 1 1-2.3-5.7" />
    </Icon>
  );
}
function GitHubIcon(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        className="github-mark"
        d="M12 2.3a10 10 0 0 0-3.16 19.49c.5.1.68-.22.68-.48v-1.87c-2.78.6-3.37-1.18-3.37-1.18-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.35 1.09 2.92.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02A9.6 9.6 0 0 1 12 6.81a9.5 9.5 0 0 1 2.5.34c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.86v3.06c0 .27.18.59.69.49A10 10 0 0 0 12 2.3Z"
      />
    </svg>
  );
}
function PulseIcon(): ReactNode {
  return (
    <Icon>
      <path d="M3 12h4l2-5 4 10 2-5h6" />
    </Icon>
  );
}
function EmptyIcon(): ReactNode {
  return (
    <Icon>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12h8" />
    </Icon>
  );
}
function LaptopIcon(): ReactNode {
  return (
    <Icon>
      <rect x="5" y="5" width="14" height="10" rx="1" />
      <path d="M3 19h18" />
    </Icon>
  );
}
function FolderIcon(): ReactNode {
  return (
    <Icon>
      <path d="M3 7h7l2 2h9v10H3V7Z" />
    </Icon>
  );
}
function BotIcon(): ReactNode {
  return (
    <Icon>
      <rect x="5" y="7" width="14" height="12" rx="3" />
      <path d="M12 3v4M9 12h.01M15 12h.01M9 16h6" />
    </Icon>
  );
}
function FileIcon(): ReactNode {
  return (
    <Icon>
      <path d="M6 3h8l4 4v14H6V3Z" />
      <path d="M14 3v5h5M9 13h6M9 17h5" />
    </Icon>
  );
}
function PersonIcon(): ReactNode {
  return (
    <Icon>
      <circle cx="12" cy="8" r="3" />
      <path d="M6 20a6 6 0 0 1 12 0" />
    </Icon>
  );
}

export { App };
