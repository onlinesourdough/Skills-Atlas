import { visibleWorkspace, repositoryColors, repositoryKey } from "../domain/workspace.js";
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
import ReactMarkdown from "react-markdown";
import type { PersonalWorkspace } from "./personal-workspace.js";
import { GraphView, type GraphFocus } from "./GraphView.js";
import { TONE_COLORS } from "./tokens.js";
import { PersonalApiError } from "../domain/personal.js";
import remarkGfm from "remark-gfm";
import { EXAMPLE_PACK } from "../data/bundled-skills.js";
import {
  categoriesForSkills,
  reconcileCategory,
  filterSkills,
  findSkill,
  relationCount,
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
import { relativeRepositoryPath } from "../domain/relations.js";
import type {
  AtlasPack,
  AtlasSkill,
  GraphTone,
  ImportPreview,
  ProposalResult,
  SessionState,
} from "../types.js";

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
    eyebrow: "Inspect the library",
    title: "Work with the library without living in GitHub.",
    description:
      "Search, read complete skills, and follow documented references from one calm surface.",
    note: "Atlas reads GitHub content. Changes follow the repository’s own review process.",
  },
  {
    eyebrow: "Reviewed distribution",
    title: "The current version can reach the whole team.",
    description: "Each teammate can return to the reviewed GitHub version through the Atlas.",
    note: "Use a skill through a verified route in your chosen agent environment.",
  },
] as const;

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
    "empty-repository":
      "No supported skill files found. Use skills/<slug>/SKILL.md or .agents/skills/<slug>/SKILL.md at the repository root.",
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

