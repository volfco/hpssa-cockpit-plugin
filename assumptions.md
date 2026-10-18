# Assumptions

Provided / inferred / assumed constraints for this project:

- Host root@203.0.113.2 runs ssacli 6.60.8.0 (SOULAPI 6.60.8.0); help text captured there is the reference syntax surface for wrapper generation.
- Live validation is limited to read-only commands plus agreed safe mutations (rescan, LED identify); destructive wrappers are syntax-verified against help docs only, never mutation-tested.
- Plugin targets Cockpit ≥137 (manifest.json), PatternFly v6 (no `--pf-v6-global--*` compat vars shipped by installed @patternfly/patternfly; tokens are `--pf-t--global--*`).
- The plugin runs inside Cockpit’s shell and must not reserve another sidebar. src/app.scss explicitly imports pkg/lib/page.scss; raw PF table markup and utility classes require explicit style imports (React imports only bring component styles).
- @patternfly/react-table is not an approved dependency; tables remain structured markup until it is added deliberately.
- The raw-command dialog (toolbar → Run command…) is the accepted coverage path for the long tail of ssacli operations; see todo.md for the deliberate exclusions list.
- Release publishing target is GitHub Releases (user choice, D8): every run uploads workflow artifacts, tag pushes also attach .deb/.rpm; no COPR/apt repo.
- Tags are `v`-prefixed or bare (`v1.2.3` / `1.2.3`); packages carry the bare version with `-1` release (`make print-version` strips the `v`).
- package-lock.json stays gitignored (Makefile regenerates it), so CI resolves dependencies fresh: package.json must stay peer-dep consistent — a bad bump breaks CI even when a stale local node_modules still works (D9/D10).
- rpm/deb must be installable with distro-packaged `cockpit-bridge` only; floor stays `cockpit-bridge >= 137` per the manifest assumption above.

- UI validation uses isolated mocked hardware at 1440, 1024, 768, and 390px widths; no storage mutations are performed. The browser check requires Firefox WebDriver BiDi and Node >=22; production runtime requirements are unchanged.
