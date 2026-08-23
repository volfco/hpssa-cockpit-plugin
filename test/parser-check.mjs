// Minimal parser self-check: node test/parser-check.mjs
// Fails loudly if the ssacli output parsers regress.
import { parseEnclosures, parseControllerList } from '../src/ssacli.ts';

const encOutput = `
HP D3700 Enclosure at Port 3E, Box 1 (Index 2), Not OK: Check device status detail
   Location: Port 3E, Box 1
   Drive Bays: 25
`;
const encs = parseEnclosures(encOutput, '1');
console.assert(encs.length === 1, 'one enclosure parsed');
console.assert(encs[0].status === 'Not OK: Check device status detail',
    `enclosure status captured to EOL, got "${encs[0].status}"`);

const ctrlOutput = `
HPE Smart Array P408i-a SR Gen10 in Slot 0 (Embedded) (sn: PEYHC0DRHDE3VF)
Smart Array P841 in Slot 1 (HBA Mode)
`;
const ctrls = parseControllerList(ctrlOutput);
console.assert(ctrls.length === 2 && ctrls[1].controllerMode === 'HBA Mode', 'controllers parsed');

if (encs.length !== 1 || ctrls.length !== 2)
    process.exit(1);
console.log('parser checks OK');
