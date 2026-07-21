# `/reload` hang with `@ff-labs/pi-fff`

## Summary

Pi 0.81.1 can hang indefinitely during `/reload` when `@ff-labs/pi-fff` 0.10.1 is loaded in the Bun-compiled Pi binary on macOS. The TUI remains on:

```text
Reloading keybindings, extensions, skills, prompts, themes, and context files...
```

The immediate failure boundary is the second dynamic import of `@ff-labs/fff-bun`. Initial startup imports the SDK successfully. Reload completes the old extension's `session_shutdown`, creates the new extension instance, enters its new `session_start`, and then waits forever for `import("@ff-labs/fff-bun")`.

A minimal extension that only dynamically imports `@ff-labs/fff-bun` reproduces the problem. FileFinder creation, scanning, database locking, and finder destruction are therefore not required to trigger the hang.

## Environment

Observed on July 21, 2026:

- Pi: 0.81.1
- Pi executable: Bun-compiled `/Users/rko/pi/pi`
- `@ff-labs/pi-fff`: 0.10.1
- `@ff-labs/fff-bun`: 0.10.1
- `@ff-labs/fff-node`: 0.10.1
- macOS: 26.5.2 (25F84), arm64
- Project: ordinary Git repository, approximately 35,000 files

At investigation time, 0.10.1 was also the latest npm version of all three FFF packages.

## User-visible behavior

1. Start Pi normally with `npm:@ff-labs/pi-fff` configured.
2. Wait for startup to finish.
3. Run `/reload`.
4. Pi replaces the editor with the reload status box.
5. The status box never disappears. No error is shown and keyboard input does not restore normal operation.

The affected process was alive but not making progress. It was sleeping in the event loop rather than spinning at high CPU.

## Minimal configuration

A configuration containing only FFF is sufficient:

```json
{
  "defaultProjectTrust": "always",
  "packages": [
    "npm:@ff-labs/pi-fff"
  ]
}
```

Start interactive Pi, then enter `/reload`.

## Test matrix

Each case used a fresh temporary Pi home and a fresh TUI process. Reload was driven through tmux and allowed at least 15 seconds after startup plus 20 seconds after `/reload`.

| Configuration | Result |
| --- | --- |
| No packages | Reload succeeds |
| All normal packages and local extensions | Hangs |
| All normal packages, no local extensions | Hangs |
| All normal packages except `@ff-labs/pi-fff` | Reload succeeds |
| `@ff-labs/pi-fff` only | Hangs |
| Minimal extension dynamically importing `@ff-labs/fff-bun` only | Hangs |

Other configured extensions were ruled out by the successful no-FFF case:

- `pi-powerline-footer`
- `pi-intercom`
- `pi-goal`
- `pi-interactive-shell`
- `pi-subagents`
- `@juicesharp/rpiv-ask-user-question`
- local `tps-tracker.ts`, `usage.ts`, and `yeet.ts`

## Pi reload path

Pi's reload sequence is implemented in `packages/coding-agent/src/core/agent-session.ts`:

1. Await `session_shutdown` on the old extension runner.
2. Reload settings and resources.
3. Build a new extension runtime.
4. Await `session_start` on the new extension runner.
5. Extend resources from extensions.

Interactive mode awaits that full sequence before dismissing the reload status box. An extension `session_start` promise that never settles therefore leaves the TUI on the reload screen indefinitely.

This behavior is consistent with the observed hang: shutdown finishes, runtime rebuilding begins, and the new FFF `session_start` never settles.

## FFF code path

`@ff-labs/pi-fff/src/sdk.ts` keeps a module-local SDK promise:

```ts
let sdkPromise: Promise<{ FileFinder: FileFinderStatic }> | null = null;

export function loadSdk(): Promise<{ FileFinder: FileFinderStatic }> {
  if (sdkPromise) return sdkPromise;

  const pkg = detectRuntime() === "bun" ? "@ff-labs/fff-bun" : "@ff-labs/fff-node";
  sdkPromise = import(pkg) as Promise<{ FileFinder: FileFinderStatic }>;
  return sdkPromise;
}
```

`@ff-labs/pi-fff/src/index.ts` awaits it from finder initialization during every `session_start`:

```ts
const { FileFinder } = await loadSdk();
```

On reload, Pi creates a new extension module instance. Its module-local `sdkPromise` starts as `null`, so `loadSdk()` performs another dynamic import.

## Instrumented trace

