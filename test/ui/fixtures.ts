// Representative hardware data for the isolated browser check. Never invokes ssacli.
import type { Controller, PhysicalDrive, LogicalDrive, Enclosure, SystemOverview } from '../../src/types';

const controller: Controller = {
    name: 'HPE Smart Array P408i-p SR Gen10', slot: '1', serialNumber: 'PFJHD0ARCD017R',
    status: 'OK', firmwareVersion: '7.00', driverName: 'smartpqi Linux', driverVersion: '2.1.30-031',
    temperature: '42', cacheStatus: 'Not Configured', batteryStatus: 'OK', controllerMode: 'Mixed',
    pciAddress: '0000:3b:00.0', pcieRate: '8 GT/s', portCount: '2', raid6Status: 'Enabled',
    encryption: 'Disabled', properties: { 'Cache Ratio': '10% Read / 90% Write', 'Long diagnostic property': 'value-'.repeat(30) },
    sensors: [{ id: '0', location: 'Controller', currentValue: '42 C', maxValue: '85 C' }],
};
const drive: PhysicalDrive = {
    id: '1I:1:1', controllerSlot: '1', port: '1I', box: '1', bay: '1', status: 'OK',
    lastFailureReason: '', driveType: 'Data Drive', interfaceType: 'SAS', size: '1.2 TB',
    firmwareRevision: 'HPD5', serialNumber: 'LONG-SERIAL-12345678901234567890', model: 'HPE Enterprise SAS 12G',
    wwid: '5000C50012345678', temperature: '31', maxTemperature: '45', phyTransferRate: '12.0 Gb/s',
    driveExposedToOS: 'False', diskName: '/dev/sda', mountPoints: '/var/lib/storage', sanitizeEraseSupported: 'True',
    writeCacheStatus: 'Disabled', usageRemaining: '95%', powerOnHours: '12000', estimatedLifeRemaining: '5 years',
    properties: { 'Diagnostic value': 'detail-'.repeat(30) },
};
const logicalDrive: LogicalDrive = {
    id: '1', controllerSlot: '1', arrayId: 'A', size: '1.2 TB', faultTolerance: '1', status: 'OK',
    stripSize: '256 KB', fullStripeSize: '256 KB', caching: 'Enabled', diskName: '/dev/sda', mountPoints: '/',
    parityInitStatus: 'Completed', surfaceScanInProgress: 'False', lastSurfaceScanCompleted: '',
    uniqueIdentifier: '600508B1001C', driveType: 'Data', accelerationMethod: 'Controller Cache', properties: {},
};
const enclosure: Enclosure = {
    name: 'HP D3700 Enclosure', controllerSlot: '1', status: 'OK', type: 'External', port: '3E', box: '1',
    boxIndex: '2', location: 'Port 3E, Box 1', driveBays: '25', vendorId: 'HP', serialNumber: 'ENC123456',
    firmwareVersion: '4.12', fanStatus: 'OK', temperatureStatus: 'OK', powerSupplyStatus: 'OK',
    activePath: '', standbyPath: '', properties: {}, physicalDrives: ['1I:1:1', '1I:1:2'],
};
export const overview: SystemOverview = {
    controllers: [{ ...controller, slot: '0', name: 'HPE Smart Array E208i-a SR Gen10', cacheStatus: '', batteryStatus: '', controllerMode: 'HBA' }, controller],
    physicalDrives: [drive, { ...drive, id: '1I:1:2', bay: '2' }, { ...drive, id: '2I:1:1', port: '2I', driveType: 'HBA Drive' }],
    logicalDrives: [logicalDrive], enclosures: [enclosure],
    arrays: [{ id: 'A', controllerSlot: '1', arrayType: 'Data', unusedSpace: '0 MB', logicalDrives: [logicalDrive], physicalDrives: [drive] }],
};
export default {
    gettext: (s: string) => s,
    format: (s: string, ...args: string[]) => s.replace(/\$(\d+)/g, (_match, i) => args[Number(i)] ?? ''),
    spawn: () => Promise.resolve('Mock command completed successfully.\n' + 'output '.repeat(80)),
};
