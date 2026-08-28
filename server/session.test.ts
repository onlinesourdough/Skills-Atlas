import { describe, expect, it } from "vitest";
import { cookieValue, SESSION_COOKIE, SessionStore } from "./session.js";

describe("self-hosted admin sessions", () => {
  it("fails closed without configuration and accepts only the configured password", () => {
    expect(new SessionStore(undefined).login("anything")).toBeNull();
    const store = new SessionStore("correct horse", { randomToken: () => "a".repeat(32) });
    expect(store.login("wrong")).toBeNull();
    const token = store.login("correct horse");
    expect(token).toBe("a".repeat(32));
    expect(store.authenticated(token ?? undefined)).toBe(true);
  });

  it("expires and revokes in-memory sessions", () => {
    let now = 100;
    const store = new SessionStore("secret", {
      now: () => now,
      ttlMs: 10,
      randomToken: () => "b".repeat(32),
    });
    const token = store.login("secret") ?? undefined;
    now = 111;
    expect(store.authenticated(token)).toBe(false);
    expect(store.login("secret")).toBeDefined();
    store.logout("b".repeat(32));
    expect(store.authenticated("b".repeat(32))).toBe(false);
  });

  it("parses only bounded cookie tokens", () => {
    expect(cookieValue(`other=x; ${SESSION_COOKIE}=${"c".repeat(32)}`, SESSION_COOKIE)).toBe(
      "c".repeat(32),
    );
    expect(cookieValue(`${SESSION_COOKIE}=short`, SESSION_COOKIE)).toBeUndefined();
  });
});