The installed FFF extension was copied to a temporary directory and instrumented with append-only timestamp logging around its factory, lifecycle handlers, SDK load, finder creation, and scan wait. No installed files were changed.

Initial startup completed normally:

```text
factory
session_start enter
ensureFinder enter
before loadSdk
after loadSdk, before create
after create
before waitForScan
after waitForScan
session_start exit
```

Reload then reached:

```text
session_shutdown enter
destroyFinder enter
destroyFinder exit
session_shutdown exit
factory
session_start enter
ensureFinder enter
before loadSdk
```

No `after loadSdk` line appeared, even after waiting well beyond FFF's 15-second scan timeout. This rules out `FileFinder.create()` and `waitForScan()` as the blocking operation.

## Minimal dynamic-import reproducer

The following extension reproduces the same hang without creating a finder:

```ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async () => {
    await import("@ff-labs/fff-bun");
  });
}
```

Observed trace:

```text
factory
before import
after import
shutdown
factory
before import
```

The second import never resolves. This isolates the trigger to repeated dynamic import of the native FFF Bun package across Pi extension reload.

## Process evidence

The original hung Pi process had these characteristics:

- Process remained alive for more than ten minutes.
- Main thread sampled in `kevent64`, waiting for event-loop work.
- Four `fff-bg-*` native threads were present and sleeping in the FFF dylib's Rayon worker pool.
- The FFF native dylib was loaded from `@ff-labs/fff-bun`.
- CPU use was generally near zero; this was a stalled promise, not a busy loop.
- No exception or extension error reached the TUI.

The original hung process was terminated with `SIGTERM` after evidence collection.

## Root-cause boundary

Confirmed:

- Reload is blocked by an unresolved second `import("@ff-labs/fff-bun")`.
- The behavior reproduces without finder creation or database access.
- FFF's shutdown handler completes before the stall.
- Removing `@ff-labs/pi-fff` makes reload succeed.

Not yet proven:

- Whether the underlying defect belongs to Bun's native-module import cache, Pi/jiti's extension cache invalidation, the FFF Bun package's module initialization, or an interaction among them.
- Whether the same behavior occurs in Node-hosted Pi with `@ff-labs/fff-node`.
- Whether other Bun native packages exhibit the same second-import failure.

The narrowest accurate description is: Pi extension reload plus a repeated dynamic import of `@ff-labs/fff-bun` leaves the second import promise unresolved.

## Workarounds

Until fixed:

1. Do not use `/reload` while `npm:@ff-labs/pi-fff` is enabled.
2. Restart Pi instead of reloading.
3. Temporarily remove `npm:@ff-labs/pi-fff` from `settings.json` when reload is required.

Once Pi is already stuck, graceful `SIGTERM` works.

## Candidate fixes

### FFF package containment

Make the SDK import cache survive extension module replacement. A process-global cache keyed with `Symbol.for(...)` could retain the first resolved import promise across reloads instead of issuing a second dynamic import.

Any implementation should:

- cache per runtime/package choice (`fff-bun` versus `fff-node`);
- clear rejected promises so a transient startup failure can retry;
- avoid retaining destroyed `FileFinder` instances globally;
- test startup, reload, second reload, and quit.

This is a targeted containment for the observed package even if the deeper Bun/loader interaction remains.

### Pi reload resilience

Pi could improve containment and diagnostics for extension lifecycle promises that do not settle:

- identify the extension and event currently being awaited;
- show a slow-handler warning during reload;
- optionally apply a documented lifecycle timeout or allow cancellation;
- restore a usable editor with an error instead of leaving the reload screen indefinitely.

A hard timeout changes lifecycle semantics and should not silently abandon cleanup or initialization. Diagnostics without forced cancellation would still make this failure much easier to identify.

### Regression coverage

Useful coverage would include:

1. A Pi interactive reload test whose extension awaits a dynamic import during `session_start`.
2. An FFF package test that loads, shuts down, reloads the extension module, and loads `@ff-labs/fff-bun` again in the same Bun process.
3. A second `/reload` to verify repeated reloads, not only one transition.
4. Verification that the reload completion message appears and the editor regains focus.

## Recommended ownership

The minimal reproducer should first be reported to FFF with the exact package versions and trace. A reduced Bun-only reproduction outside Pi would determine whether this is directly actionable in FFF/Bun. Independently, Pi can add slow lifecycle-handler diagnostics so one extension cannot create an opaque reload hang.
