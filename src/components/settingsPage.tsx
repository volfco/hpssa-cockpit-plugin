import React from 'react';
import { Title } from "@patternfly/react-core/dist/esm/components/Title/index.js";
import { Button } from "@patternfly/react-core/dist/esm/components/Button/index.js";
import { Divider } from "@patternfly/react-core/dist/esm/components/Divider/index.js";
import { Stack, StackItem } from "@patternfly/react-core/dist/esm/layouts/Stack/index.js";
import {
    DataList, DataListItem, DataListItemRow, DataListItemCells,
    DataListCell, DataListAction,
} from "@patternfly/react-core/dist/esm/components/DataList/index.js";
import PencilAltIcon from "@patternfly/react-icons/dist/esm/icons/pencil-alt-icon.js";
import cockpit from 'cockpit';

import { FormDialog, type FieldDef, type FormValues } from './dialogs';
import type { Controller, KeyValue } from '../types';

const _ = cockpit.gettext;

// ---------------------------------------------------------------------------
// Setting model — describes one row on the Settings page.
// ---------------------------------------------------------------------------

export interface SettingDef {
    key: string;
    label: string;
    description: string;
    group: string;
    // Pulls the current value out of the controller's parsed properties. Try
    // multiple property names because ssacli output varies by firmware/mode
    // (e.g. HBA-mode controllers omit cache settings entirely).
    currentValue: (props: KeyValue) => string;
    // Form fields used by the Edit dialog. Pre-populate values via the
    // optional defaultValue field on each FieldDef.
    fields: FieldDef[];
    onSave: (values: FormValues) => Promise<string>;
}

// Helper: read the first matching property key, or return "—" if none exist.
export function readProp(props: KeyValue, ...keys: string[]): string {
    for (const k of keys) {
        if (props[k] !== undefined && props[k] !== '') return props[k];
    }
    return '—';
}

// ---------------------------------------------------------------------------
// Settings page — groups rendered as PF DataLists with an edit action each.
// ---------------------------------------------------------------------------

interface SettingsPageProps {
    controller: Controller;
    settings: SettingDef[];
    reload: () => void;
}

export function SettingsPage({ controller, settings, reload }: SettingsPageProps) {
    const [editing, setEditing] = React.useState<SettingDef | null>(null);

    // Preserve the order of first appearance for each group.
    const groups: { name: string; items: SettingDef[] }[] = [];
    for (const s of settings) {
        let g = groups.find(x => x.name === s.group);
        if (!g) {
            g = { name: s.group, items: [] };
            groups.push(g);
        }
        g.items.push(s);
    }

    return (
        <>
            <Stack hasGutter>
                {groups.map((g, idx) => (
                    <StackItem key={g.name}>
                        {idx > 0 && <Divider className="pf-v6-u-my-md" />}
                        <Title headingLevel="h3" size="lg" className="pf-v6-u-mb-sm">{g.name}</Title>
                        <DataList aria-label={g.name} isCompact>
                            {g.items.map(s => (
                                <DataListItem key={s.key} aria-labelledby={`setting-${s.key}`}>
                                    <DataListItemRow>
                                        <DataListItemCells
                                            dataListCells={[
                                                <DataListCell key="main">
                                                    <span id={`setting-${s.key}`} className="pf-v6-u-font-weight-bold">
                                                        {s.label}
                                                    </span>
                                                    <span className="hpssa-setting-value">
                                                        {s.currentValue(controller.properties)}
                                                    </span>
                                                    <span className="pf-v6-u-color-200 pf-v6-u-font-size-sm">
                                                        {s.description}
                                                    </span>
                                                </DataListCell>,
                                            ]}
                                        />
                                        <DataListAction
                                            aria-labelledby={`setting-${s.key} setting-${s.key}-edit`}
                                            id={`setting-${s.key}-edit`}
                                            aria-label={_("Edit setting")}
                                        >
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                icon={<PencilAltIcon />}
                                                onClick={() => setEditing(s)}
                                            >
                                                {_("Edit")}
                                            </Button>
                                        </DataListAction>
                                    </DataListItemRow>
                                </DataListItem>
                            ))}
                        </DataList>
                    </StackItem>
                ))}
            </Stack>
            {editing && (
                <FormDialog
                    isOpen
                    title={editing.label}
                    description={editing.description}
                    fields={editing.fields}
                    onClose={() => setEditing(null)}
                    // eslint-disable-next-line react/jsx-handler-names
                    onSubmit={editing.onSave}
                    onSuccess={reload}
                />
            )}
        </>
    );
}
