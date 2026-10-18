# TODO

- [ ] Encryption tail without dedicated dialogs (wrappers exist in `src/service.ts`): setpasswd, setmasterkey, clearencryptionconfig, ctrlpasswdstate, keymanagerauthentication, volatileencryptionkeyaction, import masterkey, recoverpassword/setrecoveryparams, setmasterkeycache, fwlock, instantsecureerase, rekey UI entry points. Ref: docs/hpssa-coverage.md.
- [ ] Drive firmware update UI (flashDriveFirmware has no PD-row menu item yet). Ref: src/components/actions.tsx pdActions.
- [ ] i2caddress UI row skipped deliberately (rare); wrapper `setI2cAddress` is service-only.
- [ ] Full create-LD parameter coverage in the Create dialog (datalld/cache fields, sectors, numberparitygroups, plaintextvolume, crypto user/password, etc.) — common subset exposed today.
- [ ] drivewritecache=unchanged should be constrained to usage=configured in the dialog (helper text added; visibility rule pending). Ref: src/components/actions.tsx setDriveWriteCache def.
- [ ] Encryption wrappers without UI entry points (see first TODO item) — same list; wrappers verified against help docs but not mutation-tested.
- [ ] Repo setting (manual, not code): enable Settings → Actions → General → "Allow GitHub Actions to create and approve pull requests" so cockpit-lib-update can open its PRs. Interim: branch cockpit-lib-20260820-025151 is pushed and can be merged manually.
- [ ] `package.json` `repository` still points at `cockpit/starter-kit.git` (template leftover; not shipped in packages). Ref: package.json.
- [ ] Commit `package-lock.json` instead of regenerating it per build (would pin CI deps; today a fresh `npm install` picks latest allowed versions — e.g. CI resolves sass 1.105.2 while local has 1.99.0). Ref: D9/D10, assumptions.md.
- [ ] Refresh `pkg/lib` (`COCKPIT_REPO_STAMP` pin) and the `@patternfly` group together when cockpit moves on; note dependabot's group bump to 6.5.0 was the only PF release with the broken `dist/` sass layout (6.6.1/6.7.0 are fine). Ref: decisions.md D9.
- [ ] spec `Source0`/`Source1` URLs point at `releases/download/%{version}/…` but releases are tagged `v…` and only .deb/.rpm assets are attached, so they 404 either way (inert for `make rpm`, which uses `_sourcedir`). Either attach the tarballs and use the `v` tag, or drop the URLs. Ref: review of D8.
- [ ] `packaging/arch/PKGBUILD.in`: `arch=('x86_64')` should be `any` (package is noarch) and `license=(LGPL)` isn't SPDX (`LGPL-2.1-or-later`); Arch build not covered by CI. Ref: review of D8.

## Done

- [x] Repair PF6 page/sidebar sizing, load raw table/grid and utility styles, and polish dashboard, controller tabs, settings, dialogs, menus, and command log. Mocked Firefox checks cover desktop/mobile layouts and interactions. Ref: decisions.md D14/D15, test/ui-check.mjs.

- [x] SEP/backplane targets: show + flash + configurationmode wrappers; Show SEP devices / Show backplanes / Update SEP firmware… UI. Ref: src/service.ts, src/components/actions.tsx.
- [x] Targeting by serialnumber= (`ctrlSnTarget`, `showControllerDetailBySerial`, `showEnclosureBySerial`) and ssdphysicaldrive (`showSsdDrives`); ch= helper `ctrlChTarget`; remaining ops stay on the raw command dialog. Ref: src/service.ts.
- [x] encode preservedata= → `encEncode` + LD ⋮ → Encryption → Encode volume…. Ref: src/components/actions.tsx ldActions.
- [ ] cockpit.spawn has no timeout/cancel: with Escape blocked during a run, a hung ssacli leaves its modal open indefinitely (buttons disabled). Add a spawn timeout + cancel affordance if this is ever observed in the field. Ref: decisions.md D16.
