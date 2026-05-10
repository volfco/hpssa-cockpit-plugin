import React from 'react';
import { Dropdown, DropdownItem, DropdownList, DropdownGroup } from "@patternfly/react-core/dist/esm/components/Dropdown/index.js";
import { MenuToggle } from "@patternfly/react-core/dist/esm/components/MenuToggle/index.js";
import EllipsisVIcon from "@patternfly/react-icons/dist/esm/icons/ellipsis-v-icon.js";
import cockpit from 'cockpit';

import { FormDialog, ConfirmDialog, OutputDialog, type FieldDef, type FormValues } from './dialogs';
import { type SettingDef, readProp } from './settingsPage';
import * as svc from '../service';
import type { Controller, LogicalDrive, PhysicalDrive } from '../types';

const _ = cockpit.gettext;

// Helper: omit undefined values so we can spread without violating
// exactOptionalPropertyTypes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function defined(obj: Record<string, unknown>): any {
    const out: Record<string, unknown> = {};
    for (const k in obj) if (obj[k] !== undefined) out[k] = obj[k];
    return out;
}

// ---------------------------------------------------------------------------
// Generic kebab dropdown driving a list of declarative action items.
// Each item is either an action handler or opens a dialog.
// ---------------------------------------------------------------------------

export interface ActionItem {
    id: string;
    label: string;
    description?: string;
    isDanger?: boolean;
    group?: string;
    onSelect: () => void;
}

interface ActionMenuProps {
    items: ActionItem[];
    label?: string;
}

export function ActionMenu({ items, label = _("Actions") }: ActionMenuProps) {
    const [open, setOpen] = React.useState(false);

    const groups = new Map<string, ActionItem[]>();
    for (const it of items) {
        const g = it.group ?? '';
        if (!groups.has(g)) groups.set(g, []);
        groups.get(g)!.push(it);
    }

    return (
        <Dropdown
            isOpen={open}
            onSelect={() => setOpen(false)}
            onOpenChange={setOpen}
            popperProps={{ position: 'right' }}
            toggle={(toggleRef) => (
                <MenuToggle
                    ref={toggleRef}
                    aria-label={label}
                    variant="plain"
                    onClick={() => setOpen(o => !o)}
                    isExpanded={open}
                    icon={<EllipsisVIcon />}
                />
            )}
        >
            {[...groups.entries()].map(([group, groupItems], idx) => (
                <DropdownGroup key={idx} {...defined({ label: group || undefined })}>
                    <DropdownList>
                        {groupItems.map(it => (
                            <DropdownItem
                                key={it.id}
                                onClick={() => { setOpen(false); it.onSelect() }}
                                {...defined({ description: it.description, isDanger: it.isDanger })}
                            >
                                {it.label}
                            </DropdownItem>
                        ))}
                    </DropdownList>
                </DropdownGroup>
            ))}
        </Dropdown>
    );
}

// ---------------------------------------------------------------------------
// Dialog state management — small reducer to track which dialog is open.
// ---------------------------------------------------------------------------

interface FormDialogDef {
    title: string;
    description?: string;
    fields: FieldDef[];
    submitLabel?: string;
    submitVariant?: 'primary' | 'danger' | 'warning';
    onSubmit: (values: FormValues) => Promise<string>;
}

interface ConfirmDef {
    title: string;
    body: React.ReactNode;
    confirmLabel?: string;
    confirmVariant?: 'primary' | 'danger' | 'warning';
    requireTyped?: string;
    onConfirm: () => Promise<string>;
}

type DialogState =
    | { kind: 'none' }
    | { kind: 'form'; def: FormDialogDef }
    | { kind: 'confirm'; def: ConfirmDef }
    | { kind: 'output'; title: string; fetch: () => Promise<string> };

export function useDialogs(onChanged?: () => void) {
    const [state, setState] = React.useState<DialogState>({ kind: 'none' });
    const close = () => setState({ kind: 'none' });
    const refresh = () => onChanged?.();

    const openForm = (def: FormDialogDef) => setState({ kind: 'form', def });
    const openConfirm = (def: ConfirmDef) => setState({ kind: 'confirm', def });
    const openOutput = (title: string, fetch: () => Promise<string>) =>
        setState({ kind: 'output', title, fetch });

    const node = (
        <>
            {state.kind === 'form' && (
                <FormDialog
                    isOpen
                    onClose={close}
                    title={state.def.title}
                    fields={state.def.fields}
                    // eslint-disable-next-line react/jsx-handler-names
                    onSubmit={state.def.onSubmit}
                    onSuccess={refresh}
                    {...defined({
                        description: state.def.description,
                        submitLabel: state.def.submitLabel,
                        submitVariant: state.def.submitVariant,
                    })}
                />
            )}
            {state.kind === 'confirm' && (
                <ConfirmDialog
                    isOpen
                    onClose={close}
                    title={state.def.title}
                    body={state.def.body}
                    // eslint-disable-next-line react/jsx-handler-names
                    onConfirm={state.def.onConfirm}
                    onSuccess={refresh}
                    {...defined({
                        confirmLabel: state.def.confirmLabel,
                        confirmVariant: state.def.confirmVariant,
                        requireTyped: state.def.requireTyped,
                    })}
                />
            )}
            {state.kind === 'output' && (
                <OutputDialog isOpen onClose={close} title={state.title} fetch={state.fetch} />
            )}
        </>
    );

    return { node, openForm, openConfirm, openOutput, close };
}

