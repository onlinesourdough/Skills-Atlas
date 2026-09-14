import assert from "node:assert/strict";
import { readFile, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

// Run after all three browser suites. Old screenshots cannot satisfy a new run.
const groups = {
  "browser-proof.json": [
    "r4-desktop-offline-fallback.png",
    "r4-desktop-graph-loaded-default.png",
    "foundation-multi-source.png",
    "phase-g-category-fit.png",
    "phase-g-inspector.png",
    "phase-g-keyboard-focus.png",
    "phase-g-resize-fixed-before.png",
    "phase-g-resize-fixed-after.png",
    "phase-g-selected-source-refresh.png",
    "r4-desktop-library-rendered.png",
    "foundation-reader-last-line.png",
    "foundation-no-visible-sources.png",
    "r4-desktop-plugins-loaded-and-error.png",
    "r4-desktop-usage-health.png",
    "phase-g-reader-820.png",
    "phase-g-reader-390.png",
    "phase-g-reader-200-percent-reflow.png",
    "r4-static-root.png",
    "r4-static-prefixed.png",
  ],
  "phase-c-browser.json": [
    "phase-g-login.png",
    "phase-g-pending-denied.png",
    "phase-g-nonmember-denied.png",
    "phase-g-outside-denied.png",
    "phase-g-first-source.png",
    "phase-g-personal-default-error.png",
    "phase-g-import-preview.png",
    "phase-c-private-reader.png",
  ],
  "phase-d-browser.json": [
    "phase-g-agent-consent.png",
    "phase-g-agent-connected.png",
    "phase-g-agent-disconnected.png",
    "phase-g-agent-private-reader.png",
    "phase-g-private-account-mismatch.png",
    "phase-g-agent-revoked.png",
  ],
};
const frames = [];
for (const [reportName, names] of Object.entries(groups)) {
  const report = JSON.parse(await readFile(`proof/runtime/${reportName}`, "utf8"));
  assert(
    report.status === "PASS" || (Array.isArray(report.failures) && !report.failures.length),
    `Browser report did not pass: ${reportName}`,
  );
  const start = Date.parse(report.startedAt);
  const end = Date.parse(report.completedAt);
  assert(Number.isFinite(start) && Number.isFinite(end), "Browser report lacks run timestamps");
  for (const name of names) {
    const path = `proof/screenshots/${name}`;
    const info = await stat(path);
    assert(info.mtimeMs >= start - 1000 && info.mtimeMs <= end + 1000, `Stale keyframe: ${name}`);
    const bytes = await readFile(path);
    assert.equal(bytes.subarray(1, 4).toString(), "PNG", `Invalid image: ${name}`);
    if (name === "phase-g-reader-200-percent-reflow.png") {
      assert.equal(bytes.readUInt32BE(16), 1440, "Reflow capture width changed");
      assert.equal(bytes.readUInt32BE(20), 900, "Reflow capture height changed");
      const model = report.observations.find((item) => item.label === "phase-g-200-percent-reflow");
      assert(
        model?.capture?.method === "Page.captureScreenshot" && model.finalLineVisible,
        "Reflow native capture/final-line evidence missing",
      );
      for (const stage of [
        "initial",
        "back-to-list",
        "select-reader",
        "focus-reader",
        "end",
        "after-contrast-before-capture",
        "after-capture",
      ]) {
        const metrics = model.modelMetrics.find((item) => item.stage === stage);
        assert(
          metrics?.width === 720 &&
            metrics.height === 450 &&
            metrics.ratio === 2 &&
            !metrics.overflow,
          `Reflow metrics missing or invalid: ${stage}`,
        );
      }
    }
    frames.push({
      path,
      report: reportName,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20),
      syntheticOnly: true,
    });
  }
}
await writeFile(
  "proof/runtime/phase-g-keyframes.json",
  JSON.stringify(
    {
      status: "CAPTURED_PENDING_VISUAL_REVIEW",
      generatedAt: new Date().toISOString(),
      frames,
      limits:
        "Synthetic renders; browser-zoom reflow is emulated. No live provider, native client, installation or Ship proof.",
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Recorded ${frames.length} fresh keyframes; independent visual review is still required.`,
);
