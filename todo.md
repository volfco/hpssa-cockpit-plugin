# TODO

- [ ] Encryption tail without dedicated dialogs (wrappers exist in `src/service.ts`): setpasswd, setmasterkey, clearencryptionconfig, ctrlpasswdstate, keymanagerauthentication, volatileencryptionkeyaction, import masterkey, recoverpassword/setrecoveryparams, setmasterkeycache, fwlock, instantsecureerase, rekey UI entry points. Ref: docs/hpssa-coverage.md.
- [ ] Drive firmware update UI (flashDriveFirmware has no PD-row menu item yet). Ref: src/components/actions.tsx pdActions.
- [ ] i2caddress UI row skipped deliberately (rare); wrapper `setI2cAddress` is service-only.
- [ ] Full create-LD parameter coverage in the Create dialog (datalld/cache fields, sectors, numberparitygroups, plaintextvolume, crypto user/password, etc.) — common subset exposed today.
- [ ] drivewritecache=unchanged should be constrained to usage=configured in the dialog (helper text added; visibility rule pending). Ref: src/components/actions.tsx setDriveWriteCache def.
- [ ] Encryption wrappers without UI entry points (see first TODO item) — same list; wrappers verified against help docs but not mutation-tested.

## Done

- [x] SEP/backplane targets: show + flash + configurationmode wrappers; Show SEP devices / Show backplanes / Update SEP firmware… UI. Ref: src/service.ts, src/components/actions.tsx.
- [x] Targeting by serialnumber= (`ctrlSnTarget`, `showControllerDetailBySerial`, `showEnclosureBySerial`) and ssdphysicaldrive (`showSsdDrives`); ch= helper `ctrlChTarget`; remaining ops stay on the raw command dialog. Ref: src/service.ts.
- [x] encode preservedata= → `encEncode` + LD ⋮ → Encryption → Encode volume…. Ref: src/components/actions.tsx ldActions.
- [ ] Repo setting (manual, not code): enable Settings → Actions → General → "Allow GitHub Actions to create and approve pull requests" so cockpit-lib-update can open its PRs. Interim: branch cockpit-lib-20260820-025151 is pushed and can be merged manually.
