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

`binary` assembles only the current host's standalone distribution directory. It skips the release `.tar.gz` or `.zip` archive because `install` copies directly from the assembled directory. Other callers of `scripts/build-binaries.sh` still create archives unless they pass `--skip-archives`.

`extensions` treats its package list as the complete global Pi package set. It first installs every listed package, then removes every other entry from `PI_CODING_AGENT_DIR/settings.json` through `pi remove`. Project-local packages and manually placed files under `extensions/` are not managed.

`workspace` retains original destructive cleanup behavior: `git clean -fxd` removes untracked and ignored repository files. The `raymond-w-ko/` script directory is excluded from cleanup.
