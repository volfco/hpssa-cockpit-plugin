import type {
    Controller, Enclosure, PhysicalDrive, LogicalDrive,
    ArrayInfo, Sensor, KeyValue
} from './types';

function parseProperties(lines: string[]): KeyValue {
    const props: KeyValue = {};
    for (const line of lines) {
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
            const key = line.substring(0, colonIdx).trim();
            const value = line.substring(colonIdx + 1).trim();
            if (key && value !== undefined) {
                props[key] = value;
            }
        }
    }
    return props;
}

function getIndentLevel(line: string): number {
    let count = 0;
    for (let i = 0; i < line.length; i++) {
        if (line[i] === ' ') count++;
        else if (line[i] === '\t') count += 4;
        else break;
    }
    return count;
}

export function parseControllerList(output: string): Controller[] {
    const controllers: Controller[] = [];
    const lines = output.split('\n').filter(l => l.trim());

    for (const line of lines) {
        const trimmed = line.trim();
        const match = trimmed.match(/^(.+?)\s+in\s+Slot\s+(\d+)(?:\s+\((\w+)\))?\s*(?:\(sn:\s*(\S+)\))?/);
        if (match) {
            controllers.push({
                name: match[1].trim(),
                slot: match[2],
                serialNumber: match[4] || '',
                status: '',
                firmwareVersion: '',
                driverName: '',
                driverVersion: '',
                temperature: '',
                cacheStatus: '',
                batteryStatus: '',
                controllerMode: match[3] || '',
                pciAddress: '',
                pcieRate: '',
                portCount: '',
                raid6Status: '',
                encryption: '',
                properties: {},
                sensors: [],
            });
        }
    }
    return controllers;
}

export function parseControllerDetail(output: string): Controller | null {
    const lines = output.split('\n');
    if (lines.length < 2) return null;

    const headerLine = lines.find(l => l.includes('Slot')) || lines[0];
    const nameMatch = headerLine.match(/^(.+?)\s+in\s+Slot\s+(\d+)/);
    if (!nameMatch) return null;

    const modeMatch = headerLine.match(/\((\w+)\)/);
    const propLines: string[] = [];
    const sensors: Sensor[] = [];
    let currentSensor: Partial<Sensor> = {};

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;

        const indent = getIndentLevel(line);
        const trimmed = line.trim();

        if (trimmed.startsWith('Sensor ID:')) {
            if (currentSensor.id) sensors.push(currentSensor as Sensor);
            currentSensor = { id: trimmed.split(':')[1].trim() };
            continue;
        }

        if (currentSensor.id && !currentSensor.location && trimmed.startsWith('Location:')) {
            currentSensor.location = trimmed.split(':')[1].trim();
            continue;
        }
        if (currentSensor.id && trimmed.startsWith('Current Value')) {
            currentSensor.currentValue = trimmed.split(':')[1].trim();
            continue;
        }
        if (currentSensor.id && trimmed.startsWith('Max Value')) {
            currentSensor.maxValue = trimmed.split(':')[1].trim();
            continue;
        }

        if (indent >= 3 && trimmed.includes(':')) {
            propLines.push(trimmed);
        }
    }
    if (currentSensor.id) sensors.push(currentSensor as Sensor);

    const props = parseProperties(propLines);

    return {
        name: nameMatch[1].trim(),
        slot: nameMatch[2],
        serialNumber: props['Serial Number'] || '',
        status: props['Controller Status'] || '',
        firmwareVersion: props['Firmware Version'] || '',
        driverName: props['Driver Name'] || '',
        driverVersion: props['Driver Version'] || '',
        temperature: props['Controller Temperature (C)'] || '',
        cacheStatus: props['Cache Status'] || '',
        batteryStatus: props['Battery/Capacitor Status'] || '',
        controllerMode: modeMatch ? modeMatch[1] : (props['Controller Mode'] || ''),
        pciAddress: props['PCI Address (Domain:Bus:Device.Function)'] || '',
        pcieRate: props['Negotiated PCIe Data Rate'] || '',
        portCount: props['Number of Ports'] || '',
        raid6Status: props['RAID 6 Status'] || '',
        encryption: props.Encryption || '',
        properties: props,
        sensors,
    };
}

