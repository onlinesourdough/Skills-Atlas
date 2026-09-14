import { useEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { App } from "./App.js";
import {
  authorizedPacks,
  parsePersonalProfile,
  parsePersonalSource,
  parseImportPreview,
  PersonalApiError,
  personalMessage,
  type PersonalProfile,
  type PersonalSource,
} from "../domain/personal.js";
import type { AtlasPack, ImportPreview } from "../types.js";
import { skillDestination, internalDestination } from "../domain/deep-link.js";

const invalidatesProfile = new Set([
  "login-required",
  "session-expired",
  "membership-pending",
  "access-denied",
  "authorization-unavailable",
  "authorization-rate-limited",
]);

export function PersonalAtlas(): ReactNode {
  const [destination, setDestination] = useState(() => skillDestination(window.location.search));
  const [temporarySource, setTemporarySource] = useState<string | null>(null);
  const [connections, setConnections] = useState<
    { id: string; clientName: string; expiresAt: number }[]
  >([]);
  const [connectionsState, setConnectionsState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [connectionError, setConnectionError] = useState("");
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const connectionRequest = useRef(0);
  useEffect(() => {
    const update = () => {
      setDestination(skillDestination(window.location.search));
      setTemporarySource(null);
    };
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);
  const demo = new URLSearchParams(window.location.search).get("demo") === "1";
  const callbackError = useRef(new URLSearchParams(window.location.search).get("authError"));
  const [profile, setProfile] = useState<PersonalProfile | null>(null);
  const profileRef = useRef<PersonalProfile | null>(null);
  const [entries, setEntries] = useState<Record<string, PersonalSource>>({});
  const entriesRef = useRef<Record<string, PersonalSource>>({});
  const [busy, setBusy] = useState<string[]>([]);
  const busyRef = useRef(new Set<string>());
  const [checking, setChecking] = useState(true);
  const [locked, setLocked] = useState(false);
  const [message, setMessage] = useState(() => {
    const error = new URLSearchParams(window.location.search).get("authError");
    return error ? personalMessage(error) : "";
  });
  const [loginInfo, setLoginInfo] = useState<{ configured: boolean; organization: string | null }>({
    configured: false,
    organization: null,
  });
  const [accountOpen, setAccountOpen] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const epoch = useRef(0);
  const profileSequence = useRef(0);
  const mutationVersion = useRef(0);
  const pendingVisibility = useRef(new Map<string, boolean>());
  const csrfRef = useRef("");
  const [signOut, setSignOut] = useState<{
    everywhere: boolean;
    status: "pending" | "failed" | "complete";
  } | null>(null);
  const signOutPending = useRef(false);
  const signedOutLocally = useRef(false);
  const channelRef = useRef<BroadcastChannel | null>(null);

  function commitProfile(next: PersonalProfile | null): void {
    profileRef.current = next;
    setProfile(next);
  }
  function commitEntries(next: Record<string, PersonalSource>): void {
    entriesRef.current = next;
    setEntries(next);
  }
  function clear(code: string): void {
    epoch.current += 1;
    profileSequence.current += 1;
    commitProfile(null);
    commitEntries({});
    busyRef.current.clear();
    pendingVisibility.current.clear();
    setBusy([]);
    setAccountOpen(false);
    setConnections([]);
    setConnectionsState("loading");
    setConnectionError("");
    setDisconnecting(null);
    connectionRequest.current += 1;
    setTemporarySource(null);
    setLocked(false);
    setMessage(personalMessage(code));
    setChecking(false);
  }

  async function api(path: string, init: RequestInit = {}): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(path, {
        ...init,
        cache: "no-store",
        credentials: "same-origin",
        signal: AbortSignal.timeout(35000),
        headers: {
          "content-type": "application/json",
          "x-atlas-csrf": csrfRef.current,
          ...init.headers,
        },
      });
    } catch {
      throw new PersonalApiError("service-unavailable");
    }
    const value: unknown = await response.json();
    if (!response.ok) {
      const code =
        value &&
        typeof value === "object" &&
        "error" in value &&
        value.error &&
        typeof value.error === "object" &&
        "code" in value.error &&
        typeof value.error.code === "string"
          ? value.error.code
          : "service-unavailable";
      throw new PersonalApiError(code);
    }
    return value;
  }

  function fail(error: unknown): void {
    const code = error instanceof PersonalApiError ? error.code : "service-unavailable";
    if (invalidatesProfile.has(code)) clear(code);
    else setMessage(personalMessage(code));
  }

  function commitSource(result: PersonalSource): void {
    const current = profileRef.current;
    if (!current) return;
    const existing = current.sources.find((source) => source.id === result.source.id);
    const preference = { ...result.source, visible: existing?.visible ?? result.source.visible };
    commitProfile({
      ...current,
      sources: [...current.sources.filter((source) => source.id !== preference.id), preference],
    });
    commitEntries({ ...entriesRef.current, [preference.id]: { ...result, source: preference } });
  }

  async function loadSource(id: string): Promise<void> {
    if (busyRef.current.has(id)) return;
    busyRef.current.add(id);
    setBusy([...busyRef.current]);
    const version = epoch.current;
    try {
      const source = parsePersonalSource(await api(`/api/sources/${id}`));
      if (version !== epoch.current || !profileRef.current?.sources.some((item) => item.id === id))
        return;
      if (!source || source.source.id !== id || source.source.authorizedUntil <= Date.now())
        throw new PersonalApiError("source-unavailable");
      commitSource(source);
    } catch (error) {
      if (version !== epoch.current) return;
      const next = { ...entriesRef.current };
      delete next[id];
      commitEntries(next);
      fail(error);
    } finally {
      if (version === epoch.current) {
        busyRef.current.delete(id);
        setBusy([...busyRef.current]);
      }
    }
  }

  async function refreshProfile(): Promise<void> {
    if (signedOutLocally.current) return;
    const sequence = ++profileSequence.current;
    const version = epoch.current;
    const mutations = mutationVersion.current;
    setChecking(true);
    try {
      let next = parsePersonalProfile(await api("/api/profile"));
      if (
        sequence !== profileSequence.current ||
        version !== epoch.current ||
        mutations !== mutationVersion.current
      )
        return;
      if (!next || next.authorizedUntil <= Date.now() || next.expiresAt <= Date.now())
        throw new PersonalApiError("session-expired");
      // Refresh authorization even during a PATCH, but do not replace its pending intent.
      next = {
        ...next,
        sources: next.sources.map((source) => ({
          ...source,
          visible: pendingVisibility.current.get(source.id) ?? source.visible,
        })),
      };
      if (profileRef.current && next.user.id !== profileRef.current.user.id) {
        clear("session-expired");
        return;
      }
      csrfRef.current = next.csrfToken;
      callbackError.current = null;
      if (!profileRef.current)
        channelRef.current?.postMessage({ kind: "identity", userId: next.user.id });
      commitProfile(next);
      const usable = authorizedPacks(next, entriesRef.current, Date.now());
      commitEntries(usable);
      setLocked(false);
      setMessage("");
      for (const source of next.sources) {
        if (version !== epoch.current) break;
        if (source.available && !usable[source.id]) await loadSource(source.id);
      }
    } catch (error) {
      if (sequence === profileSequence.current && version === epoch.current) {
        clear(
          callbackError.current ??
            (error instanceof PersonalApiError ? error.code : "service-unavailable"),
        );
      }
    } finally {
      if (sequence === profileSequence.current) setChecking(false);
    }
  }

  useEffect(() => {
    if (demo) return;
    let alive = true;
    void fetch("/api/session", {
      credentials: "omit",
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    })
      .then(async (response) => {
        const info: unknown = await response.json();
        if (
          alive &&
          response.ok &&
          info &&
          typeof info === "object" &&
          "kind" in info &&
          info.kind === "atlas-login" &&
          "organization" in info
        ) {
          setLoginInfo({
            configured: true,
            organization: typeof info.organization === "string" ? info.organization : null,
          });
        }
      })
      .catch(() => {
        if (alive) setLoginInfo({ configured: false, organization: null });
      });
    void refreshProfile();
    const timer = window.setInterval(() => {
      if (!document.hidden) void refreshProfile();
    }, 60_000);
    const lock = () => {
      epoch.current += 1;
      profileSequence.current += 1;
      busyRef.current.clear();
      pendingVisibility.current.clear();
      flushSync(() => {
        setLocked(true);
        setBusy([]);
        setAccountOpen(false);
      });
    };
    const visibility = () => {
      if (document.hidden) lock();
      else void refreshProfile();
    };
    const pageshow = (event: PageTransitionEvent) => {
      if (event.persisted) void refreshProfile();
    };
    window.addEventListener("pagehide", lock);
    window.addEventListener("pageshow", pageshow);
    document.addEventListener("visibilitychange", visibility);
    const channel = new BroadcastChannel("atlas-session");
    channelRef.current = channel;
    channel.onmessage = ({ data }: MessageEvent<unknown>) => {
      if (data === "logout") {
        signedOutLocally.current = true;
        clear("session-expired");
      } else if (
        data &&
        typeof data === "object" &&
        "kind" in data &&
        data.kind === "identity" &&
        "userId" in data &&
        profileRef.current &&
        data.userId !== profileRef.current.user.id
      )
        clear("session-expired");
    };
    return () => {
      alive = false;
      epoch.current += 1;
      profileSequence.current += 1;
      window.clearInterval(timer);
      channel.close();
      channelRef.current = null;
      window.removeEventListener("pagehide", lock);
      window.removeEventListener("pageshow", pageshow);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);

  useEffect(() => {
    if (!profile) return;
    const until = Math.min(
      profile.authorizedUntil,
      profile.expiresAt,
      ...Object.values(entries).map((entry) => entry.source.authorizedUntil),
    );
    const timer = window.setTimeout(
      () => clear("session-expired"),
      Math.max(0, until - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [profile, entries]);

  async function previewSource(repository: string): Promise<ImportPreview> {
    const version = epoch.current;
    try {
      const result = parseImportPreview(
        await api("/api/sources/preview", {
          method: "POST",
          body: JSON.stringify({ repository }),
        }),
      );
      if (version !== epoch.current || !profileRef.current)
        throw new PersonalApiError("session-expired");
      if (!result || result.authorizedUntil <= Date.now())
        throw new PersonalApiError("source-unavailable");
      return result;
    } catch (error) {
      // Plugins owns preview feedback and its cancel/request guards. Only an
      // authorization failure should also invalidate the surrounding workspace.
      if (
        version === epoch.current &&
        error instanceof PersonalApiError &&
        invalidatesProfile.has(error.code)
      )
        fail(error);
      throw error;
    }
  }

  async function importSource(repository: string, preview: ImportPreview): Promise<AtlasPack> {
    const version = epoch.current;
    mutationVersion.current += 1;
    try {
      const result = parsePersonalSource(
        await api("/api/sources", {
          method: "POST",
          body: JSON.stringify({
            repository,
            expected: { repositoryId: preview.pack.repositoryId, revision: preview.pack.revision },
          }),
        }),
      );
      if (version !== epoch.current || !profileRef.current)
        throw new PersonalApiError("session-expired");
      if (!result || result.source.authorizedUntil <= Date.now())
        throw new PersonalApiError("source-unavailable");
      commitSource(result);
      setMessage("");
      return result.pack;
    } catch (error) {
      if (version === epoch.current) fail(error);
      throw error;
    } finally {
      mutationVersion.current += 1;
    }
  }

  async function toggleSource(pack: AtlasPack): Promise<void> {
    const current = profileRef.current;
    const source = current?.sources.find((item) => item.repositoryId === pack.repositoryId);
    if (!current || !source || busyRef.current.has(source.id)) return;
    const version = epoch.current;
    mutationVersion.current += 1;
    busyRef.current.add(source.id);
    setBusy([...busyRef.current]);
    const visible = !source.visible;
    pendingVisibility.current.set(source.id, visible);
    commitProfile({
      ...current,
      sources: current.sources.map((item) => (item.id === source.id ? { ...item, visible } : item)),
    });
    try {
      await api(`/api/sources/${source.id}`, {
        method: "PATCH",
        body: JSON.stringify({ visible }),
      });
      const latest = profileRef.current;
      if (version === epoch.current && latest)
        commitProfile({
          ...latest,
          sources: latest.sources.map((item) =>
            item.id === source.id ? { ...item, visible } : item,
          ),
        });
    } catch (error) {
      if (version === epoch.current) {
        const latest = profileRef.current;
        if (latest)
          commitProfile({
            ...latest,
            sources: latest.sources.map((item) =>
              item.id === source.id ? { ...item, visible: source.visible } : item,
            ),
          });
        fail(error);
      }
    } finally {
      mutationVersion.current += 1;
      if (version === epoch.current) {
        pendingVisibility.current.delete(source.id);
        busyRef.current.delete(source.id);
        setBusy([...busyRef.current]);
      } else if (profileRef.current && !document.hidden) void refreshProfile();
    }
  }

  async function removeSource(id: string): Promise<void> {
    const version = epoch.current;
    mutationVersion.current += 1;
    try {
      await api(`/api/sources/${id}`, { method: "DELETE" });
      if (version !== epoch.current) return;
      const current = profileRef.current;
      if (current)
        commitProfile({
          ...current,
          sources: current.sources.filter((source) => source.id !== id),
        });
      const next = { ...entriesRef.current };
      delete next[id];
      commitEntries(next);
      setRemoveId(null);
    } catch (error) {
      if (version === epoch.current) fail(error);
    } finally {
      mutationVersion.current += 1;
    }
  }

  async function logout(everywhere = false): Promise<void> {
    if (signOutPending.current) return;
    signOutPending.current = true;
    signedOutLocally.current = true;
    // Clear content immediately, while retaining only the CSRF value needed to invalidate the cookie.
    clear("login-required");
    setSignOut({ everywhere, status: "pending" });
    channelRef.current?.postMessage("logout");
    try {
      await api(everywhere ? "/api/signout-everywhere" : "/api/session", {
        method: everywhere ? "POST" : "DELETE",
      });
      csrfRef.current = "";
      setSignOut({ everywhere, status: "complete" });
      setMessage(
        everywhere
          ? "Signed out everywhere. Browser and agent access is revoked."
          : "Signed out of this browser. Agent connections remain active until expiry or disconnect.",
      );
    } catch {
      setSignOut({ everywhere, status: "failed" });
      setMessage(
        everywhere
          ? "Local content is cleared, but sign out everywhere could not be confirmed. Retry the same operation to revoke browser and agent access."
          : "Local content is cleared, but server sign-out could not be confirmed. Retry sign out.",
      );
    } finally {
      signOutPending.current = false;
    }
  }

  if (demo)
    return (
      <>
        <div className="personal-banner">
          Public demo · no personal profile or private sources.{" "}
          <a href="/">Return to GitHub sign-in</a>
        </div>
        <App demo />
      </>
    );
  if (!profile || locked || profile.authorizedUntil <= Date.now())
    return (
      <main id="main" className="personal-login auth-card">
        <span className="auth-brand">Skill Atlas</span>
        <h1>Sign in to Skill Atlas</h1>
        <p>
          {loginInfo.organization
            ? `Active membership in ${loginInfo.organization} is required.`
            : "Access is limited to the GitHub accounts allowed by this Atlas."}
        </p>
        <p>
          Atlas reads the repositories available to both your GitHub account and the app. Your
          source choices belong to your profile.
        </p>
        {message ? <p role="alert">{message}</p> : null}
        {checking ? <p role="status">Checking access…</p> : null}
        <form method="post" action="/auth/github/login">
          {internalDestination(
            `${window.location.pathname}${window.location.search}${window.location.hash}`,
            window.location.origin,
          ) ? (
            <input
              type="hidden"
              name="returnTo"
              value={`${window.location.pathname}${window.location.search}${window.location.hash}`}
            />
          ) : null}
          <button
            className="button primary"
            disabled={
              !loginInfo.configured || signOut?.status === "pending" || signOut?.status === "failed"
            }
          >
            Sign in with GitHub
          </button>
        </form>
        {!loginInfo.configured ? (
          <p>Sign-in is not configured. Contact the Atlas operator.</p>
        ) : null}
        <div className="login-secondary-actions">
          <button
            className="button secondary"
            disabled={signOut?.status === "pending" || signOut?.status === "failed"}
            onClick={() => window.location.reload()}
          >
            Retry access check
          </button>
          {signOut?.status === "pending" ? (
            <p role="status">
              {signOut.everywhere ? "Signing out everywhere…" : "Signing out of this browser…"}
            </p>
          ) : null}
          {signOut?.status === "failed" || (!signOut && csrfRef.current) ? (
            <button
              className="button secondary"
              onClick={() => void logout(signOut?.everywhere ?? false)}
            >
              {signOut?.everywhere ? "Retry sign out everywhere" : "Retry sign out"}
            </button>
          ) : null}
          <a href="/?demo=1">Explore the public demo</a>
        </div>
      </main>
    );

  const packs = Object.values(entries)
    .filter((entry) => entry.source.authorizedUntil > Date.now())
    .map((entry) => entry.pack);
  const sourcesPanel = (
    <section className="personal-sources" aria-label="Saved source preferences">
      <h2>Saved sources</h2>
      <p>
        Refresh reads GitHub. Remove only deletes this Atlas preference; it does not change GitHub
        or installed skills.
      </p>
      {profile.sources.map((source) => (
        <div key={source.id} className="personal-source" data-source-id={source.id}>
          <span>
            {source.repository} ·{" "}
            {source.available ? (source.visible ? "Visible" : "Hidden") : "Unavailable"}
          </span>
          <button
            className="button secondary compact"
            disabled={busy.includes(source.id)}
            onClick={() => void loadSource(source.id)}
          >
            Refresh {source.repository}
          </button>
          <button className="button secondary compact" onClick={() => setRemoveId(source.id)}>
            Remove {source.repository}
          </button>
          {removeId === source.id ? (
            <div role="group" aria-label="Confirm source removal">
              <p>Remove this source from your Atlas profile only?</p>
              <button className="button secondary" onClick={() => void removeSource(source.id)}>
                Confirm remove
              </button>
              <button className="button secondary" onClick={() => setRemoveId(null)}>
                Cancel
              </button>
            </div>
          ) : null}
        </div>
      ))}
    </section>
  );
  return (
    <>
      <App
        personal={{
          requestedSkillId: destination
            ? destination.account === profile.user.id &&
              entries[destination.source]?.pack.skills.some(
                (skill) => skill.id === destination.skill,
              ) &&
              (profile.sources.find((source) => source.id === destination.source)?.visible ||
                temporarySource === destination.source)
              ? destination.skill
              : ""
            : undefined,
          onOpenSkill: (id, view) => {
            if (!id) {
              window.history.pushState(null, "", `/#${view}`);
              setDestination(null);
              return;
            }
            const entry = Object.values(entries).find((entry) =>
              entry.pack.skills.some((skill) => skill.id === id),
            );
            if (!entry) return;
            const q = new URLSearchParams({
              account: String(profile.user.id),
              source: entry.source.id,
              skill: id,
            });
            const path = `/?${q}#${view}`;
            if (
              `${window.location.pathname}${window.location.search}${window.location.hash}` !== path
            )
              window.history.pushState(null, "", path);
            setDestination(skillDestination(q.toString()));
          },
          userName: profile.user.login,
          packs,
          visibleIds: profile.sources
            .filter(
              (source) =>
                (source.visible || temporarySource === source.id) &&
                source.available &&
                source.repositoryId !== null,
            )
            .map((source) => `github:${source.repositoryId}`),
          busyIds: profile.sources
            .filter((source) => busy.includes(source.id))
            .map((source) => `github:${source.repositoryId}`),
          notice: (
            <div className="personal-banner">
              <span>
                {checking || busy.length ? "Checking sources…" : "Personal profile · read-only"}
              </span>
              {message ? <span role="alert">{message}</span> : null}
              {destination ? (
                destination.account !== profile.user.id ? (
                  <span role="alert">
                    This link belongs to a different GitHub account. Sign in with the intended
                    account.
                  </span>
                ) : !profile.sources.some((source) => source.id === destination.source) ? (
                  <span role="alert">
                    This source was removed or is unavailable. Choose a saved source.
                  </span>
                ) : !profile.sources.find((source) => source.id === destination.source)?.visible &&
                  temporarySource !== destination.source ? (
                  <button
                    className="button secondary"
                    onClick={() => setTemporarySource(destination.source)}
                  >
                    Open hidden source temporarily
                  </button>
                ) : entries[destination.source] &&
                  !entries[destination.source]?.pack.skills.some(
                    (skill) => skill.id === destination.skill,
                  ) ? (
                  <span role="alert">
                    This skill path has changed or was removed. Refresh access or choose another
                    skill.
                  </span>
                ) : temporarySource === destination.source ? (
                  <span>Temporary view · saved visibility is unchanged.</span>
                ) : null
              ) : null}
              <button className="button secondary compact" onClick={() => void refreshProfile()}>
                Refresh access
              </button>
            </div>
          ),
          sourcesPanel,
          onAccount: () => {
            setAccountOpen(true);
            setConnections([]);
            setConnectionsState("loading");
            setConnectionError("");
            const version = epoch.current;
            const attempt = ++connectionRequest.current;
            void api("/api/connections")
              .then((value) => {
                if (version !== epoch.current || attempt !== connectionRequest.current) return;
                const rows = (value as { connections?: unknown }).connections;
                if (
                  !Array.isArray(rows) ||
                  rows.length > 20 ||
                  rows.some((row: unknown) => {
                    if (!row || typeof row !== "object") return true;
                    const item = row as Record<string, unknown>;
                    return (
                      typeof item.id !== "string" ||
                      !/^[a-f0-9-]{36}$/u.test(item.id) ||
                      typeof item.clientName !== "string" ||
                      item.clientName.length > 200 ||
                      !Number.isSafeInteger(item.expiresAt)
                    );
                  })
                )
                  throw new PersonalApiError("service-unavailable");
                setConnections(rows);
                setConnectionsState("ready");
              })
              .catch((error: unknown) => {
                if (version !== epoch.current || attempt !== connectionRequest.current) return;
                setConnectionsState("error");
                setConnectionError(
                  "Connections could not be checked. Close and reopen your account to retry.",
                );
                fail(error);
              });
          },
          onToggleSource: (pack) => void toggleSource(pack),
          onImport: importSource,
          onPreview: previewSource,
        }}
      />
      <PersonalAccount
        open={accountOpen}
        profile={profile}
        onClose={() => setAccountOpen(false)}
        onLogout={() => void logout()}
        onLogoutEverywhere={() => void logout(true)}
        connections={connections}
        connectionsState={connectionsState}
        connectionError={connectionError}
        disconnecting={disconnecting}
        onDisconnect={(id) => {
          if (disconnecting) return;
          const version = epoch.current;
          connectionRequest.current += 1;
          setDisconnecting(id);
          setConnectionError("");
          void api(`/api/connections/${id}`, { method: "DELETE" })
            .then(() => {
              if (version === epoch.current)
                setConnections((current) => current.filter((row) => row.id !== id));
            })
            .catch((error: unknown) => {
              if (version !== epoch.current) return;
              setConnectionError(
                "Disconnect could not be confirmed. Retry disconnecting this connection.",
              );
              fail(error);
            })
            .finally(() => {
              if (version === epoch.current) setDisconnecting(null);
            });
        }}
      />
    </>
  );
}

function PersonalAccount({
  open,
  profile,
  onClose,
  onLogout,
  onLogoutEverywhere,
  connections,
  onDisconnect,
  connectionsState,
  connectionError,
  disconnecting,
}: {
  open: boolean;
  profile: PersonalProfile;
  onClose: () => void;
  onLogout: () => void;
  onLogoutEverywhere: () => void;
  connections: { id: string; clientName: string; expiresAt: number }[];
  onDisconnect: (id: string) => void;
  connectionsState: "loading" | "ready" | "error";
  connectionError: string;
  disconnecting: string | null;
}): ReactNode {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!open) {
      ref.current?.close();
      return;
    }
    const previous = document.activeElement;
    ref.current?.showModal();
    return () => {
      ref.current?.close();
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="account-dialog personal-account"
      aria-labelledby="personal-account-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <h2 id="personal-account-title">Your GitHub account</h2>
      <p>
        {profile.user.login} · GitHub ID {profile.user.id}
      </p>
      <p>
        Source choices are saved to your personal profile. GitHub content stays in its repositories.
        This Atlas is read-only.
      </p>
      <p>
        Sign out clears private content from this browser. Your saved sources return after your next
        authorized login.
      </p>
      <button className="button primary" onClick={onLogout}>
        Sign out
      </button>
      <h3>Connect your agent</h3>
      <p className="connection-scope">
        Scope: <code>atlas:read</code> · This installation · Your GitHub account
      </p>
      <p>
        Use this remote MCP URL in your client's supported connection controls:{" "}
        <code>{window.location.origin}/mcp</code>. Sign in and approve read access when your client
        opens Atlas.
      </p>
      <p>
        Requested content goes to your chosen agent and model environment. Browser sign out leaves
        agent connections active until expiry. Disconnect blocks agent reads immediately.
      </p>
      {connections.map((row) => (
        <p key={row.id} className="connection-row">
          {row.clientName} · expires {new Date(row.expiresAt).toLocaleString()}{" "}
          <button
            className="button secondary"
            disabled={Boolean(disconnecting)}
            onClick={() => onDisconnect(row.id)}
          >
            {disconnecting === row.id ? "Disconnecting…" : `Disconnect ${row.clientName}`}
          </button>
        </p>
      ))}
      {connectionsState === "loading" ? <p role="status">Checking agent connections…</p> : null}
      {connectionError ? <p role="alert">{connectionError}</p> : null}
      {connectionsState === "ready" && !connections.length ? (
        <p>No active agent connections.</p>
      ) : null}
      <button className="button secondary" onClick={onLogoutEverywhere}>
        Sign out everywhere
      </button>
      <button className="button secondary" onClick={onClose}>
        Close account
      </button>
    </dialog>
  );
}