// ---------------------------------------------------------------------------
// Controller settings — every documented modify= setting, rendered as rows on
// the Settings page (label, description, current value, Edit button).
// ---------------------------------------------------------------------------

export function controllerSettingDefs(controller: Controller): SettingDef[] {
    const slot = controller.slot;
    const G_CACHE = _("Cache & performance");
    const G_REBUILD = _("Rebuild & surface scan");
    const G_POWER = _("Power & boot");

    return [
        // ---- Cache & performance ----
        {
            key: 'cacheratio',
            group: G_CACHE,
            label: _("Cache ratio"),
            description: _("Read/write split for the controller cache. Format is read/write percent, e.g. 25/75."),
            currentValue: p => readProp(p, 'Accelerator Ratio', 'Cache Ratio'),
            fields: [{ key: 'cacheratio', label: _("Cache ratio"), type: 'text', required: true, placeholder: '25/75' }],
            onSave: v => svc.setCacheRatio(slot, String(v.cacheratio)),
        },
        {
            key: 'drivewritecache',
            group: G_CACHE,
            label: _("Drive write cache"),
            description: _("Controls whether physical drives may use their own write cache. \"Unchanged\" preserves each drive's existing setting."),
            currentValue: p => readProp(p, 'Drive Write Cache', 'Physical Drive Write Cache Policy'),
            fields: [
                {
                    key: 'drivewritecache',
                    label: _("Mode"),
                    type: 'select',
                    required: true,
                    options: [
                        { value: 'enable', label: _("Enable") },
                        { value: 'disable', label: _("Disable") },
                        { value: 'unchanged', label: _("Unchanged") },
                        { value: 'default', label: _("Default") },
                    ],
                },
                {
                    key: 'usage',
                    label: _("Usage"),
                    type: 'select',
                    options: [
                        { value: 'configured', label: _("Configured") },
                        { value: 'unconfigured', label: _("Unconfigured") },
                        { value: 'hba', label: _("HBA") },
                    ],
                },
            ],
            onSave: v => svc.setDriveWriteCache(slot, v.drivewritecache as 'enable', v.usage as 'configured'),
        },
        {
            key: 'nobatterywritecache',
            group: G_CACHE,
            label: _("No-battery write cache"),
            description: _("Allow write caching when no/uncharged backup power source is present. WARNING: risk of data loss on power failure."),
            currentValue: p => readProp(p, 'No-Battery Write Cache'),
            fields: [{
                key: 'mode',
                label: _("Mode"),
                type: 'select',
                required: true,
                options: [
                    { value: 'enable', label: _("Enable") },
                    { value: 'disable', label: _("Disable") },
                    { value: 'default', label: _("Default") },
                ],
            }],
            onSave: v => svc.setNoBatteryWriteCache(slot, v.mode as 'enable'),
        },
        {
            key: 'wcbt',
            group: G_CACHE,
            label: _("Write-cache bypass threshold"),
            description: _("Large writes above this size bypass the controller cache. Multiple of 16, range 16–1040 KiB, or 'default'."),
            currentValue: p => readProp(p, 'Write Cache Bypass Threshold Size', 'Write Cache Bypass Threshold'),
            fields: [{ key: 'kib', label: _("Threshold"), type: 'text', required: true, placeholder: '256 or default' }],
            onSave: v => svc.setWriteCacheBypassThreshold(slot, String(v.kib) === 'default' ? 'default' : Number(v.kib)),
        },
        {
            key: 'waitforcacheroom',
            group: G_CACHE,
            label: _("Wait for cache room"),
            description: _("Always wait for cache room when full instead of bypassing. Prevents RAID 1 inconsistencies but may reduce performance."),
            currentValue: p => readProp(p, 'Wait for Cache Room'),
            fields: [{ key: 'on', label: _("Enabled"), type: 'switch' }],
            onSave: v => svc.setWaitForCacheRoom(slot, Boolean(v.on)),
        },
        {
            key: 'queuedepth',
            group: G_CACHE,
            label: _("Queue depth"),
            description: _("Outstanding I/O depth presented to physical drives. \"automatic\" lets the controller decide."),
            currentValue: p => readProp(p, 'Queue Depth'),
            fields: [{
                key: 'depth',
                label: _("Depth"),
                type: 'select',
                required: true,
                options: [
                    { value: 'automatic', label: 'automatic' },
                    ...['32', '16', '8', '4', '2'].map(v => ({ value: v, label: v })),
                ],
            }],
            onSave: v => svc.setQueueDepth(slot, v.depth as 'automatic'),
        },
        {
            key: 'dpo',
            group: G_CACHE,
            label: _("Degraded performance optimization"),
            description: _("Optimize performance on RAID arrays operating in a degraded state."),
            currentValue: p => readProp(p, 'Degraded Performance Optimization'),
            fields: [{ key: 'on', label: _("Enabled"), type: 'switch' }],
            onSave: v => svc.setDegradedPerformanceOptimization(slot, Boolean(v.on)),
        },
        {
            key: 'elevatorsort',
            group: G_CACHE,
            label: _("Elevator sort"),
            description: _("Re-order I/O requests by LBA to reduce drive seek time."),
            currentValue: p => readProp(p, 'Elevator Sort'),
            fields: [{ key: 'on', label: _("Enabled"), type: 'switch' }],
            onSave: v => svc.setElevatorSort(slot, Boolean(v.on)),
        },
        {
            key: 'irp',
            group: G_CACHE,
            label: _("Inconsistency repair policy"),
            description: _("Automatically repair detected RAID inconsistencies during surface scans."),
            currentValue: p => readProp(p, 'Inconsistency Repair Policy'),
            fields: [{ key: 'on', label: _("Enabled"), type: 'switch' }],
            onSave: v => svc.setInconsistencyRepairPolicy(slot, Boolean(v.on)),
        },
        {
            key: 'r1wb',
            group: G_CACHE,
            label: _("RAID 1 write buffering"),
            description: _("Buffer RAID 1 writes to prevent inconsistencies caused by host buffer changes mid-write."),
            currentValue: p => readProp(p, 'RAID 1 Write Buffering'),
            fields: [{ key: 'on', label: _("Enabled"), type: 'switch' }],
            onSave: v => svc.setRaid1WriteBuffering(slot, Boolean(v.on)),
        },

        // ---- Rebuild & surface scan ----
        {
            key: 'rebuildpriority',
            group: G_REBUILD,
            label: _("Rebuild priority"),
            description: _("How aggressively the controller rebuilds a failed drive vs. servicing host I/O."),
            currentValue: p => readProp(p, 'Rebuild Priority'),
            fields: [{
                key: 'level',
                label: _("Priority"),
                type: 'select',
                required: true,
                options: ['high', 'medium', 'low', 'mediumhigh'].map(v => ({ value: v, label: v })),
            }],
            onSave: v => svc.setRebuildPriority(slot, v.level as 'high'),
        },
        {
            key: 'expandpriority',
            group: G_REBUILD,
            label: _("Expand priority"),
            description: _("How aggressively the controller expands an array vs. servicing host I/O."),
            currentValue: p => readProp(p, 'Expand Priority'),
            fields: [{
                key: 'level',
                label: _("Priority"),
                type: 'select',
                required: true,
                options: ['high', 'medium', 'low'].map(v => ({ value: v, label: v })),
            }],
            onSave: v => svc.setExpandPriority(slot, v.level as 'high'),
        },
        {
            key: 'surfacescanmode',
            group: G_REBUILD,
            label: _("Surface scan mode"),
            description: _("Background media-error scan. \"idle\" only scans when the controller is idle for the configured delay."),
            currentValue: p => readProp(p, 'Surface Scan Mode'),
            fields: [
                {
                    key: 'mode',
                    label: _("Mode"),
                    type: 'select',
                    required: true,
                    options: ['disable', 'idle', 'high'].map(v => ({ value: v, label: v })),
                },
                {
                    key: 'delay',
                    label: _("Idle delay (s)"),
                    type: 'number',
                    helper: _("0 disables. Used when mode=idle."),
                    visible: vs => vs.mode === 'idle',
                },
            ],
            onSave: v => svc.setSurfaceScanMode(slot, v.mode as 'idle', v.delay as number | undefined),
        },
        {
            key: 'pssc',
            group: G_REBUILD,
            label: _("Parallel surface scan count"),
            description: _("Number of physical drives that can be scanned in parallel. 1 disables parallelism."),
            currentValue: p => readProp(p, 'Parallel Surface Scan Count', 'Parallel Surface Scan Supported'),
            fields: [{ key: 'count', label: _("Count"), type: 'number', required: true }],
            onSave: v => svc.setParallelSurfaceScanCount(slot, v.count as number),
        },
        {
            key: 'saen',
            group: G_REBUILD,
            label: _("Surface analysis event notify"),
            description: _("Generate event notifications and serial debug messages for inconsistencies on mirrored volumes."),
            currentValue: p => readProp(p, 'Surface Analysis Inconsistency Notification'),
            fields: [{ key: 'on', label: _("Enabled"), type: 'switch' }],
            onSave: v => svc.setSurfaceAnalysisEventNotify(slot, Boolean(v.on)),
        },

        // ---- Power & boot ----
        {
            key: 'powermode',
            group: G_POWER,
            label: _("Power mode"),
            description: _("Controller power policy. \"Balanced\" is recommended; \"max performance\" disables dynamic reduction."),
            currentValue: p => readProp(p, 'Current Power Mode', 'Power Mode'),
            fields: [{
                key: 'mode',
                label: _("Mode"),
                type: 'select',
                required: true,
                options: [
                    { value: 'minpower', label: _("Min power") },
                    { value: 'balanced', label: _("Balanced") },
                    { value: 'maxperformance', label: _("Max performance") },
                ],
            }],
            onSave: v => svc.setPowerMode(slot, v.mode as 'balanced'),
        },
        {
            key: 'survivalmode',
            group: G_POWER,
            label: _("Survival mode"),
            description: _("Reduce performance when the controller is overheating to keep the system online."),
            currentValue: p => readProp(p, 'Survival Mode'),
            fields: [{ key: 'on', label: _("Enabled"), type: 'switch' }],
            onSave: v => svc.setSurvivalMode(slot, Boolean(v.on)),
        },
        {
            key: 'bootvolume',
            group: G_POWER,
            label: _("Boot volume"),
            description: _("Designate a logical drive as primary or secondary boot volume, or clear the assignment."),
            currentValue: p => `${readProp(p, 'Primary Boot Volume')} / ${readProp(p, 'Secondary Boot Volume')}`,
            fields: [
                {
                    key: 'value',
                    label: _("Setting"),
                    type: 'select',
                    required: true,
                    options: [
                        { value: 'primary', label: _("Set primary") },
                        { value: 'secondary', label: _("Set secondary") },
                        { value: 'clearprimary', label: _("Clear primary") },
                        { value: 'clearsecondary', label: _("Clear secondary") },
                        { value: 'none', label: _("None") },
                    ],
                },
                {
                    key: 'ldId',
                    label: _("Logical drive ID"),
                    type: 'text',
                    helper: _("Optional. Empty = controller-level boot setting."),
                },
            ],
            onSave: v => svc.setBootVolume(slot, v.value as 'primary', v.ldId as string),
        },
        {
            key: 'postprompt',
            group: G_POWER,
            label: _("POST prompt timeout"),
            description: _("Seconds the F1/F2 POST prompt waits during system boot. 0 disables, max 255."),
            currentValue: p => readProp(p, 'Post Prompt Timeout', 'POST Prompt Timeout'),
            fields: [{ key: 'seconds', label: _("Seconds (0-255)"), type: 'number', required: true }],
            onSave: v => svc.setPostPromptTimeout(slot, v.seconds as number),
        },
        {
            key: 'mnpdelay',
            group: G_POWER,
            label: _("Monitor & performance delay"),
            description: _("Minutes between monitor & performance updates. Range 0–1440."),
            currentValue: p => readProp(p, 'Performance Monitor Delay', 'MNP Delay'),
            fields: [{ key: 'minutes', label: _("Minutes (0-1440)"), type: 'number', required: true }],
            onSave: v => svc.setMnpDelay(slot, v.minutes as number),
        },
        {
            key: 'discoveryproto',
            group: G_POWER,
            label: _("Backplane discovery protocol"),
            description: _("Protocol used to enumerate the connected backplane. A reboot is required for changes to take effect."),
            currentValue: p => readProp(p, 'Discovery Protocol'),
            fields: [
                {
                    key: 'proto',
                    label: _("Protocol"),
                    type: 'select',
                    required: true,
                    options: ['autodetect', 'ubm', 'sgpio', 'vpp', 'dac'].map(v => ({ value: v, label: v })),
                },
                {
                    key: 'targets',
                    label: _("Number of targets"),
                    type: 'select',
                    helper: _("Required when protocol=dac"),
                    options: ['1', '2', '4', '8'].map(v => ({ value: v, label: v })),
                    visible: vs => vs.proto === 'dac',
                },
            ],
            onSave: v => svc.setDiscoveryProtocol(slot, v.proto as 'sgpio',
                                                  v.targets ? Number(v.targets) as 1 : undefined),
        },
        {
            key: 'sanitizelock',
            group: G_POWER,
            label: _("Sanitize lock"),
            description: _("Drive sanitize lock setting. \"freeze\" prevents sanitize commands; \"anti-freeze\" allows them."),
            currentValue: p => readProp(p, 'Sanitize Lock'),
            fields: [{
                key: 'value',
                label: _("Setting"),
                type: 'select',
                required: true,
                options: [
                    { value: 'freeze', label: 'freeze' },
                    { value: 'anti-freeze', label: 'anti-freeze' },
                    { value: 'none', label: 'none' },
                ],
            }],
            onSave: v => svc.setSanitizeLock(slot, v.value as 'freeze'),
        },
        {
            key: 'persistentlogpolicy',
            group: G_POWER,
            label: _("Persistent log policy"),
            description: _("Which event the persistent event log displays when full."),
            currentValue: p => readProp(p, 'Persistent Event Log Policy'),
            fields: [{
                key: 'value',
                label: _("Policy"),
                type: 'select',
                required: true,
                options: [
                    { value: 'most_recent_occurred', label: 'most_recent_occurred' },
                    { value: 'least_recent_consumed', label: 'least_recent_consumed' },
                ],
            }],
            onSave: v => svc.setPersistentPolicyChange(slot, v.value as 'most_recent_occurred'),
        },
        {
            key: 'uefihealth',
            group: G_POWER,
            label: _("UEFI health reporting"),
            description: _("Whether UEFI boot reports controller errors and halts boot to display them."),
            currentValue: p => readProp(p, 'UEFI Health Reporting Mode', 'UEFI Health Reporting'),
            fields: [{
                key: 'value',
                label: _("Mode"),
                type: 'select',
                required: true,
                options: [{ value: 'all', label: 'all' }, { value: 'disabled', label: 'disabled' }],
            }],
            onSave: v => svc.setUefiHealthReporting(slot, v.value as 'all'),
        },
    ];
}