export function parsePhysicalDrives(output: string, controllerSlot: string): PhysicalDrive[] {
    const drives: PhysicalDrive[] = [];
    const lines = output.split('\n');
    let currentDrive: Partial<PhysicalDrive> | null = null;

    const saveCurrent = () => {
        if (currentDrive && currentDrive.id) {
            drives.push({
                id: currentDrive.id || '',
                controllerSlot,
                port: currentDrive.port || '',
                box: currentDrive.box || '',
                bay: currentDrive.bay || '',
                status: currentDrive.status || '',
                lastFailureReason: currentDrive.lastFailureReason || '',
                driveType: currentDrive.driveType || '',
                interfaceType: currentDrive.interfaceType || '',
                size: currentDrive.size || '',
                firmwareRevision: currentDrive.firmwareRevision || '',
                serialNumber: currentDrive.serialNumber || '',
                model: currentDrive.model || '',
                wwid: currentDrive.wwid || '',
                temperature: currentDrive.temperature || '',
                maxTemperature: currentDrive.maxTemperature || '',
                phyTransferRate: currentDrive.phyTransferRate || '',
                driveExposedToOS: currentDrive.driveExposedToOS || '',
                diskName: currentDrive.diskName || '',
                mountPoints: currentDrive.mountPoints || '',
                sanitizeEraseSupported: currentDrive.sanitizeEraseSupported || '',
                writeCacheStatus: currentDrive.writeCacheStatus || '',
                usageRemaining: currentDrive.usageRemaining || '',
                powerOnHours: currentDrive.powerOnHours || '',
                estimatedLifeRemaining: currentDrive.estimatedLifeRemaining || '',
                properties: currentDrive.properties || {},
            });
        }
    };

    for (const line of lines) {
        if (!line.trim()) continue;
        const indent = getIndentLevel(line);
        const trimmed = line.trim();

        if (trimmed.match(/^physicaldrive\s+/i) && indent <= 6) {
            saveCurrent();
            const idMatch = trimmed.match(/^physicaldrive\s+(\S+)/i);
            currentDrive = {
                id: idMatch ? idMatch[1] : '',
                properties: {},
            };
            continue;
        }

        if (!currentDrive) continue;

        const colonIdx = trimmed.indexOf(':');
        if (colonIdx > 0) {
            const key = trimmed.substring(0, colonIdx).trim();
            const value = trimmed.substring(colonIdx + 1).trim();

            switch (key) {
            case 'Port': currentDrive.port = value; break;
            case 'Box': currentDrive.box = value; break;
            case 'Bay': currentDrive.bay = value; break;
            case 'Status': currentDrive.status = value; break;
            case 'Last Failure Reason': currentDrive.lastFailureReason = value; break;
            case 'Drive Type': currentDrive.driveType = value; break;
            case 'Interface Type': currentDrive.interfaceType = value; break;
            case 'Size': currentDrive.size = value; break;
            case 'Firmware Revision': currentDrive.firmwareRevision = value; break;
            case 'Serial Number': currentDrive.serialNumber = value; break;
            case 'Model': currentDrive.model = value; break;
            case 'WWID': currentDrive.wwid = value; break;
            case 'Current Temperature (C)': currentDrive.temperature = value; break;
            case 'Maximum Temperature (C)': currentDrive.maxTemperature = value; break;
            case 'PHY Transfer Rate': currentDrive.phyTransferRate = value; break;
            case 'Drive exposed to OS': currentDrive.driveExposedToOS = value; break;
            case 'Disk Name': currentDrive.diskName = value; break;
            case 'Mount Points': currentDrive.mountPoints = value; break;
            case 'Sanitize Erase Supported': currentDrive.sanitizeEraseSupported = value; break;
            case 'Write Cache Status': currentDrive.writeCacheStatus = value; break;
            case 'Usage remaining': currentDrive.usageRemaining = value; break;
            case 'Power On Hours': currentDrive.powerOnHours = value; break;
            case 'Estimated Life Remaining based on workload to date':
                currentDrive.estimatedLifeRemaining = value; break;
            default:
                if (currentDrive.properties) currentDrive.properties[key] = value;
            }
        }
    }
    saveCurrent();
    return drives;
}

