import cockpit from 'cockpit';
import {
    parseControllerList, parseControllerDetail, parsePhysicalDrives,
    parseLogicalDrives, parseEnclosures, parseConfigOverview
} from './ssacli';
import type { SystemOverview } from './types';

// ---------------------------------------------------------------------------
// Command log — every ssacli invocation is recorded with a "why" reason.
// The CommandLog UI subscribes to this and renders entries as bash snippets.
// ---------------------------------------------------------------------------

export interface CommandLogEntry {
    id: number;
    timestamp: number;
    reason: string;
    args: string[];
    status: 'pending' | 'success' | 'error';
    output?: string;
    error?: string;
    durationMs?: number;
}

const commandLog: CommandLogEntry[] = [];
const logSubscribers = new Set<() => void>();
let nextId = 1;
// Discovery commands fired by fetchOverview() are noisy and not user-initiated;
// skip them by default. The UI exposes a toggle to include them.
let logDiscovery = false;

export function getCommandLog(): CommandLogEntry[] {
    return commandLog;
}

export function clearCommandLog(): void {
    commandLog.length = 0;
    notifyLog();
}

export function setLogDiscovery(on: boolean): void {
    logDiscovery = on;
}

export function isLogDiscovery(): boolean {
    return logDiscovery;
}

export function subscribeCommandLog(cb: () => void): () => void {
    logSubscribers.add(cb);
    return () => logSubscribers.delete(cb);
}

function notifyLog(): void {
    for (const cb of logSubscribers) cb();
}

// ---------------------------------------------------------------------------
// Low-level command runner
// ---------------------------------------------------------------------------

function ssacli(args: string[]): cockpit.Spawn<string> {
    return cockpit.spawn(['ssacli', ...args], { err: 'message', superuser: 'require' });
}

interface RunOpts {
    reason?: string;
    discovery?: boolean;
}

export async function runSsacli(args: string[], reason?: string | RunOpts): Promise<string> {
    const opts: RunOpts = typeof reason === 'string' ? { reason } : (reason ?? {});
    const skip = opts.discovery && !logDiscovery;
    const entry: CommandLogEntry | null = skip
        ? null
        : {
            id: nextId++,
            timestamp: Date.now(),
            reason: opts.reason ?? 'Run ssacli command',
            args,
            status: 'pending',
        };
    if (entry) {
        commandLog.push(entry);
        notifyLog();
    }
    const start = Date.now();
    try {
        const output = await ssacli(args);
        if (entry) {
            entry.status = 'success';
            entry.output = output;
            entry.durationMs = Date.now() - start;
            notifyLog();
        }
        return output;
    } catch (e: unknown) {
        if (entry) {
            entry.status = 'error';
            entry.error = e instanceof Error ? e.message : String(e);
            entry.durationMs = Date.now() - start;
            notifyLog();
        }
        throw e;
    }
}

// Splits a free-form ssacli command line into argv. Strips an optional leading
// "ssacli " so the user can paste either form. Quoted arguments are honored.
export function tokenize(cmdline: string): string[] {
    const trimmed = cmdline.trim().replace(/^ssacli\s+/i, '');
    const out: string[] = [];
    let buf = '';
    let inQuote: '"' | "'" | null = null;
    for (const ch of trimmed) {
        if (inQuote) {
            if (ch === inQuote) inQuote = null;
            else buf += ch;
        } else if (ch === '"' || ch === "'") {
            inQuote = ch;
        } else if (/\s/.test(ch)) {
            if (buf) { out.push(buf); buf = '' }
        } else {
            buf += ch;
        }
    }
    if (buf) out.push(buf);
    return out;
}

export async function runSsacliCommandLine(cmdline: string): Promise<string> {
    return runSsacli(tokenize(cmdline), 'Manual command entered in UI');
}

// ---------------------------------------------------------------------------
// Targeting helpers
// ---------------------------------------------------------------------------

export const ctrlTarget = (slot: string): string[] => ['controller', `slot=${slot}`];
export const arrayTarget = (slot: string, arrayId: string): string[] =>
    [...ctrlTarget(slot), 'array', arrayId];
export const ldTarget = (slot: string, ldId: string): string[] =>
    [...ctrlTarget(slot), 'logicaldrive', ldId];
export const pdTarget = (slot: string, pdId: string): string[] =>
    [...ctrlTarget(slot), 'physicaldrive', pdId];
export const enclosureTarget = (slot: string, encId: string): string[] =>
    [...ctrlTarget(slot), 'enclosure', encId];