// ---------------------------------------------------------------------------
// Controller actions — operational items (LED, show, license, diag, reset).
// All modify= settings now live on the Settings tab via controllerSettingDefs.
// ---------------------------------------------------------------------------

export function controllerActions(
    controller: Controller,
    open: ReturnType<typeof useDialogs>,
): ActionItem[] {
    const slot = controller.slot;

    return [
        {
            id: 'bootcontroller',
            group: _("Power & Boot"),
            label: _("Set as boot controller"),
            onSelect: () => open.openConfirm({
                title: _("Set as boot controller"),
                body: _("Designate this controller as the system boot controller. Only effective in offline environments."),
                confirmVariant: 'primary',
                confirmLabel: _("Apply"),
                onConfirm: () => svc.setBootController(slot),
            }),
        },

        // ---- LED ----
        {
            id: 'led',
            group: _("LED & Diagnostics"),
            label: _("Identify (LED)"),
            onSelect: () => open.openForm({
                title: _("Identify controller (LED)"),
                fields: [
                    { key: 'on', label: _("LED on"), type: 'switch', defaultValue: true },
                    { key: 'duration', label: _("Duration (s)"), type: 'number', helper: _("1-86400, default 3600") },
                ],
                onSubmit: v => svc.setControllerLed(slot, Boolean(v.on), v.duration as number | undefined),
            }),
        },
        {
            id: 'show-debugtoken',
            group: _("LED & Diagnostics"),
            label: _("Show debug token"),
            onSelect: () => open.openOutput(_("Debug token"), () => svc.showDebugToken(slot)),
        },
        {
            id: 'show-licensekeys',
            group: _("LED & Diagnostics"),
            label: _("Show license keys"),
            onSelect: () => open.openOutput(_("License keys"), () => svc.showLicenseKeys(slot)),
        },
        {
            id: 'show-ssdinfo',
            group: _("LED & Diagnostics"),
            label: _("Show SSD info"),
            onSelect: () => open.openOutput(_("SSD info"), () => svc.showSsdInfo(slot)),
        },
        {
            id: 'show-tape',
            group: _("LED & Diagnostics"),
            label: _("Show tape drives"),
            onSelect: () => open.openOutput(_("Tape drives"), () => svc.showTapeDrives(slot)),
        },
        {
            id: 'add-licensekey',
            group: _("LED & Diagnostics"),
            label: _("Add license key…"),
            onSelect: () => open.openForm({
                title: _("Add license key"),
                fields: [{
                    key: 'key',
                    label: _("License key"),
                    type: 'text',
                    required: true,
                    placeholder: 'XXXXX-XXXXX-XXXXX-XXXXX-XXXXX'
                }],
                onSubmit: v => svc.addLicenseKey(slot, String(v.key)),
            }),
        },
        {
            id: 'diag',
            group: _("LED & Diagnostics"),
            label: _("Generate diagnostics…"),
            onSelect: () => open.openForm({
                title: _("Generate diagnostics"),
                fields: [
                    {
                        key: 'file',
                        label: _("File path"),
                        type: 'text',
                        required: true,
                        placeholder: '/tmp/ctrl_slot1.zip',
                        defaultValue: `/tmp/ctrl_slot${slot}.zip`
                    },
                    { key: 'logs', label: _("Include serial/basecode logs"), type: 'switch' },
                    { key: 'ssdrpt', label: _("SmartSSD wear gauge report"), type: 'switch' },
                ],
                onSubmit: v => svc.diagController(slot, String(v.file), { logs: Boolean(v.logs), ssdrpt: Boolean(v.ssdrpt) }),
            }),
        },

        // ---- Reset / clear / encryption ----
        {
            id: 'reset',
            group: _("Danger zone"),
            label: _("Reset controller…"),
            isDanger: true,
            onSelect: () => open.openForm({
                title: _("Reset controller"),
                description: _("Initiate a controller reset via the driver."),
                submitVariant: 'warning',
                submitLabel: _("Reset"),
                fields: [{
                    key: 'type',
                    label: _("Reset type"),
                    type: 'select',
                    required: true,
                    options: [
                        { value: 'iop', label: 'iop' },
                        { value: 'driversoft', label: 'driversoft' },
                        { value: 'full', label: 'full' },
                    ]
                }],
                onSubmit: v => svc.resetController(slot, v.type as 'iop'),
            }),
        },
        {
            id: 'cleartconfig',
            group: _("Danger zone"),
            label: _("Clear configuration…"),
            isDanger: true,
            onSelect: () => open.openConfirm({
                title: _("Clear controller configuration"),
                body: _("This deletes ALL arrays and logical drives on this controller. Mounted volumes will be removed."),
                confirmLabel: _("Clear configuration"),
                requireTyped: 'CLEAR',
                onConfirm: () => svc.deleteController(slot, { forced: true, override: true }),
            }),
        },
    ];
}

