# hpssa (ssacli) → plugin coverage matrix

Verified against ssacli 6.60.8.0 on root@203.0.113.2 (`ssacli help*`).
"UI" = where the wrapper is exposed; "raw" = reachable via the Run-command
dialog (toolbar → *Run command…*, accepts any `ssacli` cmdline).

## Targets

| hpssa target | Covered |
|---|---|
| `controller all / slot=#` | yes |
| `controller serialnumber=#`, `ch=` | yes for show/detail (`showControllerDetailBySerial`, helpers `ctrlSnTarget`/`ctrlChTarget`); other ops raw only |
| `array all / <id>` | yes |
| `physicaldrive …` (port:id, box:bay, port:box:bay, ranges) | yes |
| `ssdphysicaldrive` | yes — Show SSD drives (wrapper `showSsdDrives`); erase/LED reuses PD wrappers |
| `logicaldrive all/#` | yes |
| `enclosure …` | yes |
| `licensekey all/<key>` | yes |
| SEP / backplane targets | yes — Show SEP devices / Show backplanes (controller ⋮ → Diagnostics); SEP flash + configurationmode, backplane flash via wrappers |

## Show / discovery

| Command | Wrapper | UI |
|---|---|---|
| `ctrl all show` / config / detail | fetchOverview → parseControllerList etc. | Dashboard/controller pages |
| `ctrl all show status` | showStatusAll | wrapper only |
| `ctrl show outofband` | showOutOfBand | controller ⋮ → Diagnostics |
| `ctrl show manufacturingdata` | showManufacturingData | controller ⋮ → Diagnostics |
| `ctrl show certificate` / `eula` | showCertificate / showEula | controller ⋮ → Diagnostics |
| `show debugtoken` | showDebugToken | controller ⋮ → Diagnostics |
| `ssdinfo`, `tapedrive all show` | showSsdInfo / showTapeDrives | controller ⋮ → Diagnostics |
| `<target> diag file=… [logs=] [ssdrpt=]` | diagController | controller ⋮ → Generate diagnostics… |
| `show erasepattern=…` (PD query) | raw | — |

## Controller commands & modify=

| Capability | Wrapper | UI |
|---|---|---|
| rescan (all / per-ctrl) | rescanAll / rescanController | toolbar + controller header |
| cacheratio | setCacheRatio | Settings → Cache |
| rebuildpriority / expandpriority | setRebuildPriority / setExpandPriority | Settings |
| surfacescanmode/delay, parallelsurfacescancount, surfaceanalysiseventnotify | setSurfaceScanMode / setSurfaceScanDelay / setParallelSurfaceScanCount / setSurfaceAnalysisEventNotify | Settings |
| queuedepth | setQueueDepth | Settings |
| drivewritecache (+usage) | setDriveWriteCache | Settings |
| degradedperformanceoptimization, elevatorsort, inconsistencyrepairpolicy | setters | Settings |
| nobatterywritecache, writecachebypassthreshold, waitforcacheroom | setters | Settings |
| raid1writebuffering | setRaid1WriteBuffering | Settings |
| bootcontroller, bootvolume | setBootController / setBootVolume | actions / Settings |
| postprompttimeout, mnpdelay | setPostPromptTimeout / setMnpDelay | Settings |
| powermode, survivalmode | setters | Settings |
| discoveryprotocol (+numberoftargets) | setDiscoveryProtocol | Settings |
| sanitizelock | setSanitizeLock | Settings |
| persistentpolicychange, uefihealthreporting | setters | Settings |
| hbamode / raidmode | setHbaMode / setRaidMode | Settings → Mode & ports |
| portmode | setPortMode | Settings → Mode & ports |
| spareactivationmode | setSpareActivationMode | Settings → Advanced |
| latency scheduler | setLatencyScheduler | Settings → Advanced |
| maxreadrequestsize | setMaxReadRequestSize | Settings → Advanced |
| drivernotify | setDriverNotify | Settings → Advanced |
| i2caddress | setI2cAddress | wrapper only (rare) |
| clearnvram=nvram\|logs\|all | clearNvram | controller ⋮ → Danger |
| clearconfigdata (ctrl/pd) | clearConfigData | controller ⋮ → Danger |
| reset resettype=… | resetController | controller ⋮ → Danger |
| delete [forced] [override] | deleteController | controller ⋮ → Danger |
| led=on/off duration= | setControllerLed | controller ⋮ → Identify |
| flash file=… (ctrl/pd) | flashControllerFirmware / flashDriveFirmware | controller ⋮ → Danger (controller); PD flash via raw |
| SEP configurationmode | setSepConfigurationMode | wrapper only (rare) |
| backplane flash | flashBackplaneFirmware | wrapper only (controller ⋮ has controller/SEP firmware UI) |

