import React from 'react';
import { Title } from "@patternfly/react-core/dist/esm/components/Title/index.js";
import { Button } from "@patternfly/react-core/dist/esm/components/Button/index.js";
import { Switch } from "@patternfly/react-core/dist/esm/components/Switch/index.js";
import { Label } from "@patternfly/react-core/dist/esm/components/Label/index.js";
import { EmptyState, EmptyStateBody } from "@patternfly/react-core/dist/esm/components/EmptyState/index.js";
import { CodeBlock, CodeBlockCode } from "@patternfly/react-core/dist/esm/components/CodeBlock/index.js";
import { ExpandableSection } from "@patternfly/react-core/dist/esm/components/ExpandableSection/index.js";
import { Flex, FlexItem } from "@patternfly/react-core/dist/esm/layouts/Flex/index.js";
import { Stack, StackItem } from "@patternfly/react-core/dist/esm/layouts/Stack/index.js";
import TrashIcon from "@patternfly/react-icons/dist/esm/icons/trash-icon.js";
import CopyIcon from "@patternfly/react-icons/dist/esm/icons/copy-icon.js";
import DownloadIcon from "@patternfly/react-icons/dist/esm/icons/download-icon.js";
import cockpit from 'cockpit';

import {
    type CommandLogEntry,
    getCommandLog, subscribeCommandLog, clearCommandLog,
    isLogDiscovery, setLogDiscovery,
} from '../service';

const _ = cockpit.gettext;

// Quote a single argv element so the rendered command is a copy-pasteable
// shell-safe string. POSIX-shell rules: wrap in single quotes if the arg
// contains anything other than [A-Za-z0-9_:=,./@+%-].
function shellQuote(arg: string): string {
    if (arg === '' || /[^\w:=,./@+%-]/.test(arg)) {
        return `'${arg.replace(/'/g, "'\\''")}'`;
    }
    return arg;
}

function formatTime(ts: number): string {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour12: false });
}

// Render an entry as a bash snippet:
//   # <reason>
//   ssacli ctrl slot=1 modify cacheratio=25/75
function renderBash(entry: CommandLogEntry): string {
    const cmd = ['ssacli', ...entry.args].map(shellQuote).join(' ');
    return `# ${entry.reason}\n${cmd}`;
}

function statusLabel(entry: CommandLogEntry) {
    if (entry.status === 'pending') return <Label color="blue" isCompact>{_("running")}</Label>;
    if (entry.status === 'error') return <Label color="red" isCompact>{_("failed")}</Label>;
    return <Label color="green" isCompact>{_("ok")}</Label>;
}

function CommandLogEntryView({ entry }: { entry: CommandLogEntry }) {
    const [showOutput, setShowOutput] = React.useState(false);
    const hasOutput = (entry.output && entry.output.trim()) || entry.error;

    return (
        <div className="hpssa-log-entry">
            <Flex
                spaceItems={{ default: 'spaceItemsSm' }}
                alignItems={{ default: 'alignItemsCenter' }}
                className="hpssa-log-entry__meta"
            >
                <FlexItem>
                    <span className="hpssa-log-entry__time">{formatTime(entry.timestamp)}</span>
                </FlexItem>
                <FlexItem>{statusLabel(entry)}</FlexItem>
                {entry.durationMs !== undefined && (
                    <FlexItem>
                        <span className="pf-v6-u-color-200 pf-v6-u-font-size-sm">
                            {entry.durationMs} ms
                        </span>
                    </FlexItem>
                )}
            </Flex>
            <CodeBlock
                actions={
                    <Button
                        variant="plain"
                        aria-label={_("Copy")}
                        icon={<CopyIcon />}
                        onClick={() => navigator.clipboard?.writeText(renderBash(entry))}
                    />
                }
            >
                <CodeBlockCode>{renderBash(entry)}</CodeBlockCode>
            </CodeBlock>
            {hasOutput && (
                <ExpandableSection
                    toggleText={showOutput ? _("Hide output") : _("Show output")}
                    isExpanded={showOutput}
                    onToggle={(_e, v) => setShowOutput(v)}
                    isIndented
                >
                    <CodeBlock>
                        <CodeBlockCode>{entry.error || entry.output}</CodeBlockCode>
                    </CodeBlock>
                </ExpandableSection>
            )}
        </div>
    );
}

export function CommandLog() {
    // Force re-render when log changes; we read directly from the store.
    const [, setVersion] = React.useState(0);
    const [includeDiscovery, setIncludeDiscoveryState] = React.useState(isLogDiscovery());

    React.useEffect(() => subscribeCommandLog(() => setVersion(v => v + 1)), []);

    const log = getCommandLog();
    const sorted = [...log].sort((a, b) => b.timestamp - a.timestamp);

    const downloadScript = () => {
        const header = '#!/usr/bin/env bash\n# ssacli command log exported from cockpit-hpssa\nset -e\n\n';
        const body = [...log]
                .sort((a, b) => a.timestamp - b.timestamp)
                .map(renderBash)
                .join('\n\n');
        const blob = new Blob([header + body + '\n'], { type: 'text/x-shellscript' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ssacli-commands-${new Date().toISOString()
                .slice(0, 19)
                .replace(/[:T]/g, '-')}.sh`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const setDiscovery = (on: boolean) => {
        setLogDiscovery(on);
        setIncludeDiscoveryState(on);
    };

    return (
        <Stack hasGutter className="hpssa-command-log">
            <StackItem>
                <Flex
                    justifyContent={{ default: 'justifyContentSpaceBetween' }}
                    alignItems={{ default: 'alignItemsCenter' }}
                    flexWrap={{ default: 'wrap' }}
                >
                    <FlexItem>
                        <Title headingLevel="h2" size="xl">{_("Command log")}</Title>
                        <span className="pf-v6-u-color-200 pf-v6-u-font-size-sm">
                            {cockpit.format(_("$0 entries"), log.length)}
                        </span>
                    </FlexItem>
                    <Flex spaceItems={{ default: 'spaceItemsSm' }} alignItems={{ default: 'alignItemsCenter' }}>
                        <Switch
                            id="hpssa-log-include-discovery"
                            label={_("Include read-only discovery")}
                            isChecked={includeDiscovery}
                            onChange={(_e, v) => setDiscovery(v)}
                        />
                        <Button
                            variant="secondary"
                            size="sm"
                            icon={<DownloadIcon />}
                            onClick={downloadScript}
                            isDisabled={log.length === 0}
                        >
                            {_("Export as bash script")}
                        </Button>
                        <Button
                            variant="secondary"
                            size="sm"
                            icon={<TrashIcon />}
                            onClick={clearCommandLog}
                            isDisabled={log.length === 0}
                        >
                            {_("Clear")}
                        </Button>
                    </Flex>
                </Flex>
            </StackItem>
            {sorted.length === 0
                ? (
                    <StackItem>
                        <EmptyState>
                            <EmptyStateBody>
                                {_("No ssacli commands have been run yet. Modify a setting or run a command from the toolbar to see it logged here.")}
                            </EmptyStateBody>
                        </EmptyState>
                    </StackItem>
                )
                : sorted.map(entry => (
                    <StackItem key={entry.id}>
                        <CommandLogEntryView entry={entry} />
                    </StackItem>
                ))}
        </Stack>
    );
}