// ---------------------------------------------------------------------------
// Array actions
// ---------------------------------------------------------------------------

export function arrayActions(
    slot: string,
    arrayId: string,
    open: ReturnType<typeof useDialogs>,
): ActionItem[] {
    const ldCreateFields: FieldDef[] = [
        {
            key: 'type',
            label: _("Type"),
            type: 'select',
            defaultValue: 'ld',
            options: [
                { value: 'ld', label: 'ld' },
                { value: 'ldcache', label: 'ldcache' },
                { value: 'arrayr0', label: 'arrayr0' },
                { value: 'bootarray', label: 'bootarray' },
            ]
        },
        {
            key: 'raid',
            label: _("RAID level"),
            type: 'select',
            options: ['0', '1', '1triple', '1+0', '1+0triple', '5', '50', '6', '60'].map(v => ({ value: v, label: v }))
        },
        { key: 'size', label: _("Size"), type: 'text', placeholder: 'max | min | maxmbr | <MB>', defaultValue: 'max' },
        {
            key: 'stripsize',
            label: _("Strip size (KB)"),
            type: 'select',
            options: ['default', '8', '16', '32', '64', '128', '256', '512', '1024'].map(v => ({ value: v, label: v }))
        },
        {
            key: 'caching',
            label: _("Caching"),
            type: 'select',
            options: [{ value: 'enable', label: 'enable' }, { value: 'disable', label: 'disable' }]
        },
        {
            key: 'parityinitializationmethod',
            label: _("Parity init method"),
            type: 'select',
            options: [{ value: 'default', label: 'default' }, { value: 'rapid', label: 'rapid' }]
        },
        { key: 'logicaldrivelabel', label: _("Label"), type: 'text' },
        {
            key: 'sedencryption',
            label: _("SED encryption"),
            type: 'select',
            options: [{ value: 'on', label: 'on' }, { value: 'off', label: 'off' }]
        },
    ];

    return [
        {
            id: 'create-ld',
            group: _("Configuration"),
            label: _("Create logical drive…"),
            onSelect: () => open.openForm({
                title: cockpit.format(_("Create logical drive on array $0"), arrayId),
                fields: ldCreateFields,
                onSubmit: v => svc.createLogicalDrive(slot, {
                    type: v.type as 'ld',
                    raid: v.raid as string,
                    size: v.size as string,
                    stripsize: v.stripsize as string,
                    caching: v.caching as 'enable',
                    parityinitializationmethod: v.parityinitializationmethod as 'rapid',
                    logicaldrivelabel: v.logicaldrivelabel as string,
                    sedencryption: v.sedencryption as 'on',
                }, arrayId),
            }),
        },
        {
            id: 'add-drives',
            group: _("Configuration"),
            label: _("Add drives (expand)…"),
            onSelect: () => open.openForm({
                title: _("Add drives to array"),
                fields: [
                    {
                        key: 'drives',
                        label: _("Drives"),
                        type: 'text',
                        required: true,
                        placeholder: '1I:1:5,1I:1:6 or 1I:1:5-1I:1:8 or allunassigned'
                    },
                    { key: 'modifyparitygroups', label: _("Modify parity groups"), type: 'switch' },
                    { key: 'forced', label: _("Forced"), type: 'switch' },
                ],
                onSubmit: v => svc.arrayAddDrives(slot, arrayId, String(v.drives), {
                    modifyParityGroups: Boolean(v.modifyparitygroups),
                    forced: Boolean(v.forced),
                }),
            }),
        },
        {
            id: 'add-spares',
            group: _("Configuration"),
            label: _("Add spares…"),
            onSelect: () => open.openForm({
                title: _("Add spares to array"),
                fields: [
                    { key: 'drives', label: _("Drives"), type: 'text', required: true, placeholder: '1I:1:5 or allunassigned' },
                    {
                        key: 'sparetype',
                        label: _("Spare type"),
                        type: 'select',
                        defaultValue: 'dedicated',
                        options: [
                            { value: 'dedicated', label: _("Dedicated") },
                            { value: 'autoreplace', label: _("Auto-replace") },
                        ]
                    },
                ],
                onSubmit: v => svc.arrayAddSpares(slot, arrayId, String(v.drives), v.sparetype as 'dedicated'),
            }),
        },
        {
            id: 'remove-drives',
            group: _("Configuration"),
            label: _("Remove drives…"),
            isDanger: true,
            onSelect: () => open.openForm({
                title: _("Remove drives from array"),
                submitVariant: 'warning',
                fields: [
                    { key: 'drives', label: _("Drives"), type: 'text', required: true },
                    { key: 'modifyparitygroups', label: _("Modify parity groups"), type: 'switch' },
                ],
                onSubmit: v => svc.arrayRemoveDrives(slot, arrayId, String(v.drives), {
                    modifyParityGroups: Boolean(v.modifyparitygroups),
                }),
            }),
        },
        {
            id: 'remove-spares',
            group: _("Configuration"),
            label: _("Remove spares…"),
            onSelect: () => open.openForm({
                title: _("Remove spares from array"),
                fields: [{ key: 'drives', label: _("Drives"), type: 'text', required: true, placeholder: 'all or 1I:1:5' }],
                onSubmit: v => svc.arrayRemoveSpares(slot, arrayId, String(v.drives)),
            }),
        },
        {
            id: 'replace-drives',
            group: _("Configuration"),
            label: _("Replace drives…"),
            onSelect: () => open.openForm({
                title: _("Replace drives in array"),
                fields: [{ key: 'drives', label: _("Drives"), type: 'text', required: true }],
                onSubmit: v => svc.arrayReplaceDrives(slot, arrayId, String(v.drives)),
            }),
        },
        {
            id: 'consolidate-space',
            group: _("Configuration"),
            label: _("Consolidate free space"),
            onSelect: () => open.openConfirm({
                title: _("Consolidate free space"),
                body: _("Relocate logical drives and consolidate free space at the end of the array."),
                confirmVariant: 'primary',
                confirmLabel: _("Run"),
                onConfirm: () => svc.arrayConsolidateSpace(slot, arrayId),
            }),
        },
        {
            id: 'heal',
            group: _("Configuration"),
            label: _("Heal…"),
            onSelect: () => open.openForm({
                title: _("Heal array"),
                description: _("Provide unassigned drives to replace failed drives."),
                fields: [{ key: 'drives', label: _("Drives"), type: 'text', required: true }],
                onSubmit: v => svc.arrayHeal(slot, arrayId, String(v.drives)),
            }),
        },
        {
            id: 'ssd-smartpath',
            group: _("Acceleration"),
            label: _("SSD Smart Path"),
            onSelect: () => open.openForm({
                title: _("SSD Smart Path"),
                fields: [{ key: 'on', label: _("Enabled"), type: 'switch' }],
                onSubmit: v => svc.arraySsdSmartPath(slot, arrayId, Boolean(v.on)),
            }),
        },
        {
            id: 'ssd-iobypass',
            group: _("Acceleration"),
            label: _("SSD I/O bypass"),
            onSelect: () => open.openForm({
                title: _("SSD I/O bypass"),
                fields: [{ key: 'on', label: _("Enabled"), type: 'switch' }],
                onSubmit: v => svc.arraySsdIoBypass(slot, arrayId, Boolean(v.on)),
            }),
        },
        {
            id: 'led',
            group: _("Acceleration"),
            label: _("Identify (LED)"),
            onSelect: () => open.openForm({
                title: _("Identify array (LED)"),
                fields: [
                    { key: 'on', label: _("LED on"), type: 'switch', defaultValue: true },
                    { key: 'duration', label: _("Duration (s)"), type: 'number' },
                ],
                onSubmit: v => svc.arrayLed(slot, arrayId, Boolean(v.on), v.duration as number | undefined),
            }),
        },
        {
            id: 'delete-array',
            group: _("Danger zone"),
            label: _("Delete array…"),
            isDanger: true,
            onSelect: () => open.openConfirm({
                title: _("Delete array"),
                body: cockpit.format(_("This deletes array $0 and all its logical drives. Other array letters may be renamed."), arrayId),
                requireTyped: arrayId,
                onConfirm: () => svc.arrayDelete(slot, arrayId, { forced: true }),
            }),
        },
    ];
}