// Builds key=value pairs, omitting empty values.
function kv(params: Record<string, string | number | boolean | undefined | null>): string[] {
    const out: string[] = [];
    for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null || v === '') continue;
        out.push(`${k}=${String(v)}`);
    }
    return out;
}

// ---------------------------------------------------------------------------
// Top-level discovery
// ---------------------------------------------------------------------------

export async function fetchOverview(): Promise<SystemOverview> {
    const overview: SystemOverview = {
        controllers: [],
        enclosures: [],
        arrays: [],
        logicalDrives: [],
        physicalDrives: [],
    };

    const ctrlOutput = await runSsacli(['controller', 'all', 'show'],
                                       { reason: 'Discover controllers', discovery: true });
    overview.controllers = parseControllerList(ctrlOutput);

    const detailOutputs = await Promise.all(
        overview.controllers.map(c =>
            runSsacli([...ctrlTarget(c.slot), 'show', 'detail'],
                      { reason: `Read controller details for slot ${c.slot}`, discovery: true }).catch(() => '')
        )
    );

    for (let i = 0; i < overview.controllers.length; i++) {
        const detail = parseControllerDetail(detailOutputs[i]);
        if (detail) {
            overview.controllers[i] = { ...overview.controllers[i], ...detail };
        }
    }

    const configOutputs = await Promise.all(
        overview.controllers.map(c =>
            runSsacli([...ctrlTarget(c.slot), 'show', 'config'],
                      { reason: `Read array/LD/PD config for slot ${c.slot}`, discovery: true }).catch(() => '')
        )
    );

    for (let i = 0; i < overview.controllers.length; i++) {
        const config = parseConfigOverview(configOutputs[i], overview.controllers[i].slot);
        overview.arrays.push(...config.arrays);
        overview.physicalDrives.push(...config.physicalDrives);
    }

    const pdDetailOutputs = await Promise.all(
        overview.controllers.map(c =>
            runSsacli([...ctrlTarget(c.slot), 'physicaldrive', 'all', 'show', 'detail'],
                      { reason: `Read physical drive details for slot ${c.slot}`, discovery: true }).catch(() => '')
        )
    );

    for (let i = 0; i < overview.controllers.length; i++) {
        const pds = parsePhysicalDrives(pdDetailOutputs[i], overview.controllers[i].slot);
        for (const pd of pds) {
            const existing = overview.physicalDrives.find(e => e.id === pd.id && e.controllerSlot === pd.controllerSlot);
            if (existing) {
                Object.assign(existing, pd);
            } else {
                overview.physicalDrives.push(pd);
            }
        }
    }

    const ldDetailOutputs = await Promise.all(
        overview.controllers.map(c =>
            runSsacli([...ctrlTarget(c.slot), 'logicaldrive', 'all', 'show', 'detail'],
                      { reason: `Read logical drive details for slot ${c.slot}`, discovery: true }).catch(() => '')
        )
    );

    for (let i = 0; i < overview.controllers.length; i++) {
        const lds = parseLogicalDrives(ldDetailOutputs[i], overview.controllers[i].slot);
        overview.logicalDrives.push(...lds);
    }

    const encOutputs = await Promise.all(
        overview.controllers.map(c =>
            runSsacli([...ctrlTarget(c.slot), 'enclosure', 'all', 'show', 'detail'],
                      { reason: `Read enclosure details for slot ${c.slot}`, discovery: true }).catch(() => '')
        )
    );

    for (let i = 0; i < overview.controllers.length; i++) {
        const encs = parseEnclosures(encOutputs[i], overview.controllers[i].slot);
        overview.enclosures.push(...encs);
    }

    return overview;
}

// ---------------------------------------------------------------------------
// Rescan
// ---------------------------------------------------------------------------

export const rescanController = (slot: string) =>
    runSsacli([...ctrlTarget(slot), 'rescan'], `Rescan controller slot ${slot} for new devices`);
export const rescanAll = () =>
    runSsacli(['rescan'], 'Rescan all controllers for new devices');

// ---------------------------------------------------------------------------
// Generic modify / create / delete / add / remove
// ---------------------------------------------------------------------------

type Params = Record<string, string | number | boolean | undefined | null>;

// Build a default reason from a modify-style param map, e.g.
// "Modify controller slot 1: cacheratio=25/75".
function summarize(params: Params): string {
    return kv(params).join(' ');
}

export const ctrlModify = (slot: string, params: Params, reason?: string) =>
    runSsacli([...ctrlTarget(slot), 'modify', ...kv(params)],
              reason ?? `Modify controller slot ${slot}: ${summarize(params)}`);

