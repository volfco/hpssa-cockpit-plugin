import React from 'react';
import { Alert } from "@patternfly/react-core/dist/esm/components/Alert/index.js";
import { Card, CardBody, CardHeader } from "@patternfly/react-core/dist/esm/components/Card/index.js";
import { DescriptionList, DescriptionListGroup, DescriptionListTerm, DescriptionListDescription } from "@patternfly/react-core/dist/esm/components/DescriptionList/index.js";
import { Label } from "@patternfly/react-core/dist/esm/components/Label/index.js";
import { LabelGroup } from "@patternfly/react-core/dist/esm/components/Label/LabelGroup.js";
import { ExpandableSection } from "@patternfly/react-core/dist/esm/components/ExpandableSection/index.js";
import { EmptyState, EmptyStateBody } from "@patternfly/react-core/dist/esm/components/EmptyState/index.js";
import { Gallery } from "@patternfly/react-core/dist/esm/layouts/Gallery/index.js";
import { Flex, FlexItem } from "@patternfly/react-core/dist/esm/layouts/Flex/index.js";
import { Stack, StackItem } from "@patternfly/react-core/dist/esm/layouts/Stack/index.js";
import { Button } from "@patternfly/react-core/dist/esm/components/Button/index.js";
import { Spinner } from "@patternfly/react-core/dist/esm/components/Spinner/index.js";
import { Page, PageSection } from "@patternfly/react-core/dist/esm/components/Page/index.js";
import { Nav, NavItem, NavList } from "@patternfly/react-core/dist/esm/components/Nav/index.js";
import { Title } from "@patternfly/react-core/dist/esm/components/Title/index.js";
import { Badge } from "@patternfly/react-core/dist/esm/components/Badge/index.js";
import { Breadcrumb, BreadcrumbItem } from "@patternfly/react-core/dist/esm/components/Breadcrumb/index.js";
import { Tab, Tabs, TabTitleText } from "@patternfly/react-core/dist/esm/components/Tabs/index.js";

import AngleDownIcon from "@patternfly/react-icons/dist/esm/icons/angle-down-icon.js";
import AngleRightIcon from "@patternfly/react-icons/dist/esm/icons/angle-right-icon.js";
import HddIcon from "@patternfly/react-icons/dist/esm/icons/hdd-icon.js";
import SearchIcon from "@patternfly/react-icons/dist/esm/icons/search-icon.js";
import CubeIcon from "@patternfly/react-icons/dist/esm/icons/cube-icon.js";
import ServerIcon from "@patternfly/react-icons/dist/esm/icons/server-icon.js";
import StorageDomainIcon from "@patternfly/react-icons/dist/esm/icons/storage-domain-icon.js";
import ContainerNodeIcon from "@patternfly/react-icons/dist/esm/icons/container-node-icon.js";
import InProgressIcon from "@patternfly/react-icons/dist/esm/icons/in-progress-icon.js";
import OkIcon from "@patternfly/react-icons/dist/esm/icons/ok-icon.js";
import WarningTriangleIcon from "@patternfly/react-icons/dist/esm/icons/warning-triangle-icon.js";
import ErrorCircleOIcon from "@patternfly/react-icons/dist/esm/icons/error-circle-o-icon.js";
import SyncIcon from "@patternfly/react-icons/dist/esm/icons/sync-icon.js";

import cockpit from 'cockpit';
import type { SystemOverview, Controller, Enclosure, LogicalDrive, PhysicalDrive, ViewState, KeyValue, Sensor } from './types';
import { fetchOverview, rescanController, rescanAll, runSsacliCommandLine, getCommandLog, subscribeCommandLog } from './service';
import {
    ActionMenu, useDialogs,
    controllerActions, controllerSettingDefs,
    arrayActions, ldActions, pdActions,
} from './components/actions';
import { RawCommandDialog } from './components/dialogs';
import { SettingsPage } from './components/settingsPage';
import { CommandLog } from './components/commandLog';

const _ = cockpit.gettext;

type PFColor = 'blue' | 'green' | 'grey' | 'orange' | 'orangered' | 'purple' | 'red' | 'teal' | 'yellow';

function statusColor(status: string): PFColor {
    const s = status.toLowerCase();
    if (s === 'ok' || s === 'enabled' || s === 'redundant' || s === 'completed') return 'green';
    if (s === 'degraded' || s === 'rebuilding' || s === 'expanding' || s.includes('progress')) return 'orange';
    if (s.startsWith('not ok') || s.includes('critical') || s === 'failed' || s === 'error' || s === 'not configured') return 'red';
    return 'grey';
}

function statusIcon(status: string) {
    const s = status.toLowerCase();
    if (s === 'ok' || s === 'enabled' || s === 'redundant') return <OkIcon />;
    if (s.includes('progress') || s === 'rebuilding') return <InProgressIcon />;
    if (s === 'degraded' || s === 'expanding') return <WarningTriangleIcon />;
    if (s.startsWith('not ok') || s.includes('critical') || s === 'failed' || s === 'error') return <ErrorCircleOIcon />;
    return undefined;
}

function StatusLabel({ status }: { status: string }) {
    if (!status) return <span className="pf-v6-u-color-200">—</span>;
    return (
        <Label
            color={statusColor(status)}
            icon={statusIcon(status)}
        >
            {status}
        </Label>
    );
}

// Screen-reader-only caption for the hand-built PF tables (no
// @patternfly/react-table dependency available).
function TableCaption({ text }: { text: string }) {
    return <caption className="pf-v6-u-screen-reader">{text}</caption>;
}

// Enter/Space activation for clickable table rows.
function rowKeyboardSelect(onActivate: () => void) {
    return (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onActivate();
        }
    };
}

