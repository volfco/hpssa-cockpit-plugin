# Assumptions

Provided / inferred / assumed constraints for this project:

- Host root@203.0.113.2 runs ssacli 6.60.8.0 (SOULAPI 6.60.8.0); help text captured there is the reference syntax surface for wrapper generation.
- Live validation is limited to read-only commands plus agreed safe mutations (rescan, LED identify); destructive wrappers are syntax-verified against help docs only, never mutation-tested.
- Plugin targets Cockpit ≥137 (manifest.json), PatternFly v6 (no `--pf-v6-global--*` compat vars shipped by installed @patternfly/patternfly; tokens are `--pf-t--global--*`).
- `@use "page.scss"` in src/app.scss intentionally resolves to node_modules/@patternfly/patternfly/components/Page/page.scss via esbuild sass loadPaths (starter-kit pattern).
- @patternfly/react-table is not an approved dependency; tables remain structured markup until it is added deliberately.
- The raw-command dialog (toolbar → Run command…) is the accepted coverage path for the long tail of ssacli operations; see todo.md for the deliberate exclusions list.
