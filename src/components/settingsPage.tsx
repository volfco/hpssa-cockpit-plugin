import React from 'react';
import { Title } from "@patternfly/react-core/dist/esm/components/Title/index.js";
import { Button } from "@patternfly/react-core/dist/esm/components/Button/index.js";
import { Divider } from "@patternfly/react-core/dist/esm/components/Divider/index.js";
import { Flex, FlexItem } from "@patternfly/react-core/dist/esm/layouts/Flex/index.js";
import { Stack, StackItem } from "@patternfly/react-core/dist/esm/layouts/Stack/index.js";
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
// Settings page — groups, rows, edit-dialog wiring.
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
            <Stack hasGutter className="hpssa-settings">
                {groups.map((g, idx) => (
                    <StackItem key={g.name}>
                        {idx > 0 && <Divider className="pf-v6-u-my-md" />}
                        <Title headingLevel="h3" size="lg" className="pf-v6-u-mb-sm">{g.name}</Title>
                        <Stack>
                            {g.items.map(s => (
                                <StackItem key={s.key}>
                                    <SettingRow
                                        setting={s}
                                        value={s.currentValue(controller.properties)}
                                        onEdit={() => setEditing(s)}
                                    />
                                </StackItem>
                            ))}
                        </Stack>
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

interface SettingRowProps {
    setting: SettingDef;
    value: string;
    onEdit: () => void;
}

function SettingRow({ setting, value, onEdit }: SettingRowProps) {
    return (
        <Flex
            className="hpssa-setting-row"
            spaceItems={{ default: 'spaceItemsMd' }}
            alignItems={{ default: 'alignItemsFlexStart' }}
            justifyContent={{ default: 'justifyContentSpaceBetween' }}
        >
            <FlexItem grow={{ default: 'grow' }}>
                <div className="hpssa-setting-row__label">{setting.label}</div>
                <div className="hpssa-setting-row__value">{value}</div>
                <div className="hpssa-setting-row__desc">{setting.description}</div>
            </FlexItem>
            <FlexItem>
                <Button
                    variant="secondary"
                    icon={<PencilAltIcon />}
                    onClick={onEdit}
                    size="sm"
                >
                    {_("Edit")}
                </Button>
            </FlexItem>
        </Flex>
    );
}