export const arrayModify = (slot: string, arrayId: string, params: Params, reason?: string) =>
    runSsacli([...arrayTarget(slot, arrayId), 'modify', ...kv(params)],
              reason ?? `Modify array ${arrayId} on slot ${slot}: ${summarize(params)}`);

export const ldModify = (slot: string, ldId: string, params: Params, reason?: string) =>
    runSsacli([...ldTarget(slot, ldId), 'modify', ...kv(params)],
              reason ?? `Modify logical drive ${ldId} on slot ${slot}: ${summarize(params)}`);

export const pdModify = (slot: string, pdId: string, params: Params, reason?: string) =>
    runSsacli([...pdTarget(slot, pdId), 'modify', ...kv(params)],
              reason ?? `Modify physical drive ${pdId} on slot ${slot}: ${summarize(params)}`);

// ---------------------------------------------------------------------------
// Controller-level configuration setters (every documented modify=)
// ---------------------------------------------------------------------------

export const setCacheRatio = (slot: string, ratio: string) =>
    ctrlModify(slot, { cacheratio: ratio },
               `Set read/write cache ratio to ${ratio} on controller slot ${slot}`);
export const setRebuildPriority = (slot: string, level: 'high' | 'medium' | 'low' | 'mediumhigh') =>
    ctrlModify(slot, { rebuildpriority: level },
               `Set rebuild priority to ${level} on controller slot ${slot}`);
export const setExpandPriority = (slot: string, level: 'high' | 'medium' | 'low') =>
    ctrlModify(slot, { expandpriority: level },
               `Set expand priority to ${level} on controller slot ${slot}`);
export const setSurfaceScanMode = (slot: string, mode: 'disable' | 'idle' | 'high', delay?: number) =>
    ctrlModify(slot, { surfacescanmode: mode, surfacescandelay: delay },
               `Set surface scan mode to ${mode}${delay !== undefined ? ` (delay ${delay}s)` : ''} on controller slot ${slot}`);
export const setSurfaceScanDelay = (slot: string, seconds: number) =>
    ctrlModify(slot, { surfacescandelay: seconds },
               `Set surface scan idle delay to ${seconds}s on controller slot ${slot}`);
export const setParallelSurfaceScanCount = (slot: string, count: number) =>
    ctrlModify(slot, { parallelsurfacescancount: count },
               `Set parallel surface scan count to ${count} on controller slot ${slot}`);
export const setQueueDepth = (slot: string, depth: 'automatic' | '32' | '16' | '8' | '4' | '2') =>
    ctrlModify(slot, { queuedepth: depth },
               `Set queue depth to ${depth} on controller slot ${slot}`);
export const setDriveWriteCache = (slot: string, mode: 'enable' | 'disable' | 'unchanged' | 'default', usage?: 'configured' | 'unconfigured' | 'hba') =>
    ctrlModify(slot, { drivewritecache: mode, usage },
               `Set drive write cache to ${mode}${usage ? ` for ${usage} drives` : ''} on controller slot ${slot}`);
export const setDegradedPerformanceOptimization = (slot: string, on: boolean) =>
    ctrlModify(slot, { degradedperformanceoptimization: on ? 'enable' : 'disable' },
               `${on ? 'Enable' : 'Disable'} degraded performance optimization on controller slot ${slot}`);
export const setElevatorSort = (slot: string, on: boolean) =>
    ctrlModify(slot, { elevatorsort: on ? 'enable' : 'disable' },
               `${on ? 'Enable' : 'Disable'} elevator sort on controller slot ${slot}`);
export const setInconsistencyRepairPolicy = (slot: string, on: boolean) =>
    ctrlModify(slot, { inconsistencyrepairpolicy: on ? 'enable' : 'disable' },
               `${on ? 'Enable' : 'Disable'} inconsistency repair policy on controller slot ${slot}`);
export const setNoBatteryWriteCache = (slot: string, mode: 'enable' | 'disable' | 'default') =>
    ctrlModify(slot, { nobatterywritecache: mode },
               `Set no-battery write cache to ${mode} on controller slot ${slot}`);
export const setWriteCacheBypassThreshold = (slot: string, kib: number | 'default') =>
    ctrlModify(slot, { writecachebypassthreshold: kib },
               `Set write-cache bypass threshold to ${kib}${typeof kib === 'number' ? ' KiB' : ''} on controller slot ${slot}`);