// ---------------------------------------------------------------------------
// Logical drive actions
// ---------------------------------------------------------------------------

export function ldActions(
    ld: LogicalDrive,
    open: ReturnType<typeof useDialogs>,
): ActionItem[] {
    const slot = ld.controllerSlot;
    const id = ld.id;
    return [
        {
            id: 'caching',
            group: _("Settings"),
            label: _("Caching"),
            onSelect: () => open.openForm({
                title: cockpit.format(_("Caching for LD $0"), id),
                fields: [{ key: 'on', label: _("Enabled"), type: 'switch' }],
                onSubmit: v => svc.ldSetCaching(slot, id, Boolean(v.on)),
            }),
        },
        {
            id: 'arrayaccelerator',
            group: _("Settings"),
            label: _("Array accelerator"),
            onSelect: () => open.openForm({
                title: _("Array accelerator"),
                fields: [{ key: 'on', label: _("Enabled"), type: 'switch' }],
                onSubmit: v => svc.ldSetArrayAccelerator(slot, id, Boolean(v.on)),
            }),
        },
        {
            id: 'label',
            group: _("Settings"),
            label: _("Set label…"),
            onSelect: () => open.openForm({
                title: _("Set logical drive label"),
                fields: [{ key: 'label', label: _("Label"), type: 'text', required: true }],
                onSubmit: v => svc.ldSetLabel(slot, id, String(v.label)),
            }),
        },
        {
            id: 'led',
            group: _("Settings"),
            label: _("Identify (LED)"),
            onSelect: () => open.openForm({
                title: _("Identify logical drive (LED)"),
                fields: [
                    { key: 'on', label: _("LED on"), type: 'switch', defaultValue: true },
                    { key: 'duration', label: _("Duration (s)"), type: 'number' },
                ],
                onSubmit: v => svc.ldSetLed(slot, id, Boolean(v.on), v.duration as number | undefined),
            }),
        },
        {
            id: 'resize',
            group: _("Migration"),
            label: _("Extend size…"),
            onSelect: () => open.openForm({
                title: _("Extend logical drive"),
                fields: [
                    { key: 'size', label: _("Size"), type: 'text', required: true, placeholder: 'max | maxmbr | <MB>' },
                    { key: 'forced', label: _("Forced"), type: 'switch' },
                ],
                onSubmit: v => svc.ldResize(slot, id, String(v.size), Boolean(v.forced)),
            }),
        },
        {
            id: 'migrate',
            group: _("Migration"),
            label: _("Migrate RAID/strip size…"),
            onSelect: () => open.openForm({
                title: _("Migrate logical drive"),
                fields: [
                    {
                        key: 'raid',
                        label: _("RAID"),
                        type: 'select',
                        options: ['0', '1', '1triple', '1+0', '1+0triple', '5', '50', '6', '60'].map(v => ({ value: v, label: v }))
                    },
                    {
                        key: 'stripsize',
                        label: _("Strip size (KB)"),
                        type: 'select',
                        options: ['default', '8', '16', '32', '64', '128', '256', '512', '1024'].map(v => ({ value: v, label: v }))
                    },
                ],
                onSubmit: v => svc.ldMigrate(slot, id, v.raid as string, v.stripsize as string),
            }),
        },
        {
            id: 'movearray',
            group: _("Migration"),
            label: _("Move to existing array…"),
            onSelect: () => open.openForm({
                title: _("Move LD to existing array"),
                fields: [{ key: 'newarray', label: _("Target array ID"), type: 'text', required: true }],
                onSubmit: v => svc.ldMoveToArray(slot, id, String(v.newarray)),
            }),
        },
        {
            id: 'movenewarray',
            group: _("Migration"),
            label: _("Move to new array (drives)…"),
            onSelect: () => open.openForm({
                title: _("Move LD to new array"),
                fields: [{ key: 'drives', label: _("Drives"), type: 'text', required: true }],
                onSubmit: v => svc.ldMoveToNewArray(slot, id, String(v.drives)),
            }),
        },
        {
            id: 'reenable',
            group: _("Recovery"),
            label: _("Re-enable failed LD…"),
            isDanger: true,
            onSelect: () => open.openConfirm({
                title: _("Re-enable failed logical drive"),
                body: _("Re-enables a failed LD. Existing data may not be valid or recoverable."),
                confirmVariant: 'warning',
                confirmLabel: _("Re-enable"),
                onConfirm: () => svc.ldReenable(slot, id, true),
            }),
        },
        {
            id: 'delete',
            group: _("Danger zone"),
            label: _("Delete logical drive…"),
            isDanger: true,
            onSelect: () => open.openConfirm({
                title: _("Delete logical drive"),
                body: cockpit.format(_("Delete logical drive $0? Deleting the last LD in an array also deletes the array."), id),
                requireTyped: id,
                onConfirm: () => svc.ldDelete(slot, id, { forced: true, override: true }),
            }),
        },
    ];
}