export function parseLogicalDrives(output: string, controllerSlot: string): LogicalDrive[] {
    const drives: LogicalDrive[] = [];
    const lines = output.split('\n');
    let currentDrive: Partial<LogicalDrive> | null = null;
    let currentArrayId = '';

    const saveCurrent = () => {
        if (currentDrive && currentDrive.id) {
            drives.push({
                id: currentDrive.id || '',
                controllerSlot,
                arrayId: currentDrive.arrayId || currentArrayId,
                size: currentDrive.size || '',
                faultTolerance: currentDrive.faultTolerance || '',
                status: currentDrive.status || '',
                stripSize: currentDrive.stripSize || '',
                fullStripeSize: currentDrive.fullStripeSize || '',
                caching: currentDrive.caching || '',
                diskName: currentDrive.diskName || '',
                mountPoints: currentDrive.mountPoints || '',
                parityInitStatus: currentDrive.parityInitStatus || '',
                surfaceScanInProgress: currentDrive.surfaceScanInProgress || '',
                lastSurfaceScanCompleted: currentDrive.lastSurfaceScanCompleted || '',
                uniqueIdentifier: currentDrive.uniqueIdentifier || '',
                driveType: currentDrive.driveType || '',
                accelerationMethod: currentDrive.accelerationMethod || '',
                properties: currentDrive.properties || {},
            });
        }
    };

    for (const line of lines) {
        if (!line.trim()) continue;
        const indent = getIndentLevel(line);
        const trimmed = line.trim();

        if (trimmed.match(/^Array\s+[A-Z]/) && indent <= 3) {
            const arrayMatch = trimmed.match(/^Array\s+([A-Z]+)/);
            if (arrayMatch) currentArrayId = arrayMatch[1];
            continue;
        }

        if (trimmed.match(/^Logical Drive:\s+/i)) {
            saveCurrent();
            const idMatch = trimmed.match(/^Logical Drive:\s+(\S+)/i);
            currentDrive = {
                id: idMatch ? idMatch[1] : '',
                arrayId: currentArrayId,
                properties: {},
            };
            continue;
        }

        if (!currentDrive) continue;

        const colonIdx = trimmed.indexOf(':');
        if (colonIdx > 0) {
            const key = trimmed.substring(0, colonIdx).trim();
            const value = trimmed.substring(colonIdx + 1).trim();

            switch (key) {
            case 'Size': currentDrive.size = value; break;
            case 'Fault Tolerance': currentDrive.faultTolerance = value; break;
            case 'Status': currentDrive.status = value; break;
            case 'Strip Size': currentDrive.stripSize = value; break;
            case 'Full Stripe Size': currentDrive.fullStripeSize = value; break;
            case 'Caching': currentDrive.caching = value; break;
            case 'Disk Name': currentDrive.diskName = value; break;
            case 'Mount Points': currentDrive.mountPoints = value; break;
            case 'Parity Initialization Status': currentDrive.parityInitStatus = value; break;
            case 'Surface Scan In Progress': currentDrive.surfaceScanInProgress = value; break;
            case 'Last Surface Scan Completed': currentDrive.lastSurfaceScanCompleted = value; break;
            case 'Unique Identifier': currentDrive.uniqueIdentifier = value; break;
            case 'Drive Type': currentDrive.driveType = value; break;
            case 'LD Acceleration Method': currentDrive.accelerationMethod = value; break;
            default:
                if (currentDrive.properties) currentDrive.properties[key] = value;
            }
        }
    }
    saveCurrent();
    return drives;
}