export const setWaitForCacheRoom = (slot: string, on: boolean) =>
    ctrlModify(slot, { waitforcacheroom: on ? 'enable' : 'disable' },
               `${on ? 'Enable' : 'Disable'} wait-for-cache-room on controller slot ${slot}`);
export const setSurfaceAnalysisEventNotify = (slot: string, on: boolean) =>
    ctrlModify(slot, { surfaceanalysiseventnotify: on ? 'enable' : 'disable' },
               `${on ? 'Enable' : 'Disable'} surface analysis event notification on controller slot ${slot}`);
export const setRaid1WriteBuffering = (slot: string, on: boolean) =>
    ctrlModify(slot, { raid1writebuffering: on ? 'enable' : 'disable' },
               `${on ? 'Enable' : 'Disable'} RAID 1 write buffering on controller slot ${slot}`);
export const setPostPromptTimeout = (slot: string, seconds: number) =>
    ctrlModify(slot, { postprompttimeout: seconds },
               `Set POST prompt timeout to ${seconds}s on controller slot ${slot}`);
export const setMnpDelay = (slot: string, minutes: number) =>
    ctrlModify(slot, { mnpdelay: minutes },
               `Set monitor & performance delay to ${minutes}min on controller slot ${slot}`);
export const setBootController = (slot: string) =>
    ctrlModify(slot, { bootcontroller: 'enable' },
               `Designate controller slot ${slot} as the boot controller`);
export const setBootVolume = (slot: string, value: 'primary' | 'secondary' | 'clearprimary' | 'clearsecondary' | 'none', ldId?: string) =>
    ldId
        ? ldModify(slot, ldId, { bootvolume: value },
                   `Set bootvolume=${value} on logical drive ${ldId} (slot ${slot})`)
        : ctrlModify(slot, { bootvolume: value },
                     `Set controller-level bootvolume=${value} on slot ${slot}`);
export const setSanitizeLock = (slot: string, value: 'freeze' | 'anti-freeze' | 'none') =>
    runSsacli([...ctrlTarget(slot), 'sanitizelock', `sanitizelock=${value}`],
              `Set sanitize lock to ${value} on controller slot ${slot}`);
export const setPowerMode = (slot: string, mode: 'minpower' | 'balanced' | 'maxperformance') =>
    ctrlModify(slot, { powermode: mode },
               `Set power mode to ${mode} on controller slot ${slot}`);
export const setSurvivalMode = (slot: string, on: boolean) =>
    ctrlModify(slot, { survivalmode: on ? 'enable' : 'disable' },
               `${on ? 'Enable' : 'Disable'} survival mode on controller slot ${slot}`);
export const setDiscoveryProtocol = (slot: string, proto: 'autodetect' | 'ubm' | 'sgpio' | 'vpp' | 'dac', numberOfTargets?: 1 | 2 | 4 | 8) =>
    ctrlModify(slot, { discoveryprotocol: proto, numberoftargets: numberOfTargets },
               `Set backplane discovery protocol to ${proto}${numberOfTargets ? ` (${numberOfTargets} targets)` : ''} on controller slot ${slot}`);
export const setPersistentPolicyChange = (slot: string, value: 'most_recent_occurred' | 'least_recent_consumed') =>
    ctrlModify(slot, { persistentpolicychange: value },
               `Set persistent log policy to ${value} on controller slot ${slot}`);
export const setUefiHealthReporting = (slot: string, value: 'all' | 'disabled') =>
    ctrlModify(slot, { uefihealthreporting: value },
               `Set UEFI health reporting to ${value} on controller slot ${slot}`);
export const setControllerLed = (slot: string, on: boolean, durationSeconds?: number) =>
    ctrlModify(slot, { led: on ? 'on' : 'off', duration: on ? durationSeconds : undefined },
               `Turn controller slot ${slot} identify LED ${on ? 'on' : 'off'}${on && durationSeconds ? ` for ${durationSeconds}s` : ''}`);

export const resetController = (slot: string, type: 'iop' | 'driversoft' | 'full') =>
    runSsacli([...ctrlTarget(slot), 'reset', `resettype=${type}`],
              `Reset controller slot ${slot} (${type} reset)`);

export const deleteController = (slot: string, opts: { forced?: boolean; override?: boolean } = {}) => {
    const args = [...ctrlTarget(slot), 'delete'];
    if (opts.forced) args.push('forced');
    if (opts.override) args.push('override');
    return runSsacli(args, `Clear all configuration on controller slot ${slot}`);
};

// ---------------------------------------------------------------------------
// License keys
// ---------------------------------------------------------------------------