## Array operations

| Capability | Wrapper | UI |
|---|---|---|
| create type=ld/ldcache/arrayr0/bootarray (+drives, raid, size, stripsize, sectors, caching, arrayaccelerator, drivetype, numberparitygroups, parityinitializationmethod, ssdiobypass, datald, writepolicy, cachelinesize, plaintextvolume, user/password, ssdoverprovisioningoptimization, volatileencryptionkeys, logicaldrivelabel, sedencryption, forced) | createLogicalDrive | array ⋮ → Create logical drive… (common subset of fields; full param set via raw) |
| add drives= (expand, modifyparitygroups, forced) | arrayAddDrives | array ⋮ |
| add spares= (+sparetype) | arrayAddSpares | array ⋮ |
| remove drives=/spares= | arrayRemoveDrives / arrayRemoveSpares | array ⋮ |
| replace drives | arrayReplaceDrives | array ⋮ |
| heal drives= | arrayHeal | array ⋮ |
| consolidatespace | arrayConsolidateSpace | array ⋮ |
| ssdsmartpath / ssdiobypass | setters | array ⋮ |
| led | arrayLed | array ⋮ |
| delete [forced] | arrayDelete | array ⋮ → Danger |
| sparetype modify | via add/remove sparetype | — |

## Logical drive operations

| Capability | Wrapper | UI |
|---|---|---|
| caching, arrayaccelerator | ldSetCaching / ldSetArrayAccelerator | LD ⋮ |
| logicaldrivelabel | ldSetLabel | LD ⋮ |
| led | ldSetLed | LD ⋮ |
| modify size= (extend) | ldResize | LD ⋮ |
| migrate raid/stripsize | ldMigrate | LD ⋮ |
| newarray= / drives= (move) | ldMoveToArray / ldMoveToNewArray | LD ⋮ |
| reenable | ldReenable | LD ⋮ |
| writepolicy | ldSetWritePolicy | LD ⋮ |
| instantsecureerase | encInstantSecureErase | raw (wrapper exists) |
| rekey | encRekeyLd | raw (wrapper exists) |
| volatileencryptionkeyaction | encVolatileKeyAction | wrapper only |
| delete [forced] [override] | ldDelete | LD ⋮ → Danger |

## Physical drive operations

| Capability | Wrapper | UI |
|---|---|---|
| led | pdSetLed | PD row ⋮ |
| erase erasepattern= (+unrestricted) | pdErase | PD row ⋮ |
| stoperase | pdStopErase | PD row ⋮ |
| enableeraseddrive | pdEnableErasedDrive | PD row ⋮ |
| disablepd | pdDisable | PD row ⋮ → Danger |
| sedreverttoofswithpsid | sedRevertToOfsWithPsid | wrapper only |
| flash (mode/transfersize) | flashDriveFirmware | wrapper only |

## License keys

add / delete / show → addLicenseKey / deleteLicenseKey / showLicenseKeys —
add+show in controller ⋮; delete via raw.

## Encryption & SED

| Capability | Wrapper | UI |
|---|---|---|
| enableencryption | encEnable | raw (wrapper exists) |
| encryption on/off | encDisable / ctrlModify | raw |
| login / logout | encLogin / encLogout | controller ⋮ → Encryption |
| setpasswd | encSetPassword | wrapper only |
| setmasterkey | encSetMasterKey | wrapper only |
| clearencryptionconfig | encClearConfig | wrapper only |
| removectrlpasswd | encRemoveCtrlPassword | controller ⋮ → Encryption |
| ctrlpasswdstate suspend/resume | encCtrlPasswordState | wrapper only |
| keymanagerauthentication | encKeyManagerAuthentication | wrapper only |
| unlockvolumes | encUnlockVolumes | controller ⋮ → Encryption |
| rescankeys | encRescanKeys | controller ⋮ → Encryption |
| import masterkey= | encImportMasterKey | wrapper only |
| encode preservedata= | encEncode | LD ⋮ → Encryption → Encode volume… |
| recoverpassword | encRecoverPassword | wrapper only |
| setrecoveryparams | encSetRecoveryParams | wrapper only |
| setmasterkeycache | encSetMasterKeyCache | wrapper only |
| fwlock | encFwLock | wrapper only |
| rekey (ctrl/ld) | encRekeyController / encRekeyLd | wrappers |
| SED: set/unlock/delete controller password, takeownership, reverttoofs | sed* wrappers | wrappers |
| sedrefresh | sedRefresh | controller ⋮ → Encryption |
| security show (SPDM) | securityShow | wrapper only |

## Deliberately not wrapped

See `todo.md`. Everything listed there remains reachable through the raw
command dialog.
