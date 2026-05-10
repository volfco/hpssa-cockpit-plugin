export interface KeyValue {
    [key: string]: string;
}

export interface Sensor {
    id: string;
    location: string;
    currentValue: string;
    maxValue: string;
}

export interface Controller {
    name: string;
    slot: string;
    serialNumber: string;
    status: string;
    firmwareVersion: string;
    driverName: string;
    driverVersion: string;
    temperature: string;
    cacheStatus: string;
    batteryStatus: string;
    controllerMode: string;
    pciAddress: string;
    pcieRate: string;
    portCount: string;
    raid6Status: string;
    encryption: string;
    properties: KeyValue;
    sensors: Sensor[];
}

export interface Enclosure {
    name: string;
    controllerSlot: string;
    status: string;
    type: string;
    port: string;
    box: string;
    boxIndex: string;
    location: string;
    driveBays: string;
    vendorId: string;
    serialNumber: string;
    firmwareVersion: string;
    fanStatus: string;
    temperatureStatus: string;
    powerSupplyStatus: string;
    activePath: string;
    standbyPath: string;
    properties: KeyValue;
    physicalDrives: string[];
}

export interface PhysicalDrive {
    id: string;
    controllerSlot: string;
    port: string;
    box: string;
    bay: string;
    status: string;
    lastFailureReason: string;
    driveType: string;
    interfaceType: string;
    size: string;
    firmwareRevision: string;
    serialNumber: string;
    model: string;
    wwid: string;
    temperature: string;
    maxTemperature: string;
    phyTransferRate: string;
    driveExposedToOS: string;
    diskName: string;
    mountPoints: string;
    sanitizeEraseSupported: string;
    writeCacheStatus: string;
    usageRemaining: string;
    powerOnHours: string;
    estimatedLifeRemaining: string;
    properties: KeyValue;
}

export interface LogicalDrive {
    id: string;
    controllerSlot: string;
    arrayId: string;
    size: string;
    faultTolerance: string;
    status: string;
    stripSize: string;
    fullStripeSize: string;
    caching: string;
    diskName: string;
    mountPoints: string;
    parityInitStatus: string;
    surfaceScanInProgress: string;
    lastSurfaceScanCompleted: string;
    uniqueIdentifier: string;
    driveType: string;
    accelerationMethod: string;
    properties: KeyValue;
}

export interface ArrayInfo {
    id: string;
    controllerSlot: string;
    arrayType: string;
    unusedSpace: string;
    logicalDrives: LogicalDrive[];
    physicalDrives: PhysicalDrive[];
}

export interface SystemOverview {
    controllers: Controller[];
    enclosures: Enclosure[];
    arrays: ArrayInfo[];
    logicalDrives: LogicalDrive[];
    physicalDrives: PhysicalDrive[];
}

export type ViewLevel = 'dashboard' | 'controller' | 'array' | 'logicaldrive' | 'physicaldrive' | 'enclosure' | 'commandlog';

export interface ViewState {
    level: ViewLevel;
    controllerSlot?: string;
    arrayId?: string;
    logicalDriveId?: string;
    physicalDriveId?: string;
    enclosureKey?: string;
}