export const addLicenseKey = (slot: string, key: string) =>
    runSsacli([...ctrlTarget(slot), 'add', `licensekey=${key}`],
              `Add license key to controller slot ${slot}`);
export const deleteLicenseKey = (slot: string, key: string) =>
    runSsacli([...ctrlTarget(slot), 'licensekey', key, 'delete'],
              `Delete license key on controller slot ${slot}`);
export const showLicenseKeys = (slot: string) =>
    runSsacli([...ctrlTarget(slot), 'licensekey', 'all', 'show'],
              `List license keys on controller slot ${slot}`);

// ---------------------------------------------------------------------------
// Array operations
// ---------------------------------------------------------------------------

export const arrayAddDrives = (slot: string, arrayId: string, drives: string, opts: { modifyParityGroups?: boolean; forced?: boolean } = {}) => {
    const args = [...arrayTarget(slot, arrayId), 'add', `drives=${drives}`];
    if (opts.modifyParityGroups !== undefined) args.push(`modifyparitygroups=${opts.modifyParityGroups ? 'yes' : 'no'}`);
    if (opts.forced) args.push('forced');
    return runSsacli(args, `Add drives ${drives} to array ${arrayId} on slot ${slot} (expand)`);
};

export const arrayAddSpares = (slot: string, arrayId: string, drives: string, sparetype: 'dedicated' | 'autoreplace' = 'dedicated') =>
    runSsacli([...arrayTarget(slot, arrayId), 'add', `spares=${drives}`, `sparetype=${sparetype}`],
              `Add ${sparetype} spare(s) ${drives} to array ${arrayId} on slot ${slot}`);

export const arrayRemoveDrives = (slot: string, arrayId: string, drives: string, opts: { modifyParityGroups?: boolean } = {}) => {
    const args = [...arrayTarget(slot, arrayId), 'remove', `drives=${drives}`];
    if (opts.modifyParityGroups !== undefined) args.push(`modifyparitygroups=${opts.modifyParityGroups ? 'yes' : 'no'}`);
    return runSsacli(args, `Remove drives ${drives} from array ${arrayId} on slot ${slot}`);
};

export const arrayRemoveSpares = (slot: string, arrayId: string, drives: string) =>
    runSsacli([...arrayTarget(slot, arrayId), 'remove', `spares=${drives}`],
              `Remove spare(s) ${drives} from array ${arrayId} on slot ${slot}`);

export const arrayReplaceDrives = (slot: string, arrayId: string, drives: string) =>
    arrayModify(slot, arrayId, { drives },
                `Replace drives in array ${arrayId} on slot ${slot} with ${drives}`);

export const arrayHeal = (slot: string, arrayId: string, drives: string) =>
    runSsacli([...arrayTarget(slot, arrayId), 'heal', `drives=${drives}`],
              `Heal array ${arrayId} on slot ${slot} using drives ${drives}`);

export const arrayConsolidateSpace = (slot: string, arrayId: string) =>
    runSsacli([...arrayTarget(slot, arrayId), 'modify', 'consolidatespace'],
              `Consolidate free space on array ${arrayId} (slot ${slot})`);

export const arraySsdSmartPath = (slot: string, arrayId: string, on: boolean) =>
    arrayModify(slot, arrayId, { ssdsmartpath: on ? 'enable' : 'disable' },
                `${on ? 'Enable' : 'Disable'} SSD Smart Path on array ${arrayId} (slot ${slot})`);

export const arraySsdIoBypass = (slot: string, arrayId: string, on: boolean) =>
    arrayModify(slot, arrayId, { ssdiobypass: on ? 'enable' : 'disable' },
                `${on ? 'Enable' : 'Disable'} SSD I/O bypass on array ${arrayId} (slot ${slot})`);

export const arrayLed = (slot: string, arrayId: string, on: boolean, durationSeconds?: number) =>
    arrayModify(slot, arrayId, { led: on ? 'on' : 'off', duration: on ? durationSeconds : undefined },
                `Turn array ${arrayId} identify LED ${on ? 'on' : 'off'}${on && durationSeconds ? ` for ${durationSeconds}s` : ''} (slot ${slot})`);

export const arrayDelete = (slot: string, arrayId: string, opts: { forced?: boolean } = {}) => {
    const args = [...arrayTarget(slot, arrayId), 'delete'];
    if (opts.forced) args.push('forced');
    return runSsacli(args, `Delete array ${arrayId} on slot ${slot}`);
};

// ---------------------------------------------------------------------------
// Logical drive create — accepts either a controller slot (new array) or
// existing array as the target.
// ---------------------------------------------------------------------------