function App({
  personal,
  demo = false,
}: { personal?: PersonalWorkspace; demo?: boolean } = {}): ReactNode {
  const [view, setView] = useState<ViewName>(initialView);
  const [localPacks, setPacks] = useState<AtlasPack[]>([EXAMPLE_PACK]);
  const [localVisibleIds, setVisibleIds] = useState<string[]>([EXAMPLE_PACK.id]);
  const packs = personal?.packs ?? localPacks;
  const visibleIds = personal?.visibleIds ?? localVisibleIds;
  const openAccount = personal?.onAccount ?? (() => setAccountOpen(true));
  const [selectedId, setSelectedId] = useState(() =>
    personal ? "" : (new URLSearchParams(window.location.search).get("skill") ?? ""),
  );
  const [graphFocus, setGraphFocus] = useState<GraphFocus>({ serial: 0, center: true });
  const [fitVersion, setFitVersion] = useState(0);
  const initiatedSelection = useRef("");
  useEffect(() => {
    if (personal?.requestedSkillId !== undefined) {
      setSelectedId(personal.requestedSkillId);
      if (personal.requestedSkillId !== initiatedSelection.current)
        setGraphFocus((current) => ({ serial: current.serial + 1, center: true }));
    }
  }, [personal?.requestedSkillId]);
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
  const importEpochRef = useRef(0);
  const visibilityTouchedRef = useRef(new Set<string>());
  const manualSourceInteractionRef = useRef(false);

  const visiblePacks = useMemo(
    () => packs.filter((pack) => visibleIds.includes(pack.id)),
    [packs, visibleIds],
  );
  const retainedColors = useRef(new Map<string, string>());
  const sourceColors = useMemo(() => {
    retainedColors.current = repositoryColors(
      packs.filter((pack) => pack.source !== "example").map(repositoryKey),
      retainedColors.current,
    );
    // The optional fictional fallback must not consume an imported repository's hue.
    for (const pack of packs)
      if (pack.source === "example") retainedColors.current.set(repositoryKey(pack), "#555d68");
    return retainedColors.current;
  }, [packs]);
  const layoutSkills = useMemo(
    () => visibleWorkspace(visiblePacks, sourceColors),
    [visiblePacks, sourceColors],
  );
  const activePack = useMemo<AtlasPack>(
    () => ({
      ...(visiblePacks[0] ?? EXAMPLE_PACK),
      repository:
        visiblePacks.length === 1
          ? visiblePacks[0]!.repository
          : `${visiblePacks.length} visible sources`,
      snapshotLabel:
        visiblePacks.length === 1 ? visiblePacks[0]!.snapshotLabel : "Browser-session selection",
      skills: layoutSkills,
    }),
    [visiblePacks, layoutSkills],
  );
  const selectedSkill = useMemo(
    () => findSkill(activePack.skills, selectedId),
    [activePack.skills, selectedId],
  );
  useEffect(() => {
    setCategory((current) => reconcileCategory(activePack.skills, current));
  }, [activePack.skills]);
  const readerPack = visiblePacks.find((pack) =>
    pack.skills.some((skill) => skill.id === selectedId),
  );
  function toggleSource(pack: AtlasPack): void {
    if (visibleIds.includes(pack.id) && pack.skills.some((skill) => skill.id === selectedId))
      selectSkill("");
    if (personal) {
      personal.onToggleSource(pack);
      return;
    }
    manualSourceInteractionRef.current = true;
    visibilityTouchedRef.current.add(pack.id);
    setVisibleIds((current) =>
      current.includes(pack.id) ? current.filter((id) => id !== pack.id) : [...current, pack.id],
    );
  }
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
      if (!personal) {
        setSelectedId(new URLSearchParams(window.location.search).get("skill") ?? "");
        setGraphFocus((current) => ({ serial: current.serial + 1, center: true }));
      }
      if (!requested) {
        window.history.replaceState(
          null,
          "",
          `${window.location.pathname}${window.location.search}#graph`,
        );
      }
    };
    window.addEventListener("hashchange", syncViewFromHash);
    window.addEventListener("popstate", syncViewFromHash);
    syncViewFromHash();
    return () => {
      window.removeEventListener("hashchange", syncViewFromHash);
      window.removeEventListener("popstate", syncViewFromHash);
    };
  }, []);

  useEffect(() => {
    if (STATIC_EDITION || personal || demo) return;
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
    if (personal) return;
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
        setDrawerOpen(false);
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
    if (viewFromHash(window.location.hash) !== next) {
      window.history.pushState(null, "", `#${next}`);
    }
    window.setTimeout(() => mainRef.current?.focus({ preventScroll: true }), 0);
  }

  function selectSkill(id: string, center = false, destination: ViewName = view): void {
    if (id && !findSkill(activePack.skills, id)) return;
    initiatedSelection.current = id;
    setSelectedId(id);
    if (id !== selectedId || center)
      setGraphFocus((current) => ({ serial: current.serial + 1, center }));
    setReaderMode("rendered");
    const nextView = destination;
    if (personal) personal.onOpenSkill?.(id, nextView);
    else {
      const params = new URLSearchParams(window.location.search);
      if (id) params.set("skill", id);
      else params.delete("skill");
      const query = params.toString();
      const url = `${window.location.pathname}${query ? `?${query}` : ""}#${nextView}`;
      if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== url)
        window.history.pushState(null, "", url);
    }
  }

  function openSkill(id: string): void {
    selectSkill(id, id !== selectedId, "library");
    setLibraryQuery("");
    navigate("library");
  }

  function activatePack(pack: AtlasPack, automatic = false): void {
    if (personal) {
      if (!visibleIds.includes(pack.id)) personal.onToggleSource(pack);
      return;
    }
    if (!automatic) manualSourceInteractionRef.current = true;
    activePackIdRef.current = pack.id;
    setVisibleIds((current) => [
      ...new Set([...current.filter((id) => id !== EXAMPLE_PACK.id), pack.id]),
    ]);
    setCategory("All skills");
    setLibraryQuery("");
    setReaderMode("rendered");
  }

  async function readRepository(repository: string, publicOnly = false): Promise<AtlasPack> {
    let pack: AtlasPack;
    if (STATIC_EDITION || demo) {
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
    setPacks((current) =>
      current.some((pack) => pack.id === result.plugin.id)
        ? current
        : upsertPlugin(current, result.plugin),
    );
    if (!manualSourceInteractionRef.current && activePackIdRef.current === EXAMPLE_PACK.id)
      activatePack(result.plugin, true);
    else if (!visibilityTouchedRef.current.has(result.plugin.id))
      setVisibleIds((current) => [...new Set([...current, result.plugin.id])]);
    setDefaultLoad({ status: "ready" });
  }

  async function previewRepository(repository: string): Promise<ImportPreview> {
    if (personal) return personal.onPreview(repository);
    const epoch = importEpochRef.current;
    const pack = await readRepository(repository);
    if (epoch !== importEpochRef.current) throw new ProviderError("authentication-required");
    return { pack, authorizedUntil: Date.now() + 300000 };
  }

  async function importRepository(repository: string, preview: ImportPreview): Promise<AtlasPack> {
    if (preview.authorizedUntil <= Date.now()) throw new PersonalApiError("preview-changed");
    if (personal) return personal.onImport(repository, preview);
    const epoch = importEpochRef.current;
    const pack = await readRepository(repository);
    if (epoch !== importEpochRef.current) throw new ProviderError("authentication-required");
    if (pack.id !== preview.pack.id || pack.revision !== preview.pack.revision)
      throw new PersonalApiError("preview-changed");
    setPacks((current) => upsertPlugin(current, pack));
    if (!packs.some((item) => item.id === pack.id) && !visibilityTouchedRef.current.has(pack.id))
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
    <div className={`app-shell view-${view}`}>
      <Topbar
        inert={drawerOpen}
        view={view}
        session={session}
        userName={personal?.userName}
        menuRef={menuRef}
        searchRef={searchRef}
        accountRef={accountRef}
        onMenu={() => setDrawerOpen(true)}
        onNavigate={navigate}
        onSearch={() => setSearchOpen(true)}
        onAccount={openAccount}
        onTour={() => openTour()}
      />
      <div className="shell-body">
        <Sidebar
          pack={activePack}
          sources={packs}
          sourceColors={sourceColors}
          visibleIds={visibleIds}
          busyIds={personal?.busyIds ?? []}
          onToggleSource={toggleSource}
          category={category}
          open={drawerOpen}
          view={view}
          onCategory={(next) => {
            setCategory(next);
            setFitVersion((current) => current + 1);
            setLibraryQuery("");
            if (view === "plugins" || view === "usage") navigate("graph");
            closeDrawer(drawerOpen);
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
        <main id="main" ref={mainRef} className="product-main" tabIndex={-1} inert={drawerOpen}>
          {personal ? (
            personal.notice
          ) : (
            <DefaultLoadStatus
              state={defaultLoad}
              exampleVisible={visibleIds.includes(EXAMPLE_PACK.id)}
              onRetry={() => void loadDefaultPlugin()}
            />
          )}
          <div className="graph-container" hidden={view !== "graph"}>
            <GraphView
              pack={activePack}
              sources={visiblePacks}
              layoutSkills={layoutSkills}
              category={category}
              selectedId={selectedSkill?.id ?? ""}
              focus={graphFocus}
              fitVersion={fitVersion}
              onSelect={selectSkill}
              onOpen={openSkill}
            />
          </div>
          {view === "library" ? (
            <LibraryView
              pack={activePack}
              readerPack={readerPack}
              sources={visiblePacks}
              session={session}
              query={libraryQuery}
              filteredSkills={filteredSkills}
              selectedSkill={selectedSkill}
              readerMode={readerMode}
              onQuery={setLibraryQuery}
              onCategory={setCategory}
              onSelect={(slug) => {
                selectSkill(slug, true, "library");
              }}
              onReaderMode={setReaderMode}
              onOpenAccount={openAccount}
              onBackGraph={() => navigate("graph")}
            />
          ) : null}
          {view === "usage" ? <UsageView pack={activePack} /> : null}
          {view === "plugins" ? (
            <div className="source-manager">
              <PluginsView
                packs={packs}
                visibleIds={visibleIds}
                onToggleSource={toggleSource}
                session={session}
                onActivate={activatePack}
                onImport={importRepository}
                onPreview={previewRepository}
                persistent={Boolean(personal)}
                onOpenAccount={openAccount}
              />
              {personal?.sourcesPanel}
            </div>
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
          if (view === "library") openSkill(slug);
          else {
            selectSkill(slug, true, "graph");
            navigate("graph");
          }
        }}
      />
      <AccountDialog
        open={accountOpen}
        session={session}
        returnRef={accountRef}
        onClose={() => setAccountOpen(false)}
        onSession={(next) => {
          if (session.authenticated && !next.authenticated) {
            importEpochRef.current += 1;
            visibilityTouchedRef.current.clear();
            manualSourceInteractionRef.current = false;
            setPacks([EXAMPLE_PACK]);
            setVisibleIds([EXAMPLE_PACK.id]);
            setSelectedId("");
            activePackIdRef.current = EXAMPLE_PACK.id;
            void loadDefaultPlugin();
          }
          setSession(next);
        }}
        onReplay={() => {
          setAccountOpen(false);
          openTour();
        }}
      />
    </div>
  );
}

function Topbar({
  inert,
  view,
  session,
  userName,
  menuRef,
  searchRef,
  accountRef,
  onMenu,
  onNavigate,
  onSearch,
  onAccount,
  onTour,
}: {
  inert: boolean;
  view: ViewName;
  session: SessionState;
  userName?: string | undefined;
  menuRef: RefObject<HTMLButtonElement | null>;
  searchRef: RefObject<HTMLButtonElement | null>;
  accountRef: RefObject<HTMLButtonElement | null>;
  onMenu: () => void;
  onNavigate: (view: ViewName) => void;
  onSearch: () => void;
  onAccount: () => void;
  onTour: () => void;
}): ReactNode {
  const accountLabel =
    userName ??
    (session.authenticated
      ? "Admin"
      : session.mode === "self-hosted" && session.adminAvailable
        ? "Sign in"
        : "Public");
  return (
    <header className="topbar" inert={inert}>
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
          <img src={`${import.meta.env.BASE_URL}favicon.png`} alt="" width="24" height="24" />
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
  exampleVisible,
  onRetry,
}: {
  state: DefaultLoadState;
  exampleVisible: boolean;
  onRetry: () => void;
}): ReactNode {
  if (state.status === "ready") return null;
  const message =
    state.status === "loading"
      ? "Loading live skills from GitHub…"
      : state.code === "rate-limited"
        ? `GitHub’s read limit was reached.${exampleVisible ? " Showing Offline example." : " Retry the default source."}`
        : `Live skills are unavailable.${exampleVisible ? " Showing Offline example." : " Retry the default source."}`;
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
  sources,
  sourceColors,
  visibleIds,
  busyIds,
  onToggleSource,
}: {
  sources: AtlasPack[];
  sourceColors: Map<string, string>;
  visibleIds: string[];
  busyIds: string[];
  onToggleSource: (pack: AtlasPack) => void;
  pack: AtlasPack;
  category: string;
  open: boolean;
  view: ViewName;
  onCategory: (category: string) => void;
  onPlugins: () => void;
  onClose: () => void;
}): ReactNode {
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width: 820px)").matches);
  const railRef = useRef<HTMLElement>(null);
  useFocusTrap(railRef, mobile && open);
  useEffect(() => {
    if (mobile && open) railRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [mobile, open]);
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
      ref={railRef}
      className={`taxonomy-rail${open ? " open" : ""}`}
      aria-label="Skill taxonomy"
      aria-hidden={mobile && !open ? true : undefined}
      inert={mobile && !open}
      role={mobile && open ? "dialog" : undefined}
      aria-modal={mobile && open ? true : undefined}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="rail-mobile-head">
        <strong>Browse</strong>
        <button className="icon-button" onClick={onClose} aria-label="Close navigation">
          <CloseIcon />
        </button>
      </div>
      {mobile ? (
        <a
          className="drawer-source-link"
          href="https://github.com/onlinesourdough/Skills-Atlas"
          target="_blank"
          rel="noreferrer noopener"
          aria-label="View Skills Atlas source on GitHub"
        >
          <GitHubIcon /> App source on GitHub
        </a>
      ) : null}
      <section aria-label="Sources" className="source-controls">
        <h2 className="rail-label">Sources</h2>
        {sources.map((source) => (
          <label key={source.id} title={source.repository}>
            <input
              type="checkbox"
              aria-label={source.repository}
              checked={visibleIds.includes(source.id)}
              disabled={busyIds.includes(source.id)}
              onChange={() => onToggleSource(source)}
            />
            <i
              className="source-swatch"
              aria-hidden="true"
              style={{ background: sourceColors.get(repositoryKey(source)) }}
            />
            <span className="source-name">
              <strong>
                {source.repository.split("/").slice(1).join("/") || source.repository}
              </strong>
              <small>{source.repository}</small>
            </span>
          </label>
        ))}
      </section>
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

function LibraryView({
  pack,
  readerPack,
  sources,
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
  onBackGraph,
}: {
  pack: AtlasPack;
  session: SessionState;
  query: string;
  readerPack: AtlasPack | undefined;
  sources: AtlasPack[];
  filteredSkills: AtlasSkill[];
  selectedSkill: AtlasSkill | undefined;
  readerMode: ReaderMode;
  onQuery: (query: string) => void;
  onCategory: (category: string) => void;
  onSelect: (slug: string) => void;
  onReaderMode: (mode: ReaderMode) => void;
  onOpenAccount: () => void;
  onBackGraph: () => void;
}): ReactNode {
  const [reading, setReading] = useState(Boolean(selectedSkill));
  const libraryRef = useRef<HTMLElement>(null);
  useEffect(() => {
    setReading(Boolean(selectedSkill));
  }, [selectedSkill?.id]);
  useEffect(() => {
    if (reading && selectedSkill && window.matchMedia("(max-width: 820px)").matches)
      requestAnimationFrame(() =>
        libraryRef.current?.querySelector<HTMLElement>("#skill-reader-title")?.focus(),
      );
  }, [reading, selectedSkill?.id]);
  function backToList(): void {
    setReading(false);
    requestAnimationFrame(() => {
      const buttons = libraryRef.current?.querySelectorAll<HTMLButtonElement>(
        ".skill-list button[data-skill-id]",
      );
      [...(buttons ?? [])].find((button) => button.dataset.skillId === selectedSkill?.id)?.focus();
    });
  }
  return (
    <section
      ref={libraryRef}
      className={`library-view${reading && selectedSkill ? " reading" : ""}`}
      aria-label="Skill library"
    >
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
                key={skill.id}
                data-skill-id={skill.id}
                className={selectedSkill?.id === skill.id ? "selected" : ""}
                onClick={() => {
                  setReading(true);
                  onSelect(skill.id);
                }}
                aria-current={selectedSkill?.id === skill.id ? "true" : undefined}
              >
                <i style={{ "--node": TONE_COLORS[skill.tone] } as CSSProperties} />
                <span>
                  <strong>{skill.name}</strong>
                  <small>{skill.description}</small>
                  <small>
                    {
                      sources.find((source) => source.skills.some((item) => item.id === skill.id))
                        ?.repository
                    }{" "}
                    · {skill.sourcePath}
                  </small>
                  <small>
                    {skill.category} ·{" "}
                    {skill.sourcePath.startsWith(".agents/")
                      ? "Repository-local shelf"
                      : "Distributed shelf"}
                  </small>
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
      <div className="library-reader">
        <nav className="reader-navigation" aria-label="Reader navigation">
          <button className="back-to-list" onClick={backToList}>
            <BackIcon /> Back to list
          </button>
          <button onClick={onBackGraph}>
            <BackIcon /> Back to graph
          </button>
        </nav>
        <SkillReader
          pack={{ ...(readerPack ?? pack), skills: pack.skills }}
          skill={selectedSkill}
          session={session}
          mode={readerMode}
          onMode={onReaderMode}
          onSelectRelation={onSelect}
          onOpenAccount={onOpenAccount}
        />
      </div>
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
  }, [skill?.id, skill?.markdown, pack.revision, pack.access, session.authenticated]);

  if (!skill) {
    return (
      <aside className="skill-reader empty-reader">
        <EmptyState
          title="Select a skill to read"
          detail="Select a library row to read its complete Markdown."
        />
      </aside>
    );
  }

  const proposalPath = skill.sourcePath.startsWith("skills/");
  const canEdit =
    proposalPath && pack.source === "github" && pack.access === "write" && session.authenticated;

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
            <h2 id="skill-reader-title" tabIndex={-1}>
              {skill.name}
            </h2>
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
        ) : proposalPath && pack.access === "write" && !session.authenticated ? (
          <button className="button secondary compact" onClick={onOpenAccount}>
            Sign in to edit
          </button>
        ) : (
          <span className="reader-access">
            <EyeIcon /> Read only
          </span>
        )}
      </header>
      <div className="reader-summary">
        <details className="reader-source">
          <summary>
            <RepoIcon />
            <span>
              {pack.repository} · <code>{skill.sourcePath}</code>
            </span>
            <small>{proposalPath && pack.access === "write" ? "Can edit" : "Read only"}</small>
            <i aria-hidden="true">
              <ArrowIcon />
            </i>
          </summary>
          <div>
            <span>
              Default branch <code>{pack.defaultBranch}</code>
            </span>
            <span>
              Revision <code>{pack.revision}</code>
            </span>
            {pack.repositoryUrl ? (
              <a
                href={`${pack.repositoryUrl}/blob/${pack.revision}/${skill.sourcePath}`}
                target="_blank"
                rel="noreferrer noopener"
              >
                Read file on GitHub
              </a>
            ) : null}
          </div>
        </details>
        {skill.relations.length ? (
          <nav className="reader-relations" aria-label="Related skills">
            <span>Related</span>
            {skill.relations.map((slug) => (
              <button key={slug} onClick={() => onSelectRelation(slug)}>
                {findSkill(pack.skills, slug)?.name ?? "Unavailable target"} ·{" "}
                {findSkill(pack.skills, slug)?.sourceRepository} ·{" "}
                {findSkill(pack.skills, slug)?.sourcePath}
              </button>
            ))}
          </nav>
        ) : (
          <p className="no-relations">No related skills declared.</p>
        )}
        {skill.evidence?.length ? (
          <details className="reader-evidence">
            <summary>Relation evidence (references, not runtime calls)</summary>
            <ul>
              {skill.evidence.map((item, index) => (
                <li key={index}>
                  {item.kind === "reference" ? "References" : "Declared relation"}: {item.target} —{" "}
                  {item.status}
                  {item.explanation ? ` · ${item.explanation}` : ""}
                  <small>
                    {" "}
                    · {item.sourcePath}:{item.line}
                  </small>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        {pack.skills.some((item) => item.relations.includes(skill.id)) ? (
          <nav className="reader-relations" aria-label="Referenced by">
            <span>Referenced by</span>
            {pack.skills
              .filter((item) => item.relations.includes(skill.id))
              .map((item) => (
                <button key={item.id} onClick={() => onSelectRelation(item.id)}>
                  {item.name} · {item.sourceRepository} · {item.sourcePath}
                </button>
              ))}
          </nav>
        ) : null}
      </div>
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
          <div className="reader-scroll" tabIndex={0} aria-label="Complete skill content">
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
                      const path = href ? relativeRepositoryPath(skill.sourcePath, href) : null;
                      const resolved = skill.evidence?.find(
                        (item) => item.target === href && item.status === "resolved",
                      );
                      const target = resolved
                        ? findSkill(pack.skills, resolved.targetId ?? "")
                        : pack.skills.find(
                            (item) =>
                              item.sourceRepository === skill.sourceRepository &&
                              item.sourcePath === path,
                          );
                      if (target)
                        return (
                          <button onClick={() => onSelectRelation(target.id)}>{children}</button>
                        );
                      if (path && pack.repositoryUrl)
                        href = `${pack.repositoryUrl}/blob/${pack.revision}/${path.split("/").map(encodeURIComponent).join("/")}`;
                      else if (
                        !href?.startsWith("https://") &&
                        !href?.startsWith("http://") &&
                        !href?.startsWith("mailto:")
                      )
                        return <span>{children} (unresolved link)</span>;
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
            <p>
              {pack.skills.length} loaded skill {pack.skills.length === 1 ? "file" : "files"} ·
              source-backed signals only
            </p>
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
  persistent,
  packs,
  visibleIds,
  onToggleSource,
  session,
  onActivate,
  onImport,
  onPreview,
  onOpenAccount,
}: {
  persistent: boolean;
  packs: AtlasPack[];
  visibleIds: string[];
  onToggleSource: (pack: AtlasPack) => void;
  session: SessionState;
  onActivate: (pack: AtlasPack) => void;
  onPreview: (repository: string) => Promise<ImportPreview>;
  onImport: (repository: string, preview: ImportPreview) => Promise<AtlasPack>;
  onOpenAccount: () => void;
}): ReactNode {
  const [repository, setRepository] = useState("");
  const [state, setState] = useState<
    "idle" | "loading" | "preview" | "saving" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const requestEpoch = useRef(0);
  const pending = useRef(false);
  useEffect(
    () => () => {
      requestEpoch.current += 1;
    },
    [],
  );
  useEffect(() => {
    if (!preview) return;
    const timer = window.setTimeout(
      () => {
        setPreview(null);
        setState("error");
        setMessage(
          "Preview expired. Preview the repository again to check current access and revision.",
        );
      },
      Math.max(0, preview.authorizedUntil - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [preview]);

  function cancelPreview(): void {
    requestEpoch.current += 1;
    pending.current = false;
    setPreview(null);
    setState("idle");
    setMessage("");
  }

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    const attempt = ++requestEpoch.current;
    setState("loading");
    setPreview(null);
    setMessage("");
    try {
      const result = await onPreview(repository.trim());
      if (attempt !== requestEpoch.current) return;
      setPreview(result);
      setState("preview");
    } catch (error) {
      if (attempt !== requestEpoch.current) return;
      const code = error instanceof ProviderError ? error.code : "provider-error";
      setState("error");
      setMessage(error instanceof PersonalApiError ? error.message : providerMessage(code));
    } finally {
      if (attempt === requestEpoch.current) pending.current = false;
    }
  }

  async function confirmImport(): Promise<void> {
    if (!preview || pending.current) return;
    pending.current = true;
    const attempt = ++requestEpoch.current;
    setState("saving");
    try {
      const pack = await onImport(preview.pack.repository, preview);
      if (attempt !== requestEpoch.current) return;
      setPreview(null);
      setState("success");
      setMessage(
        `${pack.repository} imported with ${pack.skills.length} ${pack.skills.length === 1 ? "skill" : "skills"}.`,
      );
      setRepository("");
    } catch (error) {
      if (attempt !== requestEpoch.current) return;
      setPreview(null);
      setState("error");
      setMessage(
        error instanceof PersonalApiError
          ? error.message
          : providerMessage(error instanceof ProviderError ? error.code : "provider-error"),
      );
    } finally {
      if (attempt === requestEpoch.current) pending.current = false;
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
          apps or MCP servers. Atlas shows only what the repository declares. Imports are read-only.
          This Atlas does not install components or write to GitHub.
        </p>
      </div>
      <section className="import-panel" aria-labelledby="import-title">
        <div className="import-copy">
          <h2 id="import-title">Import from GitHub</h2>
          <p>
            {persistent
              ? "Choose a repository available to your GitHub account and this app."
              : "Public repositories work without a credential. Use the personal GitHub login edition for private repositories."}
          </p>
        </div>
        <form onSubmit={(event) => void submit(event)}>
          <label>
            <span className="sr-only">GitHub repository</span>
            <input
              value={repository}
              onChange={(event) => {
                cancelPreview();
                setRepository(event.target.value);
              }}
              disabled={state === "saving"}
              placeholder="owner/repository"
              autoCapitalize="none"
              spellCheck={false}
            />
          </label>
          <button className="button primary" disabled={state === "loading" || state === "saving"}>
            {state === "loading" ? "Reading repository…" : "Preview repository"}
          </button>
        </form>
        {state === "loading" ? <button onClick={cancelPreview}>Cancel preview</button> : null}
        {preview ? (
          <section className="import-preview" aria-label="Repository preview">
            <h3>{preview.pack.repository}</h3>
            <p>
              {preview.pack.skills.length} {preview.pack.skills.length === 1 ? "skill" : "skills"} ·
              Read only · <code>{preview.pack.revision.slice(0, 12)}</code>
            </p>
            <ul>
              {["skills/", ".agents/skills/"].map((shelf) => {
                const count = preview.pack.skills.filter((skill) =>
                  skill.sourcePath.startsWith(shelf),
                ).length;
                return count ? (
                  <li key={shelf}>
                    <code>{shelf}</code> · {count} {count === 1 ? "skill" : "skills"}
                  </li>
                ) : null;
              })}
            </ul>
            <p>
              {preview.pack.discovery
                ? `${preview.pack.discovery.skippedSkillFiles} unsupported skill files skipped.`
                : "Skipped-file count is unavailable for this source."}
            </p>
            <p>
              Confirm to add this source to {persistent ? "your profile" : "this browser session"}.
              Existing visibility choices are preserved. GitHub content and installations stay in
              place.
            </p>
            <div className="preview-actions">
              <button
                className="button secondary"
                disabled={state === "saving"}
                onClick={cancelPreview}
              >
                Cancel preview
              </button>
              <button
                className="button primary"
                disabled={state === "saving"}
                onClick={() => void confirmImport()}
              >
                {state === "saving" ? "Importing…" : "Confirm import"}
              </button>
            </div>
          </section>
        ) : null}
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
          <p>
            {persistent
              ? "Source choices are saved to your profile. GitHub stays canonical."
              : "Imports remain in this browser session. GitHub stays canonical."}
          </p>
        </header>
        <div className="pack-list">
          {packs.map((pack) => {
            const active = visibleIds.includes(pack.id);
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
                  <span>
                    {pack.skills.length} {pack.skills.length === 1 ? "skill" : "skills"}
                  </span>
                  {pack.skills.some((skill) => skill.sourcePath.startsWith(".agents/")) ? (
                    <span>Repository-local shelf included</span>
                  ) : null}
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
                      <button onClick={() => onToggleSource(pack)}>Hide source</button>
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
  const [activeIndex, setActiveIndex] = useState(0);
  useDialog(ref, open);
  useFocusTrap(ref, open);
  useEffect(() => {
    if (open) {
      setActiveIndex(0);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);
  const results = filterSkills(pack.skills, query, "All skills").slice(0, 8);
  useEffect(() => {
    if (open)
      ref.current
        ?.querySelector<HTMLElement>(`#skill-result-${activeIndex}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);
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
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
          role="combobox"
          aria-expanded="true"
          aria-controls="skill-search-results"
          aria-activedescendant={results[activeIndex] ? `skill-result-${activeIndex}` : undefined}
          aria-autocomplete="list"
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((index) =>
                results.length
                  ? (index + (event.key === "ArrowDown" ? 1 : results.length - 1)) % results.length
                  : 0,
              );
            } else if (event.key === "Enter" && results[activeIndex]) {
              event.preventDefault();
              onOpenSkill(results[activeIndex].id);
            }
          }}
          placeholder="Search skills"
        />
      </label>
      <div
        className="search-results"
        id="skill-search-results"
        role="listbox"
        aria-label="Matching skills"
      >
        {query && results.length === 0 ? (
          <EmptyState
            title="No matching skills"
            detail={`Searching ${pack.skills.length} ${pack.skills.length === 1 ? "skill" : "skills"} in visible sources. Try a name, phrase, or path, or change source visibility.`}
          />
        ) : (
          results.map((skill, index) => (
            <button
              key={skill.id}
              id={`skill-result-${index}`}
              role="option"
              aria-selected={activeIndex === index}
              data-skill-id={skill.id}
              onFocus={() => setActiveIndex(index)}
              onClick={() => onOpenSkill(skill.id)}
            >
              <i style={{ "--node": TONE_COLORS[skill.tone] } as CSSProperties} />
              <span>
                <strong>{skill.name}</strong>
                <small>
                  {skill.sourceRepository} · {skill.sourcePath}
                </small>
                <small className="search-context">{searchContext(skill, query)}</small>
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

function searchContext(skill: AtlasSkill, query: string): string {
  const text = skill.description.toLowerCase().includes(query.toLowerCase())
    ? skill.description
    : skill.markdown;
  const match = query ? text.toLowerCase().indexOf(query.toLowerCase()) : 0;
  const start = Math.max(0, match - 30);
  return `${start ? "…" : ""}${text.slice(start, start + 140).replace(/\s+/gu, " ")}${text.length > start + 140 ? "…" : ""}`;
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
  useDialog(ref, open);
  useFocusTrap(ref, open);
  function close(): void {
    onClose();
    window.setTimeout(() => returnRef.current?.focus(), 0);
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
        ? "Admin login retired"
        : "Public preview edition";
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
        <p>Shared admin login is retired. Use the personal GitHub login edition.</p>
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

function useFocusTrap(ref: RefObject<HTMLElement | null>, open: boolean): void {
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
function EyeIcon(): ReactNode {
  return (
    <Icon>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
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