export function parseEnclosures(output: string, controllerSlot: string): Enclosure[] {
    const enclosures: Enclosure[] = [];
    const lines = output.split('\n');
    let currentEnc: Partial<Enclosure> | null = null;
    let collectingDrives = false;

    const saveCurrent = () => {
        if (currentEnc && currentEnc.name) {
            enclosures.push({
                name: currentEnc.name || '',
                controllerSlot,
                status: currentEnc.status || '',
                type: currentEnc.type || '',
                port: currentEnc.port || '',
                box: currentEnc.box || '',
                boxIndex: currentEnc.boxIndex || '',
                location: currentEnc.location || '',
                driveBays: currentEnc.driveBays || '',
                vendorId: currentEnc.vendorId || '',
                serialNumber: currentEnc.serialNumber || '',
                firmwareVersion: currentEnc.firmwareVersion || '',
                fanStatus: currentEnc.fanStatus || '',
                temperatureStatus: currentEnc.temperatureStatus || '',
                powerSupplyStatus: currentEnc.powerSupplyStatus || '',
                activePath: currentEnc.activePath || '',
                standbyPath: currentEnc.standbyPath || '',
                properties: currentEnc.properties || {},
                physicalDrives: currentEnc.physicalDrives || [],
            });
        }
    };

    for (const line of lines) {
        if (!line.trim()) continue;
        const indent = getIndentLevel(line);
        const trimmed = line.trim();

        if (trimmed.match(/Enclosure.*at Port/) && indent <= 3) {
            saveCurrent();
            collectingDrives = false;
            const nameMatch = trimmed.match(/^(.+?)\s+at\s+Port\s+(\S+),\s*Box\s+(\d+)\s+\(Index\s+(\d+)\),\s*(\S+)/);
            if (nameMatch) {
                currentEnc = {
                    name: nameMatch[1].trim(),
                    port: nameMatch[2],
                    box: nameMatch[3],
                    boxIndex: nameMatch[4],
                    status: nameMatch[5],
                    type: trimmed.includes('Internal') ? 'Internal' : 'External',
                    properties: {},
                    physicalDrives: [],
                };
            }
            continue;
        }

        if (trimmed === 'Physical Drives') {
            collectingDrives = true;
            continue;
        }

        if (collectingDrives && trimmed.match(/^physicaldrive\s+/i)) {
            const pdMatch = trimmed.match(/^physicaldrive\s+(\S+)/i);
            if (pdMatch && currentEnc) {
                if (!currentEnc.physicalDrives) currentEnc.physicalDrives = [];
                currentEnc.physicalDrives.push(pdMatch[1]);
            }
            continue;
        }

        if (!currentEnc) continue;

        if (collectingDrives && indent < 6 && !trimmed.match(/^physicaldrive/i)) {
            collectingDrives = false;
        }

        const colonIdx = trimmed.indexOf(':');
        if (colonIdx > 0 && !collectingDrives) {
            const key = trimmed.substring(0, colonIdx).trim();
            const value = trimmed.substring(colonIdx + 1).trim();

            switch (key) {
            case 'Location': currentEnc.location = value; break;
            case 'Drive Bays': currentEnc.driveBays = value; break;
            case 'Vendor ID': currentEnc.vendorId = value; break;
            case 'Serial Number': currentEnc.serialNumber = value; break;
            case 'Firmware Version': currentEnc.firmwareVersion = value; break;
            case 'Fan Status': currentEnc.fanStatus = value; break;
            case 'Temperature Status': currentEnc.temperatureStatus = value; break;
            case 'Power Supply Status': currentEnc.powerSupplyStatus = value; break;
            case 'Active Path': currentEnc.activePath = value; break;
            case 'Standby Path': currentEnc.standbyPath = value; break;
            default:
                if (currentEnc.properties) currentEnc.properties[key] = value;
            }
        }
    }
    saveCurrent();
    return enclosures;
}