export interface CreateLdParams {
    type?: 'ld' | 'ldcache' | 'arrayr0' | 'bootarray';
    drives?: string;
    raid?: string;
    size?: string | number;
    stripsize?: string | number;
    sectors?: number;
    caching?: 'enable' | 'disable';
    arrayaccelerator?: 'enable' | 'disable';
    drivetype?: string;
    numberparitygroups?: number;
    parityinitializationmethod?: 'default' | 'rapid';
    ssdiobypass?: 'enable' | 'disable';
    datald?: string;
    writepolicy?: 'writethrough' | 'writeback';
    cachelinesize?: 64 | 256;
    plaintextvolume?: 'yes' | 'no';
    user?: 'crypto' | 'user';
    password?: string;
    ssdoverprovisioningoptimization?: 'on' | 'off';
    volatileencryptionkeys?: 'on' | 'off';
    logicaldrivelabel?: string;
    sedencryption?: 'on' | 'off';
    forced?: boolean;
}

export const createLogicalDrive = (slot: string, params: CreateLdParams, arrayId?: string) => {
    const target = arrayId ? arrayTarget(slot, arrayId) : ctrlTarget(slot);
    const args = [...target, 'create', ...kv({
        type: params.type ?? 'ld',
        drives: params.drives,
        raid: params.raid,
        size: params.size,
        stripsize: params.stripsize,
        sectors: params.sectors,
        caching: params.caching,
        arrayaccelerator: params.arrayaccelerator,
        drivetype: params.drivetype,
        numberparitygroups: params.numberparitygroups,
        parityinitializationmethod: params.parityinitializationmethod,
        ssdiobypass: params.ssdiobypass,
        datald: params.datald,
        writepolicy: params.writepolicy,
        cachelinesize: params.cachelinesize,
        plaintextvolume: params.plaintextvolume,
        user: params.user,
        password: params.password,
        ssdoverprovisioningoptimization: params.ssdoverprovisioningoptimization,
        volatileencryptionkeys: params.volatileencryptionkeys,
        logicaldrivelabel: params.logicaldrivelabel,
        sedencryption: params.sedencryption,
    })];
    if (params.forced) args.push('forced');
    const where = arrayId ? `array ${arrayId} (slot ${slot})` : `controller slot ${slot}`;
    return runSsacli(args, `Create logical drive on ${where}: ${summarize(params as Params)}`);
};

// ---------------------------------------------------------------------------
// Logical drive operations
// ---------------------------------------------------------------------------

export const ldSetCaching = (slot: string, ldId: string, on: boolean) =>
    ldModify(slot, ldId, { caching: on ? 'enable' : 'disable' },
             `${on ? 'Enable' : 'Disable'} caching on logical drive ${ldId} (slot ${slot})`);

export const ldSetArrayAccelerator = (slot: string, ldId: string, on: boolean) =>
    ldModify(slot, ldId, { arrayaccelerator: on ? 'enable' : 'disable' },
             `${on ? 'Enable' : 'Disable'} array accelerator on logical drive ${ldId} (slot ${slot})`);

export const ldSetLed = (slot: string, ldId: string, on: boolean, durationSeconds?: number) =>
    ldModify(slot, ldId, { led: on ? 'on' : 'off', duration: on ? durationSeconds : undefined },
             `Turn logical drive ${ldId} identify LED ${on ? 'on' : 'off'}${on && durationSeconds ? ` for ${durationSeconds}s` : ''} (slot ${slot})`);

export const ldSetLabel = (slot: string, ldId: string, label: string) =>
    ldModify(slot, ldId, { logicaldrivelabel: `"${label}"` },
             `Set label on logical drive ${ldId} to "${label}" (slot ${slot})`);

export const ldResize = (slot: string, ldId: string, size: string | number, forced = false) => {
    const args = [...ldTarget(slot, ldId), 'modify', `size=${size}`];
    if (forced) args.push('forced');
    return runSsacli(args, `Extend logical drive ${ldId} to size ${size} (slot ${slot})`);
};

export const ldMigrate = (slot: string, ldId: string, raid?: string, stripsize?: string | number) =>
    ldModify(slot, ldId, { raid, stripsize },
             `Migrate logical drive ${ldId} to ${raid ? `RAID ${raid}` : 'same RAID'}${stripsize ? `, ${stripsize} KB strip` : ''} (slot ${slot})`);

export const ldMoveToArray = (slot: string, ldId: string, newArrayId: string) =>
    ldModify(slot, ldId, { newarray: newArrayId },
             `Move logical drive ${ldId} to existing array ${newArrayId} (slot ${slot})`);

