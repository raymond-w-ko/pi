# Local Pi build script

`main.js` contains Raymond W. Ko's local build and install workflow. `make.sh` runs every stage:

```bash
./make.sh
```

Pass one major stage as first argument:

```bash
./make.sh workspace
./make.sh binary
./make.sh extensions
./make.sh config
./make.sh install
```

Use `./make.sh --help` for stage descriptions. Stages run from repository root regardless of caller's current directory. Later stages expect outputs from earlier stages; `all` supplies correct order.

## Package managers and executable build

Install `pnpm`, Node.js 22.19 or newer, and Bun on `PATH` before running the workflow. The repository currently declares pnpm 11.15.1; the migration tests also exercise the pnpm available on `PATH`.

`workspace` uses pnpm rather than npm:

- It generates a temporary root `pnpm-workspace.yaml` in block style from the upstream workspace list and dependency overrides. Block style allows pnpm to edit the configuration without rejecting multiline JSON collections. An existing, different configuration is rejected rather than overwritten. The temporary file is removed even when installation or building fails.
- It imports the upstream `package-lock.json` on every run. The active pnpm lockfile stays at repository root during installation and building. With hoisted installs, pnpm also uses `lockfileDir` as the dependency root; keeping it at repository root puts development tools such as `tsc` in root `node_modules/.bin` and assets in the paths expected by the binary assembler. Importing can require registry access.
- After the workspace stage, including when it fails, it archives the generated lockfile under `raymond-w-ko/.pnpm/`. It then restores any pre-existing root `pnpm-lock.yaml`, or removes the temporary root lockfile if none existed. The upstream lockfile and package manifests remain unchanged.
- It installs with `pnpm install --ignore-scripts --frozen-lockfile` and persists `ignoreScripts: true` in the workspace configuration. Dependency lifecycle scripts and the repository's `prepare` hook do not run.
- It sets `verifyDepsBeforeRun: false` to prevent automatic reinstalls before scripts. The explicit install already verifies the lockfile and stops the workflow on failure.
- It links local workspace packages and uses a hoisted `node_modules` layout because the binary assembler reads assets from root dependency paths.
- It builds with `pnpm run build`. During this build only, `bin/npm` routes upstream nested `npm run` calls to `pnpm run`. The adapter rejects other npm commands. Upstream scripts remain unchanged.

`extensions` sets `npmCommand` to `["pnpm", "--config.ignore-scripts=true"]` in the agent settings **before** installing, removing, or updating packages. The `config` stage applies the same setting. This persists for subsequent Pi package operations. Package sources still use the `npm:` registry prefix, and installed extensions remain under the existing `agent/npm` directory; neither name selects the package manager. Extensions that require lifecycle scripts need separate, explicitly approved setup.

The `binary` stage still calls `scripts/build-binaries.sh` with dependency installation and package building disabled. That script uses `bun build --compile` with `dist/bun/cli.js` and both worker entrypoints. Bun, not pnpm or Node.js, produces the final standalone executable at `packages/coding-agent/binaries/<host>/pi` (`pi.exe` on Windows). The `install` stage copies that executable and its runtime assets to `~/pi`.

Run the migration regression tests without cleaning or rebuilding your checkout:

```bash
node --test raymond-w-ko/pnpm.test.js
```

The tests install an isolated local workspace and run a development-tool executable through nested package scripts with both the repository's pnpm and the pnpm on `PATH`. They check root binary availability, lifecycle-script blocking, absence of automatic reinstalls, and lockfile archiving and restoration after success and failure.

`binary` assembles only the current host's standalone distribution directory. It skips the release `.tar.gz` or `.zip` archive because `install` copies directly from the assembled directory. Other callers of `scripts/build-binaries.sh` still create archives unless they pass `--skip-archives`.

`extensions` treats its package list as the complete global Pi package set. It first installs every listed package, then removes every other entry from `PI_CODING_AGENT_DIR/settings.json` through `pi remove`. Project-local packages and manually placed files under `extensions/` are not managed.

`workspace` retains original destructive cleanup behavior: `git clean -fxd` removes untracked and ignored repository files. The `raymond-w-ko/` script directory and root `pnpm-workspace.yaml` and `pnpm-lock.yaml` files are excluded from cleanup. The workspace stage manages its temporary files and preserves any pre-existing files.