export function parseConfigOverview(output: string, controllerSlot: string): {
    arrays: ArrayInfo[];
    physicalDrives: PhysicalDrive[];
} {
    const arrays: ArrayInfo[] = [];
    const physicalDrives: PhysicalDrive[] = [];
    const lines = output.split('\n');
    let currentArray: { id: string; type: string; unusedSpace: string; lds: string[]; pds: string[] } | null = null;
    let inHbaDrives = false;

    const saveArray = () => {
        if (currentArray) {
            arrays.push({
                id: currentArray.id,
                controllerSlot,
                arrayType: currentArray.type,
                unusedSpace: currentArray.unusedSpace,
                logicalDrives: currentArray.lds.map(ld => ({
                    id: ld,
                    controllerSlot,
                    arrayId: currentArray!.id,
                    size: '',
                    faultTolerance: '',
                    status: '',
                    stripSize: '',
                    fullStripeSize: '',
                    caching: '',
                    diskName: '',
                    mountPoints: '',
                    parityInitStatus: '',
                    surfaceScanInProgress: '',
                    lastSurfaceScanCompleted: '',
                    uniqueIdentifier: '',
                    driveType: '',
                    accelerationMethod: '',
                    properties: {},
                })),
                physicalDrives: currentArray.pds.map(pd => ({
                    id: pd,
                    controllerSlot,
                    port: '',
                    box: '',
                    bay: '',
                    status: '',
                    lastFailureReason: '',
                    driveType: '',
                    interfaceType: '',
                    size: '',
                    firmwareRevision: '',
                    serialNumber: '',
                    model: '',
                    wwid: '',
                    temperature: '',
                    maxTemperature: '',
                    phyTransferRate: '',
                    driveExposedToOS: '',
                    diskName: '',
                    mountPoints: '',
                    sanitizeEraseSupported: '',
                    writeCacheStatus: '',
                    usageRemaining: '',
                    powerOnHours: '',
                    estimatedLifeRemaining: '',
                    properties: {},
                })),
            });
        }
    };

    for (const line of lines) {
        if (!line.trim()) continue;
        const trimmed = line.trim();

        const arrayMatch = trimmed.match(/^Array\s+([A-Z]+)\s+\((.+?),\s*Unused Space:\s*(.+?)\)/);
        if (arrayMatch) {
            saveArray();
            inHbaDrives = false;
            currentArray = {
                id: arrayMatch[1],
                type: arrayMatch[2],
                unusedSpace: arrayMatch[3],
                lds: [],
                pds: [],
            };
            continue;
        }

        if (trimmed === 'HBA Drives') {
            inHbaDrives = true;
            continue;
        }
        if (trimmed === 'Pending HBA Drives') {
            inHbaDrives = true;
            continue;
        }

        const ldMatch = trimmed.match(/^logicaldrive\s+(\S+)\s+\((.+?)\)/);
        if (ldMatch && currentArray) {
            currentArray.lds.push(ldMatch[1]);
            continue;
        }

        const pdMatch = trimmed.match(/^physicaldrive\s+(\S+)\s+\((.+?)\)/);
        if (pdMatch) {
            const parts = pdMatch[2].split(',').map(s => s.trim());
            const pd: PhysicalDrive = {
                id: pdMatch[1],
                controllerSlot,
                port: parts[0]?.match(/port\s+(\S+)/)?.[1] || '',
                box: parts[0]?.match(/box\s+(\S+)/)?.[1] || '',
                bay: parts[0]?.match(/bay\s+(\S+)/)?.[1] || '',
                interfaceType: parts[1] || '',
                size: parts[2] || '',
                status: parts[3] || '',
                lastFailureReason: '',
                driveType: inHbaDrives ? 'HBA Mode Drive' : 'Data Drive',
                firmwareRevision: '',
                serialNumber: '',
                model: '',
                wwid: '',
                temperature: '',
                maxTemperature: '',
                phyTransferRate: '',
                driveExposedToOS: '',
                diskName: '',
                mountPoints: '',
                sanitizeEraseSupported: '',
                writeCacheStatus: '',
                usageRemaining: '',
                powerOnHours: '',
                estimatedLifeRemaining: '',
                properties: {},
            };

            if (currentArray && !inHbaDrives) {
                currentArray.pds.push(pdMatch[1]);
            } else {
                physicalDrives.push(pd);
            }
            continue;
        }
    }
    saveArray();

    return { arrays, physicalDrives };
}