// ---------------------------------------------------------------------------
// Physical drive actions
// ---------------------------------------------------------------------------

export function pdActions(
    pd: PhysicalDrive,
    open: ReturnType<typeof useDialogs>,
): ActionItem[] {
    const slot = pd.controllerSlot;
    const id = pd.id;
    return [
        {
            id: 'led',
            group: _("Settings"),
            label: _("Identify (LED)"),
            onSelect: () => open.openForm({
                title: cockpit.format(_("Identify drive $0 (LED)"), id),
                fields: [
                    { key: 'on', label: _("LED on"), type: 'switch', defaultValue: true },
                    { key: 'duration', label: _("Duration (s)"), type: 'number', helper: _("1-86400, default 3600") },
                ],
                onSubmit: v => svc.pdSetLed(slot, id, Boolean(v.on), v.duration as number | undefined),
            }),
        },
        {
            id: 'erase',
            group: _("Erase"),
            label: _("Erase drive…"),
            isDanger: true,
            onSelect: () => open.openForm({
                title: cockpit.format(_("Erase drive $0"), id),
                description: _("crypto/block/overwrite patterns are sanitize erases and cannot be stopped."),
                submitVariant: 'danger',
                submitLabel: _("Start erase"),
                fields: [
                    {
                        key: 'erasepattern',
                        label: _("Pattern"),
                        type: 'select',
                        required: true,
                        options: [
                            { value: 'zero', label: 'zero' },
                            { value: 'random_zero', label: 'random_zero' },
                            { value: 'random_random_zero', label: 'random_random_zero' },
                            { value: 'crypto', label: 'crypto (sanitize)' },
                            { value: 'block', label: 'block (sanitize)' },
                            { value: 'overwrite', label: 'overwrite (sanitize)' },
                        ]
                    },
                    {
                        key: 'unrestricted',
                        label: _("Unrestricted"),
                        type: 'select',
                        options: [{ value: 'on', label: 'on' }, { value: 'off', label: 'off' }],
                        helper: _("Required for sanitize erase patterns."),
                        visible: vs => ['crypto', 'block', 'overwrite'].includes(String(vs.erasepattern))
                    },
                ],
                onSubmit: v => svc.pdErase(slot, id, v.erasepattern as 'zero', v.unrestricted as 'on'),
            }),
        },
        {
            id: 'stoperase',
            group: _("Erase"),
            label: _("Stop erase"),
            onSelect: () => open.openConfirm({
                title: _("Stop erase"),
                body: cockpit.format(_("Stop the in-progress erase on drive $0?"), id),
                confirmVariant: 'warning',
                confirmLabel: _("Stop"),
                onConfirm: () => svc.pdStopErase(slot, id),
            }),
        },
        {
            id: 'enable-erased',
            group: _("Erase"),
            label: _("Enable erased drive"),
            onSelect: () => open.openConfirm({
                title: _("Enable erased drive"),
                body: cockpit.format(_("Mark erased drive $0 as enabled?"), id),
                confirmVariant: 'primary',
                confirmLabel: _("Enable"),
                onConfirm: () => svc.pdEnableErasedDrive(slot, id),
            }),
        },
    ];
}