export const ldMoveToNewArray = (slot: string, ldId: string, drives: string) =>
    ldModify(slot, ldId, { drives },
             `Move logical drive ${ldId} to a new array using drives ${drives} (slot ${slot})`);

export const ldReenable = (slot: string, ldId: string, forced = false) => {
    const args = [...ldTarget(slot, ldId), 'modify', 'reenable'];
    if (forced) args.push('forced');
    return runSsacli(args, `Re-enable failed logical drive ${ldId} on slot ${slot}`);
};

export const ldDelete = (slot: string, ldId: string, opts: { forced?: boolean; override?: boolean } = {}) => {
    const args = [...ldTarget(slot, ldId), 'delete'];
    if (opts.forced) args.push('forced');
    if (opts.override) args.push('override');
    return runSsacli(args, `Delete logical drive ${ldId} on slot ${slot}`);
};

// ---------------------------------------------------------------------------
// Physical drive operations
// ---------------------------------------------------------------------------

export const pdSetLed = (slot: string, pdId: string, on: boolean, durationSeconds?: number) =>
    pdModify(slot, pdId, { led: on ? 'on' : 'off', duration: on ? durationSeconds : undefined },
             `Turn drive ${pdId} identify LED ${on ? 'on' : 'off'}${on && durationSeconds ? ` for ${durationSeconds}s` : ''} (slot ${slot})`);

export type ErasePattern = 'zero' | 'random_zero' | 'random_random_zero' | 'crypto' | 'block' | 'overwrite';

export const pdErase = (slot: string, pdId: string, pattern: ErasePattern, unrestricted?: 'on' | 'off') => {
    const args = [...pdTarget(slot, pdId), 'modify', 'erase', `erasepattern=${pattern}`];
    if (unrestricted) args.push(`unrestricted=${unrestricted}`);
    return runSsacli(args, `Erase drive ${pdId} with pattern=${pattern}${unrestricted ? `, unrestricted=${unrestricted}` : ''} (slot ${slot})`);
};

export const pdStopErase = (slot: string, pdId: string) =>
    runSsacli([...pdTarget(slot, pdId), 'modify', 'stoperase'],
              `Stop erase on drive ${pdId} (slot ${slot})`);

export const pdEnableErasedDrive = (slot: string, pdId: string) =>
    runSsacli([...pdTarget(slot, pdId), 'modify', 'enableeraseddrive'],
              `Mark erased drive ${pdId} as enabled (slot ${slot})`);

// ---------------------------------------------------------------------------
// Enclosure
// ---------------------------------------------------------------------------

export const showEnclosure = (slot: string, encId: string, kind: 'detail' | 'status' = 'detail') =>
    runSsacli([...enclosureTarget(slot, encId), 'show', kind],
              `Show enclosure ${encId} ${kind} on slot ${slot}`);

// ---------------------------------------------------------------------------
// Misc show / diag
// ---------------------------------------------------------------------------

export const showDebugToken = (slot: string) =>
    runSsacli([...ctrlTarget(slot), 'show', 'debugtoken'],
              `Read debug token on controller slot ${slot}`);

export const showSsdInfo = (slot: string) =>
    runSsacli([...ctrlTarget(slot), 'ssdinfo'],
              `Read SSD info on controller slot ${slot}`);

export const showTapeDrives = (slot: string) =>
    runSsacli([...ctrlTarget(slot), 'tapedrive', 'all', 'show'],
              `List tape drives on controller slot ${slot}`);

export const diagController = (slot: string, file: string, opts: { ssdrpt?: boolean; logs?: boolean; xml?: boolean; zip?: boolean } = {}) => {
    const args = [...ctrlTarget(slot), 'diag', `file=${file}`];
    if (opts.ssdrpt !== undefined) args.push(`ssdrpt=${opts.ssdrpt ? 'on' : 'off'}`);
    if (opts.logs !== undefined) args.push(`logs=${opts.logs ? 'on' : 'off'}`);
    if (opts.xml !== undefined) args.push(`xml=${opts.xml ? 'on' : 'off'}`);
    if (opts.zip !== undefined) args.push(`zip=${opts.zip ? 'on' : 'off'}`);
    return runSsacli(args, `Generate diagnostic bundle for controller slot ${slot} into ${file}`);
};

// ---------------------------------------------------------------------------
// Encryption — passthrough wrappers for the most common commands. Encryption
// is a large surface (login/logout, masterkey, expresslocalencryption, SED,
// SPDM, etc.); rare operations should use runSsacliCommandLine().
// ---------------------------------------------------------------------------