function PropertyTable({ properties }: { properties: KeyValue }) {
    const entries = Object.entries(properties);
    if (entries.length === 0) return null;

    return (
        <div className="hpssa-table-region" role="region" aria-label={_("Properties")} tabIndex={0}>
            <table className="pf-v6-c-table pf-m-compact hpssa-property-table" aria-label={_("Properties")}>
                <TableCaption text={_("Properties")} />
                <tbody className="pf-v6-c-table__tbody">
                    {entries.map(([key, value]) => (
                        <tr className="pf-v6-c-table__tr" key={key}>
                            <th className="pf-v6-c-table__th" scope="row">{key}</th>
                            <td className="pf-v6-c-table__td">{value}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function SensorTable({ sensors }: { sensors: Sensor[] }) {
    if (sensors.length === 0) return null;

    return (
        <>
            <Title headingLevel="h4" size="md" className="pf-v6-u-mt-md">{_("Sensors")}</Title>
            <div className="hpssa-table-region" role="region" aria-label={_("Sensors")} tabIndex={0}>
                <table className="pf-v6-c-table pf-m-compact pf-m-grid-lg" aria-label={_("Sensors")}>
                    <TableCaption text={_("Sensors")} />
                    <thead className="pf-v6-c-table__thead">
                        <tr className="pf-v6-c-table__tr">
                            <th className="pf-v6-c-table__th" scope="col">{_("ID")}</th>
                            <th className="pf-v6-c-table__th" scope="col">{_("Location")}</th>
                            <th className="pf-v6-c-table__th" scope="col">{_("Current")}</th>
                            <th className="pf-v6-c-table__th" scope="col">{_("Max")}</th>
                        </tr>
                    </thead>
                    <tbody className="pf-v6-c-table__tbody">
                        {sensors.map(s => (
                            <tr className="pf-v6-c-table__tr" key={s.id}>
                                <td className="pf-v6-c-table__td" data-label={_("ID")}>{s.id}</td>
                                <td className="pf-v6-c-table__td" data-label={_("Location")}>{s.location}</td>
                                <td className="pf-v6-c-table__td" data-label={_("Current")}>{s.currentValue}</td>
                                <td className="pf-v6-c-table__td" data-label={_("Max")}>{s.maxValue}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </>
    );
}

function StatusOverviewTable({ controllers, overview, onSelect }: {
    controllers: Controller[];
    overview: SystemOverview;
    onSelect: (slot: string) => void;
}) {
    return (
        <div className="hpssa-table-region" role="region" aria-label={_("Quick status")} tabIndex={0}>
            <table className="pf-v6-c-table pf-m-compact pf-m-grid-lg" aria-label={_("Quick status")}>
                <TableCaption text={_("Quick status")} />
                <thead className="pf-v6-c-table__thead">
                    <tr className="pf-v6-c-table__tr">
                        <th className="pf-v6-c-table__th" scope="col">{_("Controller")}</th>
                        <th className="pf-v6-c-table__th" scope="col">{_("Controller Status")}</th>
                        <th className="pf-v6-c-table__th" scope="col">{_("Cache")}</th>
                        <th className="pf-v6-c-table__th" scope="col">{_("Battery")}</th>
                        <th className="pf-v6-c-table__th" scope="col">{_("Arrays")}</th>
                        <th className="pf-v6-c-table__th" scope="col">{_("Logical Drives")}</th>
                        <th className="pf-v6-c-table__th" scope="col">{_("Physical Drives")}</th>
                        <th className="pf-v6-c-table__th" scope="col">{_("Enclosures")}</th>
                    </tr>
                </thead>
                <tbody className="pf-v6-c-table__tbody">
                    {controllers.map(c => {
                        const arrs = overview.arrays.filter(a => a.controllerSlot === c.slot);
                        const lds = overview.logicalDrives.filter(ld => ld.controllerSlot === c.slot);
                        const pds = overview.physicalDrives.filter(pd => pd.controllerSlot === c.slot);
                        const encs = overview.enclosures.filter(e => e.controllerSlot === c.slot);
                        return (
                            <tr
                                className="pf-v6-c-table__tr pf-m-clickable"
                                key={c.slot}
                                tabIndex={0}
                                aria-label={cockpit.format(_("Open controller $0"), c.name)}
                                onClick={() => onSelect(c.slot)}
                                onKeyDown={rowKeyboardSelect(() => onSelect(c.slot))}
                            >
                                <td className="pf-v6-c-table__td" data-label={_("Controller")}>{c.name} (Slot {c.slot})</td>
                                <td className="pf-v6-c-table__td" data-label={_("Controller Status")}><StatusLabel status={c.status} /></td>
                                <td className="pf-v6-c-table__td" data-label={_("Cache")}><StatusLabel status={c.cacheStatus} /></td>
                                <td className="pf-v6-c-table__td" data-label={_("Battery")}><StatusLabel status={c.batteryStatus} /></td>
                                <td className="pf-v6-c-table__td" data-label={_("Arrays")}><Badge isRead>{arrs.length}</Badge></td>
                                <td className="pf-v6-c-table__td" data-label={_("Logical Drives")}><Badge isRead>{lds.length}</Badge></td>
                                <td className="pf-v6-c-table__td" data-label={_("Physical Drives")}><Badge isRead>{pds.length}</Badge></td>
                                <td className="pf-v6-c-table__td" data-label={_("Enclosures")}><Badge isRead>{encs.length}</Badge></td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

function PhysicalDriveDetails({ pd }: { pd: PhysicalDrive }) {
    const detail = (term: string, value?: string) => {
        if (!value) return null;
        return (
            <DescriptionListGroup>
                <DescriptionListTerm>{term}</DescriptionListTerm>
                <DescriptionListDescription>{value}</DescriptionListDescription>
            </DescriptionListGroup>
        );
    };

    return (
        <div className="hpssa-pd-details">
            <DescriptionList isHorizontal isCompact columnModifier={{ default: '1Col', md: '2Col', xl: '3Col' }}>
                {detail(_("Firmware"), pd.firmwareRevision)}
                {detail(_("WWID"), pd.wwid)}
                {detail(_("Drive Type"), pd.driveType)}
                {detail(_("Interface"), pd.interfaceType)}
                {detail(_("PHY Transfer Rate"), pd.phyTransferRate)}
                {detail(_("Max Temperature"), pd.maxTemperature ? `${pd.maxTemperature}°C` : undefined)}
                {detail(_("Disk Name"), pd.diskName)}
                {detail(_("Mount Points"), pd.mountPoints)}
                {detail(_("Exposed to OS"), pd.driveExposedToOS)}
                {detail(_("Write Cache"), pd.writeCacheStatus)}
                {detail(_("Power-On Hours"), pd.powerOnHours)}
                {detail(_("Usage Remaining"), pd.usageRemaining)}
                {detail(_("Estimated Life Remaining"), pd.estimatedLifeRemaining)}
                {detail(_("Sanitize Erase Supported"), pd.sanitizeEraseSupported)}
                {detail(_("Last Failure Reason"), pd.lastFailureReason)}
            </DescriptionList>
            {pd.properties && Object.keys(pd.properties).length > 0 && (
                <div className="pf-v6-u-mt-md">
                    <DetailProps title={_("All Properties")} properties={pd.properties} />
                </div>
            )}
        </div>
    );
}

function PhysicalDriveTable({ drives, reload }: { drives: PhysicalDrive[]; reload: () => void }) {
    const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
    const tableId = React.useId();
    const dialogs = useDialogs(reload);

    const toggle = (id: string) => {
        setExpanded(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    return (
        <>
            <div className="hpssa-table-region" role="region" aria-label={_("Physical drives")} tabIndex={0}>
                <table className="pf-v6-c-table pf-m-compact pf-m-grid-lg pf-m-expandable" aria-label={_("Physical drives")}>
                    <TableCaption text={_("Physical drives")} />
                    <thead className="pf-v6-c-table__thead">
                        <tr className="pf-v6-c-table__tr">
                            <th className="pf-v6-c-table__th" scope="col" />
                            <th className="pf-v6-c-table__th" scope="col">{_("ID")}</th>
                            <th className="pf-v6-c-table__th" scope="col">{_("Status")}</th>
                            <th className="pf-v6-c-table__th" scope="col">{_("Type")}</th>
                            <th className="pf-v6-c-table__th" scope="col">{_("Size")}</th>
                            <th className="pf-v6-c-table__th" scope="col">{_("Model")}</th>
                            <th className="pf-v6-c-table__th" scope="col">{_("Serial")}</th>
                            <th className="pf-v6-c-table__th" scope="col">{_("Location")}</th>
                            <th className="pf-v6-c-table__th" scope="col">{_("Temp")}</th>
                            <th className="pf-v6-c-table__th" scope="col" />
                        </tr>
                    </thead>
                    {drives.map(pd => {
                        const key = `${pd.controllerSlot}-${pd.id}`;
                        const isOpen = expanded.has(key);
                        return (
                            <tbody
                                className={`pf-v6-c-table__tbody ${isOpen ? 'pf-m-expanded' : ''}`}
                                key={key}
                            >
                                <tr className="pf-v6-c-table__tr">
                                    <td className="pf-v6-c-table__td hpssa-toggle-cell">
                                        <Button
                                            variant="plain"
                                            aria-label={cockpit.format(isOpen ? _("Collapse drive $0 details") : _("Expand drive $0 details"), pd.id)}
                                            aria-expanded={isOpen}
                                            aria-controls={`${tableId}-${key}`}
                                            onClick={e => { e.stopPropagation(); toggle(key) }}
                                            icon={isOpen ? <AngleDownIcon /> : <AngleRightIcon />}
                                        />
                                    </td>
                                    <td className="pf-v6-c-table__td" data-label={_("ID")}>
                                        <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsSm' }}>
                                            <HddIcon />
                                            <span>{pd.id}</span>
                                        </Flex>
                                    </td>
                                    <td className="pf-v6-c-table__td" data-label={_("Status")}><StatusLabel status={pd.status} /></td>
                                    <td className="pf-v6-c-table__td" data-label={_("Type")}>{pd.interfaceType || pd.driveType}</td>
                                    <td className="pf-v6-c-table__td" data-label={_("Size")}>{pd.size}</td>
                                    <td className="pf-v6-c-table__td" data-label={_("Model")}>{pd.model}</td>
                                    <td className="pf-v6-c-table__td" data-label={_("Serial")}>{pd.serialNumber}</td>
                                    <td className="pf-v6-c-table__td" data-label={_("Location")}>{pd.port}:{pd.box}:{pd.bay}</td>
                                    <td className="pf-v6-c-table__td" data-label={_("Temp")}>{pd.temperature ? `${pd.temperature}°C` : '-'}</td>
                                    <td className="pf-v6-c-table__td hpssa-row-actions">
                                        <ActionMenu items={pdActions(pd, dialogs)} />
                                    </td>
                                </tr>
                                <tr id={`${tableId}-${key}`} hidden={!isOpen} className="pf-v6-c-table__tr hpssa-pd-details-row">
                                    <td className="pf-v6-c-table__td" colSpan={10}>
                                        {isOpen && <PhysicalDriveDetails pd={pd} />}
                                    </td>
                                </tr>
                            </tbody>
                        );
                    })}
                </table>
            </div>
            {dialogs.node}
        </>
    );
}

function ControllerCard({ controller, onSelect }: { controller: Controller; onSelect: () => void }) {
    return (
        <Card isClickable className="hpssa-controller-card">
            <CardHeader
                hasWrap
                selectableActions={{
                    onClickAction: onSelect,
                    selectableActionId: `ctrl-${controller.slot}`,
                    selectableActionAriaLabel: controller.name
                }}
            >
                <Flex flexWrap={{ default: 'nowrap' }} alignItems={{ default: 'alignItemsCenter' }}>
                    <ServerIcon />
                    <FlexItem>
                        <Title headingLevel="h3" size="lg">{controller.name}</Title>
                        <span className="pf-v6-u-color-200 pf-v6-u-font-size-sm">
                            {_("Slot")} {controller.slot}
                            {controller.serialNumber && ` · ${_("SN")}: ${controller.serialNumber}`}
                        </span>
                        <div className="pf-v6-u-mt-sm"><StatusLabel status={controller.status || controller.cacheStatus} /></div>
                    </FlexItem>
                </Flex>
            </CardHeader>
            <CardBody>
                <DescriptionList isHorizontal isCompact columnModifier={{ default: '1Col' }}>
                    <DescriptionListGroup>
                        <DescriptionListTerm>{_("Controller Status")}</DescriptionListTerm>
                        <DescriptionListDescription>
                            <StatusLabel status={controller.status} />
                        </DescriptionListDescription>
                    </DescriptionListGroup>
                    {controller.cacheStatus && (
                        <DescriptionListGroup>
                            <DescriptionListTerm>{_("Cache Status")}</DescriptionListTerm>
                            <DescriptionListDescription>
                                <StatusLabel status={controller.cacheStatus} />
                            </DescriptionListDescription>
                        </DescriptionListGroup>
                    )}
                    {controller.batteryStatus && (
                        <DescriptionListGroup>
                            <DescriptionListTerm>{_("Battery Status")}</DescriptionListTerm>
                            <DescriptionListDescription>
                                <StatusLabel status={controller.batteryStatus} />
                            </DescriptionListDescription>
                        </DescriptionListGroup>
                    )}
                    <DescriptionListGroup>
                        <DescriptionListTerm>{_("Firmware")}</DescriptionListTerm>
                        <DescriptionListDescription>{controller.firmwareVersion}</DescriptionListDescription>
                    </DescriptionListGroup>
                    <DescriptionListGroup>
                        <DescriptionListTerm>{_("Mode")}</DescriptionListTerm>
                        <DescriptionListDescription>{controller.controllerMode}</DescriptionListDescription>
                    </DescriptionListGroup>
                    {controller.temperature && (
                        <DescriptionListGroup>
                            <DescriptionListTerm>{_("Temperature")}</DescriptionListTerm>
                            <DescriptionListDescription>{controller.temperature}°C</DescriptionListDescription>
                        </DescriptionListGroup>
                    )}
                    <DescriptionListGroup>
                        <DescriptionListTerm>{_("Driver")}</DescriptionListTerm>
                        <DescriptionListDescription>{controller.driverName} {controller.driverVersion}</DescriptionListDescription>
                    </DescriptionListGroup>
                    <DescriptionListGroup>
                        <DescriptionListTerm>{_("Ports")}</DescriptionListTerm>
                        <DescriptionListDescription>{controller.portCount}</DescriptionListDescription>
                    </DescriptionListGroup>
                </DescriptionList>
            </CardBody>
        </Card>
    );
}

function EnclosureCard({ enclosure }: { enclosure: Enclosure }) {
    return (
        <Card isCompact>
            <CardHeader
                hasWrap
                actions={{
                    actions: <StatusLabel status={enclosure.status} />,
                    hasNoOffset: false
                }}
            >
                <Flex flexWrap={{ default: 'nowrap' }} alignItems={{ default: 'alignItemsCenter' }}>
                    <ContainerNodeIcon />
                    <FlexItem>
                        <Title headingLevel="h4" size="md">{enclosure.name}</Title>
                        <span className="pf-v6-u-color-200 pf-v6-u-font-size-sm">
                            {_("Port")} {enclosure.port}, {_("Box")} {enclosure.box} · {enclosure.location}
                        </span>
                    </FlexItem>
                </Flex>
            </CardHeader>
            <CardBody>
                <DescriptionList isHorizontal isCompact columnModifier={{ default: '1Col' }}>
                    <DescriptionListGroup>
                        <DescriptionListTerm>{_("Drive Bays")}</DescriptionListTerm>
                        <DescriptionListDescription>{enclosure.driveBays}</DescriptionListDescription>
                    </DescriptionListGroup>
                    {enclosure.fanStatus && (
                        <DescriptionListGroup>
                            <DescriptionListTerm>{_("Fan Status")}</DescriptionListTerm>
                            <DescriptionListDescription><StatusLabel status={enclosure.fanStatus} /></DescriptionListDescription>
                        </DescriptionListGroup>
                    )}
                    {enclosure.temperatureStatus && (
                        <DescriptionListGroup>
                            <DescriptionListTerm>{_("Temperature Status")}</DescriptionListTerm>
                            <DescriptionListDescription><StatusLabel status={enclosure.temperatureStatus} /></DescriptionListDescription>
                        </DescriptionListGroup>
                    )}
                    {enclosure.powerSupplyStatus && (
                        <DescriptionListGroup>
                            <DescriptionListTerm>{_("Power Supply")}</DescriptionListTerm>
                            <DescriptionListDescription><StatusLabel status={enclosure.powerSupplyStatus} /></DescriptionListDescription>
                        </DescriptionListGroup>
                    )}
                    {enclosure.firmwareVersion && (
                        <DescriptionListGroup>
                            <DescriptionListTerm>{_("Firmware")}</DescriptionListTerm>
                            <DescriptionListDescription>{enclosure.firmwareVersion}</DescriptionListDescription>
                        </DescriptionListGroup>
                    )}
                    {enclosure.serialNumber && (
                        <DescriptionListGroup>
                            <DescriptionListTerm>{_("Serial Number")}</DescriptionListTerm>
                            <DescriptionListDescription>{enclosure.serialNumber}</DescriptionListDescription>
                        </DescriptionListGroup>
                    )}
                </DescriptionList>
                {enclosure.physicalDrives.length > 0 && (
                    <div className="pf-v6-u-mt-sm">
                        <LabelGroup numLabels={10} isVertical={false}>
                            {enclosure.physicalDrives.map(pd => (
                                <Label key={pd} color="blue" icon={<HddIcon />} isCompact>{pd}</Label>
                            ))}
                        </LabelGroup>
                    </div>
                )}
            </CardBody>
        </Card>
    );
}

function ArraySection({ slot, arrayId, arrayEntries, lds, pds, reload }: {
    slot: string;
    arrayId: string;
    arrayEntries: { id: string; type: string; unusedSpace: string }[];
    lds: LogicalDrive[];
    pds: PhysicalDrive[];
    reload: () => void;
}) {
    const [expanded, setExpanded] = React.useState(true);
    const dialogs = useDialogs(reload);

    const arrayInfo = arrayEntries[0];

    return (
        <>
            <Flex
                alignItems={{ default: 'alignItemsCenter' }}
                spaceItems={{ default: 'spaceItemsSm' }}
                className="hpssa-array-header"
            >
                <FlexItem grow={{ default: 'grow' }}>
                    <ExpandableSection
                        toggleContent={
                            <Flex spaceItems={{ default: 'spaceItemsSm' }} alignItems={{ default: 'alignItemsCenter' }}>
                                <StorageDomainIcon />
                                <span>{_("Array")} {arrayId}</span>
                                {arrayInfo && (
                                    <span className="pf-v6-u-color-200 pf-v6-u-font-size-sm">
                                        ({arrayInfo.type}, {_("Unused")}: {arrayInfo.unusedSpace})
                                    </span>
                                )}
                                <Badge isRead>{lds.length} LD · {pds.length} PD</Badge>
                            </Flex>
                        }
                        onToggle={(_event, val) => setExpanded(val)}
                        isExpanded={expanded}
                    >
                        <Stack hasGutter>
                            {lds.map(ld => (
                                <StackItem key={ld.id}>
                                    <LogicalDriveCard ld={ld} reload={reload} />
                                </StackItem>
                            ))}
                            {pds.length > 0 && (
                                <StackItem>
                                    <PhysicalDriveTable drives={pds} reload={reload} />
                                </StackItem>
                            )}
                        </Stack>
                    </ExpandableSection>
                </FlexItem>
                <ActionMenu items={arrayActions(slot, arrayId, dialogs)} />
            </Flex>
            {dialogs.node}
        </>
    );
}

function LogicalDriveCard({ ld, reload }: { ld: LogicalDrive; reload: () => void }) {
    const dialogs = useDialogs(reload);
    const raidMap: Record<string, string> = {
        0: 'RAID 0',
        1: 'RAID 1',
        '1+0': 'RAID 1+0',
        5: 'RAID 5',
        6: 'RAID 6',
        50: 'RAID 50',
        60: 'RAID 60',
        '1ADM': 'RAID 1 ADM',
        '10ADM': 'RAID 1+0 ADM',
    };
    const raidLabel = raidMap[ld.faultTolerance] || ld.faultTolerance;

    return (
        <Card isCompact>
            <CardHeader
                hasWrap
                actions={{
                    actions: (
                        <Flex spaceItems={{ default: 'spaceItemsSm' }} alignItems={{ default: 'alignItemsCenter' }}>
                            <StatusLabel status={ld.status} />
                            <ActionMenu items={ldActions(ld, dialogs)} />
                        </Flex>
                    ),
                    hasNoOffset: false
                }}
            >
                <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsSm' }}>
                    <StorageDomainIcon />
                    <FlexItem>
                        <Title headingLevel="h4" size="md">{_("Logical Drive")} {ld.id}</Title>
                        <span className="pf-v6-u-color-200 pf-v6-u-font-size-sm">
                            {raidLabel} · {ld.size}
                        </span>
                    </FlexItem>
                </Flex>
            </CardHeader>
            {dialogs.node}
            <CardBody>
                <DescriptionList isHorizontal isCompact columnModifier={{ default: '1Col', lg: '2Col' }}>
                    <DescriptionListGroup>
                        <DescriptionListTerm>{_("Fault Tolerance")}</DescriptionListTerm>
                        <DescriptionListDescription>{raidLabel}</DescriptionListDescription>
                    </DescriptionListGroup>
                    <DescriptionListGroup>
                        <DescriptionListTerm>{_("Size")}</DescriptionListTerm>
                        <DescriptionListDescription>{ld.size}</DescriptionListDescription>
                    </DescriptionListGroup>
                    <DescriptionListGroup>
                        <DescriptionListTerm>{_("Caching")}</DescriptionListTerm>
                        <DescriptionListDescription>{ld.caching}</DescriptionListDescription>
                    </DescriptionListGroup>
                    <DescriptionListGroup>
                        <DescriptionListTerm>{_("Strip Size")}</DescriptionListTerm>
                        <DescriptionListDescription>{ld.stripSize}</DescriptionListDescription>
                    </DescriptionListGroup>
                    {ld.diskName && (
                        <DescriptionListGroup>
                            <DescriptionListTerm>{_("Disk Name")}</DescriptionListTerm>
                            <DescriptionListDescription>{ld.diskName}</DescriptionListDescription>
                        </DescriptionListGroup>
                    )}
                    <DescriptionListGroup>
                        <DescriptionListTerm>{_("Acceleration")}</DescriptionListTerm>
                        <DescriptionListDescription>{ld.accelerationMethod}</DescriptionListDescription>
                    </DescriptionListGroup>
                </DescriptionList>
            </CardBody>
        </Card>
    );
}

function DetailProps({ title, properties }: { title: string; properties?: KeyValue }) {
    const [expanded, setExpanded] = React.useState(false);
    if (!properties || Object.keys(properties).length === 0) return null;

    return (
        <ExpandableSection
            toggleContent={title}
            onToggle={(_event, val) => setExpanded(val)}
            isExpanded={expanded}
        >
            <PropertyTable properties={properties} />
        </ExpandableSection>
    );
}

function ControllerDetail({ overview, controller, onBack, reload }: {
    overview: SystemOverview;
    controller: Controller;
    onBack: () => void;
    reload: () => void;
}) {
    const [activeTab, setActiveTab] = React.useState<string | number>(0);
    const dialogs = useDialogs(reload);
    const arrays = overview.arrays.filter(a => a.controllerSlot === controller.slot);
    const enclosures = overview.enclosures.filter(e => e.controllerSlot === controller.slot);
    const allPds = overview.physicalDrives.filter(pd => pd.controllerSlot === controller.slot);
    const arrayPdIds = new Set(arrays.flatMap(a => a.physicalDrives.map(p => p.id)));
    const hbaPds = allPds.filter(pd => !arrayPdIds.has(pd.id));
    const arrayIds = [...new Set(arrays.map(a => a.id))];

    return (
        <>
            <PageSection isFilled={false}>
                <Breadcrumb className="pf-v6-u-mb-md">
                    <BreadcrumbItem onClick={onBack} to="#">{_("Dashboard")}</BreadcrumbItem>
                    <BreadcrumbItem isActive>{controller.name}</BreadcrumbItem>
                </Breadcrumb>

                <Flex
                    alignItems={{ default: 'alignItemsCenter' }}
                    spaceItems={{ default: 'spaceItemsMd' }}
                    flexWrap={{ default: 'wrap' }}
                    className="pf-v6-u-mb-md"
                >
                    <Title headingLevel="h2" size="xl">{controller.name}</Title>
                    <FlexItem>
                        <Flex spaceItems={{ default: 'spaceItemsSm' }} alignItems={{ default: 'alignItemsCenter' }}>
                            <StatusLabel status={controller.status} />
                            {controller.cacheStatus && <StatusLabel status={controller.cacheStatus} />}
                            {controller.batteryStatus && <StatusLabel status={controller.batteryStatus} />}
                        </Flex>
                    </FlexItem>
                    <FlexItem align={{ default: 'alignRight' }}>
                        <Flex spaceItems={{ default: 'spaceItemsSm' }} alignItems={{ default: 'alignItemsCenter' }}>
                            <Button
                                variant="secondary"
                                icon={<SyncIcon />}
                                size="sm"
                                onClick={() => dialogs.openOutput(_("Rescan"), async () => {
                                    const out = await rescanController(controller.slot);
                                    reload();
                                    return out.trim() || _("Rescan completed.");
                                })}
                            >
                                {_("Rescan")}
                            </Button>
                            <ActionMenu items={controllerActions(controller, dialogs)} />
                        </Flex>
                    </FlexItem>
                </Flex>

            </PageSection>
            <Tabs usePageInsets tabListAriaLabel={_("Controller sections")} className="hpssa-controller-tabs" activeKey={activeTab} onSelect={(_event, key) => setActiveTab(key)}>
                <Tab eventKey={0} title={<TabTitleText>{_("Overview")}</TabTitleText>}>
                    <PageSection>
                        <DescriptionList isHorizontal columnModifier={{ default: '1Col', lg: '2Col' }}>
                            <DescriptionListGroup>
                                <DescriptionListTerm>{_("Slot")}</DescriptionListTerm>
                                <DescriptionListDescription>{controller.slot}</DescriptionListDescription>
                            </DescriptionListGroup>
                            <DescriptionListGroup>
                                <DescriptionListTerm>{_("Controller Status")}</DescriptionListTerm>
                                <DescriptionListDescription><StatusLabel status={controller.status} /></DescriptionListDescription>
                            </DescriptionListGroup>
                            {controller.cacheStatus && (
                                <DescriptionListGroup>
                                    <DescriptionListTerm>{_("Cache Status")}</DescriptionListTerm>
                                    <DescriptionListDescription><StatusLabel status={controller.cacheStatus} /></DescriptionListDescription>
                                </DescriptionListGroup>
                            )}
                            {controller.batteryStatus && (
                                <DescriptionListGroup>
                                    <DescriptionListTerm>{_("Battery Status")}</DescriptionListTerm>
                                    <DescriptionListDescription><StatusLabel status={controller.batteryStatus} /></DescriptionListDescription>
                                </DescriptionListGroup>
                            )}
                            <DescriptionListGroup>
                                <DescriptionListTerm>{_("Serial Number")}</DescriptionListTerm>
                                <DescriptionListDescription>{controller.serialNumber}</DescriptionListDescription>
                            </DescriptionListGroup>
                            <DescriptionListGroup>
                                <DescriptionListTerm>{_("Firmware Version")}</DescriptionListTerm>
                                <DescriptionListDescription>{controller.firmwareVersion}</DescriptionListDescription>
                            </DescriptionListGroup>
                            <DescriptionListGroup>
                                <DescriptionListTerm>{_("Driver")}</DescriptionListTerm>
                                <DescriptionListDescription>{controller.driverName} {controller.driverVersion}</DescriptionListDescription>
                            </DescriptionListGroup>
                            <DescriptionListGroup>
                                <DescriptionListTerm>{_("Controller Mode")}</DescriptionListTerm>
                                <DescriptionListDescription>{controller.controllerMode}</DescriptionListDescription>
                            </DescriptionListGroup>
                            {controller.temperature && (
                                <DescriptionListGroup>
                                    <DescriptionListTerm>{_("Temperature")}</DescriptionListTerm>
                                    <DescriptionListDescription>{controller.temperature}°C</DescriptionListDescription>
                                </DescriptionListGroup>
                            )}
                            {controller.pciAddress && (
                                <DescriptionListGroup>
                                    <DescriptionListTerm>{_("PCI Address")}</DescriptionListTerm>
                                    <DescriptionListDescription>{controller.pciAddress}</DescriptionListDescription>
                                </DescriptionListGroup>
                            )}
                            {controller.pcieRate && (
                                <DescriptionListGroup>
                                    <DescriptionListTerm>{_("PCIe Rate")}</DescriptionListTerm>
                                    <DescriptionListDescription>{controller.pcieRate}</DescriptionListDescription>
                                </DescriptionListGroup>
                            )}
                            {controller.portCount && (
                                <DescriptionListGroup>
                                    <DescriptionListTerm>{_("Number of Ports")}</DescriptionListTerm>
                                    <DescriptionListDescription>{controller.portCount}</DescriptionListDescription>
                                </DescriptionListGroup>
                            )}
                            {controller.encryption && (
                                <DescriptionListGroup>
                                    <DescriptionListTerm>{_("Encryption")}</DescriptionListTerm>
                                    <DescriptionListDescription>{controller.encryption}</DescriptionListDescription>
                                </DescriptionListGroup>
                            )}
                        </DescriptionList>

                        {controller.sensors.length > 0 && (
                            <div className="pf-v6-u-mt-lg">
                                <SensorTable sensors={controller.sensors} />
                            </div>
                        )}

                        <div className="pf-v6-u-mt-lg">
                            <DetailProps title={_("All Properties")} properties={controller.properties} />
                        </div>
                    </PageSection>
                </Tab>

                <Tab eventKey={1} title={<TabTitleText>{_("Arrays & Logical Drives")} <Badge isRead>{arrays.length}</Badge></TabTitleText>}>
                    <PageSection>
                        {arrayIds.length === 0
                            ? (
                                <Alert variant="info" title={_("No arrays configured on this controller.")} isInline />
                            )
                            : (
                                <Stack hasGutter>
                                    {arrayIds.map(arrayId => {
                                        const arrayData = arrays.filter(a => a.id === arrayId);
                                        const lds = overview.logicalDrives.filter(ld =>
                                            ld.controllerSlot === controller.slot && ld.arrayId === arrayId
                                        );
                                        const pds: PhysicalDrive[] = [];
                                        for (const arr of arrayData) {
                                            for (const pdRef of arr.physicalDrives) {
                                                const full = overview.physicalDrives.find(
                                                    pd => pd.id === pdRef.id && pd.controllerSlot === controller.slot
                                                );
                                                if (full) pds.push(full);
                                                else pds.push(pdRef);
                                            }
                                        }

                                        return (
                                            <StackItem key={arrayId}>
                                                <ArraySection
                                                    slot={controller.slot}
                                                    arrayId={arrayId}
                                                    arrayEntries={arrayData.map(a => ({ id: a.id, type: a.arrayType, unusedSpace: a.unusedSpace }))}
                                                    lds={lds}
                                                    pds={pds}
                                                    reload={reload}
                                                />
                                            </StackItem>
                                        );
                                    })}
                                </Stack>
                            )}
                    </PageSection>
                </Tab>

                <Tab eventKey={2} title={<TabTitleText>{_("Physical Drives")} <Badge isRead>{allPds.length}</Badge></TabTitleText>}>
                    <PageSection>
                        {allPds.length === 0
                            ? (
                                <Alert variant="info" title={_("No physical drives found on this controller.")} isInline />
                            )
                            : (
                                <PhysicalDriveTable drives={allPds} reload={reload} />
                            )}
                    </PageSection>
                </Tab>

                <Tab eventKey={3} title={<TabTitleText>{_("Enclosures")} <Badge isRead>{enclosures.length}</Badge></TabTitleText>}>
                    <PageSection>
                        {enclosures.length === 0
                            ? (
                                <Alert variant="info" title={_("No enclosures found on this controller.")} isInline />
                            )
                            : (
                                <Gallery hasGutter minWidths={{ default: 'min(100%, 30rem)' }}>
                                    {enclosures.map((enc, idx) => (
                                        <EnclosureCard key={idx} enclosure={enc} />
                                    ))}
                                </Gallery>
                            )}
                    </PageSection>
                </Tab>

                {hbaPds.length > 0 && (
                    <Tab eventKey={4} title={<TabTitleText>{_("HBA Drives")} <Badge isRead>{hbaPds.length}</Badge></TabTitleText>}>
                        <PageSection>
                            <PhysicalDriveTable drives={hbaPds} reload={reload} />
                        </PageSection>
                    </Tab>
                )}

                <Tab eventKey={5} title={<TabTitleText>{_("Settings")}</TabTitleText>}>
                    <PageSection>
                        <SettingsPage
                            controller={controller}
                            settings={controllerSettingDefs(controller)}
                            reload={reload}
                        />
                    </PageSection>
                </Tab>
            </Tabs>
            {dialogs.node}
        </>
    );
}

export const Application = () => {
    const [overview, setOverview] = React.useState<SystemOverview | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const [view, setView] = React.useState<ViewState>({ level: 'dashboard' });
    const [loading, setLoading] = React.useState(true);
    const [rawOpen, setRawOpen] = React.useState(false);
    const dialogs = useDialogs();

    // `background` refreshes keep the current view (and any open dialog) mounted,
    // so a command's success/error stays visible in its modal; only the initial
    // load and error retries may replace the page with the spinner/error state.
    const loadData = React.useCallback(async (background = false) => {
        if (!background) setLoading(true);
        setError(null);
        try {
            const data = await fetchOverview();
            setOverview(data);
        } catch (e: unknown) {
            // Background failure keeps the stale data instead of unmounting open
            // dialogs; the foreground path surfaces it with the Retry alert.
            if (!background) setError(e instanceof Error ? e.message : String(e));
        } finally {
            if (!background) setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        loadData();
    }, [loadData]);

    const openController = (slot: string) => setView({ level: 'controller', controllerSlot: slot });

    const selectView = (id: string) => {
        if (id === 'dashboard') setView({ level: 'dashboard' });
        else if (id === 'commandlog') setView({ level: 'commandlog' });
        else if (id.startsWith('ctrl-')) openController(id.substring(5));
    };

    // Re-render the command-log tab badge when the log changes.
    const [logCount, setLogCount] = React.useState(getCommandLog().length);
    React.useEffect(() => subscribeCommandLog(() => setLogCount(getCommandLog().length)), []);

    const activeTab =
        view.level === 'controller'
            ? `ctrl-${view.controllerSlot}`
            : view.level === 'commandlog'
                ? 'commandlog'
                : 'dashboard';

    const selectedController = overview?.controllers.find(c => c.slot === view.controllerSlot);

    let content: React.ReactNode;
    if (loading) {
        content = (
            <PageSection
                isFilled
                className="pf-v6-u-display-flex pf-v6-u-align-items-center pf-v6-u-justify-content-center"
            >
                <Spinner size="xl" aria-label={_("Loading storage information")} />
            </PageSection>
        );
    } else if (error) {
        content = (
            <PageSection>
                <Alert
                    variant="danger"
                    title={_("Error loading storage information")}
                    isInline
                    actionLinks={
                        <Button variant="link" onClick={() => loadData()} icon={<SyncIcon />}>
                            {_("Retry")}
                        </Button>
                    }
                >
                    {error}
                </Alert>
            </PageSection>
        );
    } else if (!overview) {
        content = null;
    } else if (view.level === 'controller' && selectedController) {
        content = (
            <ControllerDetail
                key={selectedController.slot}
                overview={overview}
                controller={selectedController}
                onBack={() => setView({ level: 'dashboard' })}
                reload={() => loadData(true)}
            />
        );
    } else if (view.level === 'commandlog') {
        content = (
            <PageSection>
                <CommandLog />
            </PageSection>
        );
    } else {
        content = (
            <PageSection>
                {overview.controllers.length === 0
                    ? (
                        <EmptyState titleText={_("No HP Smart Array controllers detected.")} icon={CubeIcon} headingLevel="h2">
                            <EmptyStateBody>
                                {_("Ensure ssacli is installed and the system has compatible HP storage hardware.")}
                            </EmptyStateBody>
                            <Button variant="primary" icon={<SyncIcon />} onClick={() => loadData()}>
                                {_("Refresh")}
                            </Button>
                        </EmptyState>
                    )
                    : (
                        <Stack hasGutter>
                            <StackItem>
                                <Gallery hasGutter minWidths={{ default: 'min(100%, 30rem)' }}>
                                    {overview.controllers.map(c => (
                                        <ControllerCard
                                            key={c.slot}
                                            controller={c}
                                            onSelect={() => openController(c.slot)}
                                        />
                                    ))}
                                </Gallery>
                            </StackItem>

                            {[...new Set(overview.enclosures.map(e => e.controllerSlot))].map(slot => {
                                const ctrl = overview.controllers.find(c => c.slot === slot);
                                if (!ctrl) return null;
                                return (
                                    <StackItem key={slot}>
                                        <Title headingLevel="h3" size="md" className="pf-v6-u-mb-sm">
                                            {cockpit.format(_("Enclosures — $0"), ctrl.name)}
                                        </Title>
                                        <Gallery hasGutter minWidths={{ default: 'min(100%, 30rem)' }}>
                                            {overview.enclosures
                                                    .filter(e => e.controllerSlot === slot)
                                                    .map((enc, idx) => (
                                                        <EnclosureCard key={idx} enclosure={enc} />
                                                    ))}
                                        </Gallery>
                                    </StackItem>
                                );
                            })}

                            <StackItem>
                                <Title headingLevel="h2" size="xl" className="pf-v6-u-mb-md">{_("Quick Status")}</Title>
                                <Card>
                                    <CardBody>
                                        <StatusOverviewTable
                                            controllers={overview.controllers}
                                            overview={overview}
                                            onSelect={openController}
                                        />
                                    </CardBody>
                                </Card>
                            </StackItem>
                        </Stack>
                    )}
            </PageSection>
        );
    }

    return (
        <Page sidebar={null} className="hpssa-page ct-page-fill" mainAriaLabel={_("HP Smart Storage")}>
            {/* Compact plugin header: this page renders inside the Cockpit shell,
                so no sidebar/masthead chrome of its own. */}
            <PageSection isFilled={false} className="hpssa-page-header">
                <Flex
                    justifyContent={{ default: 'justifyContentSpaceBetween' }}
                    alignItems={{ default: 'alignItemsCenter' }}
                    flexWrap={{ default: 'wrap' }}
                >
                    <FlexItem>
                        <Title headingLevel="h1" size="xl">{_("HP Smart Storage")}</Title>
                    </FlexItem>
                    <FlexItem>
                        <Flex spaceItems={{ default: 'spaceItemsSm' }}>
                            <Button
                                variant="secondary"
                                icon={<SyncIcon />}
                                size="sm"
                                onClick={() => dialogs.openOutput(_("Rescan all"), async () => {
                                    const out = await rescanAll();
                                    loadData(true);
                                    return out.trim() || _("Rescan completed.");
                                })}
                            >
                                {_("Rescan all")}
                            </Button>
                            <Button variant="secondary" size="sm" icon={<SearchIcon />} onClick={() => setRawOpen(true)}>
                                {_("Run command…")}
                            </Button>
                        </Flex>
                    </FlexItem>
                </Flex>
            </PageSection>

            {!loading && !error && overview && (
                <PageSection isFilled={false} type="subnav" padding={{ default: 'noPadding' }}>
                    <Nav
                        variant="horizontal-subnav"
                        aria-label={_("Storage navigation")}
                        onSelect={(_event, result) => selectView(String(result.itemId))}
                    >
                        <NavList>
                            <NavItem itemId="dashboard" isActive={activeTab === 'dashboard'}>
                                {_("Dashboard")}
                            </NavItem>
                            {overview.controllers.map(c => (
                                <NavItem
                                    key={c.slot}
                                    itemId={`ctrl-${c.slot}`}
                                    isActive={activeTab === `ctrl-${c.slot}`}
                                >
                                    <Flex flexWrap={{ default: 'nowrap' }} spaceItems={{ default: 'spaceItemsXs' }} alignItems={{ default: 'alignItemsCenter' }}>
                                        <span>{c.name}</span>
                                        <StatusLabel status={c.status} />
                                    </Flex>
                                </NavItem>
                            ))}
                            <NavItem itemId="commandlog" isActive={activeTab === 'commandlog'}>
                                <Flex flexWrap={{ default: 'nowrap' }} spaceItems={{ default: 'spaceItemsXs' }} alignItems={{ default: 'alignItemsCenter' }}>
                                    <span>{_("Command log")}</span>
                                    {logCount > 0 && <Badge isRead>{logCount}</Badge>}
                                </Flex>
                            </NavItem>
                        </NavList>
                    </Nav>
                </PageSection>
            )}

            {content}

            <RawCommandDialog
                isOpen={rawOpen}
                onClose={() => { setRawOpen(false); loadData() }}
                onRun={runSsacliCommandLine}
            />
            {dialogs.node}
        </Page>
    );
};
