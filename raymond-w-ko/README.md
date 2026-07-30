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

`workspace` retains original destructive cleanup behavior: `git clean -fxd` removes untracked and ignored repository files. The `raymond-w-ko/` script directory is excluded from cleanup.