export const encEnable = (slot: string, params: { password: string; masterkey: string; localkeymanagermode?: 'on' | 'off'; mixedvolumes?: 'on' | 'off' }) =>
    runSsacli([...ctrlTarget(slot), 'enableencryption', 'encryption=on', 'eula=yes',
        `password=${params.password}`, `masterkey=${params.masterkey}`,
        `localkeymanagermode=${params.localkeymanagermode ?? 'on'}`,
        ...(params.mixedvolumes ? [`mixedvolumes=${params.mixedvolumes}`] : [])],
              `Enable encryption on controller slot ${slot}`);

export const encDisable = (slot: string) =>
    ctrlModify(slot, { encryption: 'off' },
               `Disable encryption on controller slot ${slot}`);

export const encLogin = (slot: string, user: 'crypto' | 'user', password: string) =>
    runSsacli([...ctrlTarget(slot), 'login', `user=${user}`, `password=${password}`],
              `Encryption login as ${user} on controller slot ${slot}`);

export const encLogout = (slot: string) =>
    runSsacli([...ctrlTarget(slot), 'logout'],
              `Encryption logout on controller slot ${slot}`);

export const encSetPassword = (slot: string, suser: 'crypto' | 'user', spassword: string) =>
    runSsacli([...ctrlTarget(slot), 'setpasswd', `suser=${suser}`, `spassword=${spassword}`],
              `Set encryption password for ${suser} on controller slot ${slot}`);

export const encSetMasterKey = (slot: string, masterkey: string) =>
    runSsacli([...ctrlTarget(slot), 'setmasterkey', `masterkey=${masterkey}`],
              `Set encryption master key on controller slot ${slot}`);

export const encClearConfig = (slot: string) =>
    runSsacli([...ctrlTarget(slot), 'clearencryptionconfig'],
              `Clear encryption configuration on controller slot ${slot}`);

export const encFwLock = (slot: string, on: boolean) =>
    ctrlModify(slot, { fwlock: on ? 'on' : 'off' },
               `${on ? 'Enable' : 'Disable'} firmware lock on controller slot ${slot}`);

export const encInstantSecureErase = (slot: string, ldId: string) =>
    runSsacli([...ldTarget(slot, ldId), 'modify', 'instantsecureerase'],
              `Instant secure erase on logical drive ${ldId} (slot ${slot})`);

export const encRekeyController = (slot: string) =>
    runSsacli([...ctrlTarget(slot), 'rekey'],
              `Rekey all logical drives on controller slot ${slot}`);

export const encRekeyLd = (slot: string, ldId: string) =>
    runSsacli([...ldTarget(slot, ldId), 'rekey'],
              `Rekey logical drive ${ldId} on slot ${slot}`);

export const sedSetControllerPassword = (slot: string, password: string, masterkey: string) =>
    runSsacli([...ctrlTarget(slot), 'sedsetcontrollerpassword', `password=${password}`, `masterkey=${masterkey}`],
              `Set SED controller password on slot ${slot}`);

export const sedUnlockControllerPassword = (slot: string, password: string) =>
    runSsacli([...ctrlTarget(slot), 'sedunlockcontrollerpassword', `password=${password}`],
              `Unlock SED controller on slot ${slot}`);

export const sedDeleteControllerPassword = (slot: string, masterkey: string) =>
    runSsacli([...ctrlTarget(slot), 'seddeletecontrollerpassword', `masterkey=${masterkey}`],
              `Delete SED controller password on slot ${slot}`);

export const sedTakeOwnership = (slot: string, drives = 'all') =>
    runSsacli([...ctrlTarget(slot), 'sedtakeownership', `drives=${drives}`],
              `Take SED ownership of drives ${drives} on controller slot ${slot}`);

export const sedRevertToOfs = (slot: string, drives: string) =>
    runSsacli([...ctrlTarget(slot), 'sedreverttoofs', `drives=${drives}`],
              `Revert SEDs ${drives} to factory state on controller slot ${slot}`);

export const sedRevertToOfsWithPsid = (slot: string, pdId: string, psid: string) =>
    runSsacli([...pdTarget(slot, pdId), 'sedreverttoofswithpsid', `PSID=${psid}`],
              `Revert SED ${pdId} to factory state via PSID on slot ${slot}`);

export const securityShow = (slot: string) =>
    runSsacli([...ctrlTarget(slot), 'security', 'show'],
              `Show SPDM security info on controller slot ${slot}`);
