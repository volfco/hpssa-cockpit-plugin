import React from 'react';
import { Modal, ModalVariant, ModalHeader, ModalBody, ModalFooter } from "@patternfly/react-core/dist/esm/components/Modal/index.js";
import { Form, FormGroup, FormHelperText } from "@patternfly/react-core/dist/esm/components/Form/index.js";
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput/index.js";
import { TextArea } from "@patternfly/react-core/dist/esm/components/TextArea/index.js";
import { FormSelect, FormSelectOption } from "@patternfly/react-core/dist/esm/components/FormSelect/index.js";
import { Switch } from "@patternfly/react-core/dist/esm/components/Switch/index.js";
import { Button } from "@patternfly/react-core/dist/esm/components/Button/index.js";
import { Alert } from "@patternfly/react-core/dist/esm/components/Alert/index.js";
import { CodeBlock, CodeBlockCode } from "@patternfly/react-core/dist/esm/components/CodeBlock/index.js";
import { HelperText, HelperTextItem } from "@patternfly/react-core/dist/esm/components/HelperText/index.js";
import { Spinner } from "@patternfly/react-core/dist/esm/components/Spinner/index.js";
import { Stack, StackItem } from "@patternfly/react-core/dist/esm/layouts/Stack/index.js";
import cockpit from 'cockpit';

const _ = cockpit.gettext;

// Helper: build an object that omits keys whose values are undefined, so we
// can spread it as JSX props without violating exactOptionalPropertyTypes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function defined(obj: Record<string, unknown>): any {
    const out: Record<string, unknown> = {};
    for (const k in obj) if (obj[k] !== undefined) out[k] = obj[k];
    return out;
}

// ---------------------------------------------------------------------------
// Field model
// ---------------------------------------------------------------------------

type FieldType = 'text' | 'number' | 'select' | 'switch' | 'textarea' | 'password';

export interface FieldDef {
    key: string;
    label: string;
    type: FieldType;
    required?: boolean;
    helper?: string;
    placeholder?: string;
    options?: { value: string; label: string }[];
    defaultValue?: string | number | boolean;
    visible?: (values: Record<string, unknown>) => boolean;
}

export type FormValues = Record<string, string | number | boolean | undefined>;

// ---------------------------------------------------------------------------
// Generic form-driven action dialog. Renders fields, handles submit + spinner
// + error + result-output panel. Re-usable across all entity actions.
// ---------------------------------------------------------------------------

interface FormDialogProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description?: React.ReactNode;
    fields: FieldDef[];
    submitLabel?: string;
    submitVariant?: 'primary' | 'danger' | 'warning';
    onSubmit: (values: FormValues) => Promise<string>;
    onSuccess?: () => void;
}

export function FormDialog({
    isOpen, onClose, title, description, fields,
    submitLabel = _("Apply"), submitVariant = 'primary',
    onSubmit, onSuccess,
}: FormDialogProps) {
    const [values, setValues] = React.useState<FormValues>({});
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [result, setResult] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (isOpen) {
            const init: FormValues = {};
            for (const f of fields) {
                if (f.defaultValue !== undefined) init[f.key] = f.defaultValue as FormValues[string];
            }
            setValues(init);
            setError(null);
            setResult(null);
            setBusy(false);
        }
    }, [isOpen, fields]);

    const set = (key: string, value: FormValues[string]) =>
        setValues(prev => ({ ...prev, [key]: value }));

    const handleSubmit = async () => {
        setBusy(true);
        setError(null);
        try {
            const out = await onSubmit(values);
            setResult(out || _("Command completed successfully."));
            onSuccess?.();
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setBusy(false);
        }
    };

    const isVisible = (f: FieldDef) => !f.visible || f.visible(values);

    const missingRequired = fields
            .filter(isVisible)
            .some(f => f.required && (values[f.key] === undefined || values[f.key] === ''));

    return (
        <Modal
            variant={ModalVariant.medium}
            isOpen={isOpen}
            onClose={onClose}
        >
            <ModalHeader title={title} description={description} />
            <ModalBody>
                {result
                    ? (
                        <Stack hasGutter>
                            <StackItem>
                                <Alert variant="success" title={_("Command completed")} isInline />
                            </StackItem>
                            {result.trim() && (
                                <StackItem>
                                    <CodeBlock>
                                        <CodeBlockCode>{result}</CodeBlockCode>
                                    </CodeBlock>
                                </StackItem>
                            )}
                        </Stack>
                    )
                    : (
                        <Form isHorizontal onSubmit={e => { e.preventDefault(); if (!busy && !missingRequired) handleSubmit(); }}>
                            {error && (
                                <Alert variant="danger" title={_("Command failed")} isInline>
                                    <CodeBlock>
                                        <CodeBlockCode>{error}</CodeBlockCode>
                                    </CodeBlock>
                                </Alert>
                            )}
                            {fields.filter(isVisible).map(f => (
                                <FormGroup key={f.key} label={f.label} fieldId={f.key} {...defined({ isRequired: f.required })}>
                                    {renderField(f, values[f.key], v => set(f.key, v))}
                                    {f.helper && (
                                        <FormHelperText>
                                            <HelperText>
                                                <HelperTextItem>{f.helper}</HelperTextItem>
                                            </HelperText>
                                        </FormHelperText>
                                    )}
                                </FormGroup>
                            ))}
                        </Form>
                    )}
            </ModalBody>
            <ModalFooter>
                {result
                    ? (
                        <Button variant="primary" onClick={onClose}>{_("Close")}</Button>
                    )
                    : (
                        <>
                            <Button
                                variant={submitVariant}
                                onClick={handleSubmit}
                                isDisabled={busy || missingRequired}
                                isLoading={busy}
                                icon={busy ? <Spinner size="md" /> : undefined}
                            >
                                {submitLabel}
                            </Button>
                            <Button variant="link" onClick={onClose} isDisabled={busy}>
                                {_("Cancel")}
                            </Button>
                        </>
                    )}
            </ModalFooter>
        </Modal>
    );
}

function renderField(f: FieldDef, value: FormValues[string], set: (v: FormValues[string]) => void) {
    switch (f.type) {
    case 'text':
    case 'password':
        return (
            <TextInput
                id={f.key}
                type={f.type === 'password' ? 'password' : 'text'}
                value={(value as string | undefined) ?? ''}
                onChange={(_e, v) => set(v)}
                {...defined({ placeholder: f.placeholder })}
            />
        );
    case 'number':
        return (
            <TextInput
                id={f.key}
                type="number"
                value={(value as number | string | undefined) ?? ''}
                onChange={(_e, v) => set(v === '' ? undefined : Number(v))}
                {...defined({ placeholder: f.placeholder })}
            />
        );
    case 'textarea':
        return (
            <TextArea
                id={f.key}
                value={(value as string | undefined) ?? ''}
                rows={4}
                onChange={(_e, v) => set(v)}
                {...defined({ placeholder: f.placeholder })}
            />
        );
    case 'select':
        return (
            <FormSelect
                id={f.key}
                value={(value as string | undefined) ?? ''}
                onChange={(_e, v) => set(v)}
            >
                <FormSelectOption value="" label="—" />
                {(f.options ?? []).map(o => (
                    <FormSelectOption key={o.value} value={o.value} label={o.label} />
                ))}
            </FormSelect>
        );
    case 'switch':
        return (
            <Switch
                id={f.key}
                isChecked={Boolean(value)}
                onChange={(_e, v) => set(v)}
                label={_("Enabled")}
            />
        );
    }
}

// ---------------------------------------------------------------------------
// Confirm dialog for destructive operations.
// ---------------------------------------------------------------------------

interface ConfirmDialogProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    body: React.ReactNode;
    confirmLabel?: string;
    confirmVariant?: 'primary' | 'danger' | 'warning';
    requireTyped?: string;
    onConfirm: () => Promise<string>;
    onSuccess?: () => void;
}

export function ConfirmDialog({
    isOpen, onClose, title, body,
    confirmLabel = _("Confirm"), confirmVariant = 'danger',
    requireTyped, onConfirm, onSuccess,
}: ConfirmDialogProps) {
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [result, setResult] = React.useState<string | null>(null);
    const [typed, setTyped] = React.useState('');

    React.useEffect(() => {
        if (isOpen) {
            setBusy(false);
            setError(null);
            setResult(null);
            setTyped('');
        }
    }, [isOpen]);

    const handle = async () => {
        setBusy(true);
        setError(null);
        try {
            const out = await onConfirm();
            setResult(out || _("Done."));
            onSuccess?.();
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setBusy(false);
        }
    };

    const canConfirm = !busy && (!requireTyped || typed === requireTyped);

    return (
        <Modal variant={ModalVariant.small} isOpen={isOpen} onClose={onClose}>
            <ModalHeader title={title} titleIconVariant={confirmVariant === 'danger' ? 'danger' : 'warning'} />
            <ModalBody>
                <Stack hasGutter>
                    {result
                        ? <StackItem><Alert variant="success" title={_("Command completed")} isInline /></StackItem>
                        : <StackItem>{body}</StackItem>}
                    {error && (
                        <StackItem>
                            <Alert variant="danger" title={_("Command failed")} isInline>
                                <CodeBlock>
                                    <CodeBlockCode>{error}</CodeBlockCode>
                                </CodeBlock>
                            </Alert>
                        </StackItem>
                    )}
                    {!result && requireTyped && (
                        <StackItem>
                            <FormGroup label={cockpit.format(_("Type \"$0\" to confirm"), requireTyped)} fieldId="confirm-typed">
                                <TextInput id="confirm-typed" value={typed} onChange={(_e, v) => setTyped(v)} />
                            </FormGroup>
                        </StackItem>
                    )}
                </Stack>
            </ModalBody>
            <ModalFooter>
                {result
                    ? <Button variant="primary" onClick={onClose}>{_("Close")}</Button>
                    : (
                        <>
                            <Button variant={confirmVariant} onClick={handle} isDisabled={!canConfirm} isLoading={busy}>
                                {confirmLabel}
                            </Button>
                            <Button variant="link" onClick={onClose} isDisabled={busy}>
                                {_("Cancel")}
                            </Button>
                        </>
                    )}
            </ModalFooter>
        </Modal>
    );
}

// ---------------------------------------------------------------------------
// Result/output viewer (for show commands).
// ---------------------------------------------------------------------------

interface OutputDialogProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    fetch: () => Promise<string>;
}

export function OutputDialog({ isOpen, onClose, title, fetch }: OutputDialogProps) {
    const [output, setOutput] = React.useState<string>('');
    const [error, setError] = React.useState<string | null>(null);
    const [busy, setBusy] = React.useState(false);

    React.useEffect(() => {
        if (!isOpen) return;
        setBusy(true);
        setError(null);
        setOutput('');
        fetch().then(setOutput)
                .catch(e => setError(e instanceof Error ? e.message : String(e)))
                .finally(() => setBusy(false));
    }, [isOpen, fetch]);

    return (
        <Modal variant={ModalVariant.large} isOpen={isOpen} onClose={onClose}>
            <ModalHeader title={title} />
            <ModalBody>
                {busy && <Spinner />}
                {error && (
                    <Alert variant="danger" title={_("Command failed")} isInline>
                        <CodeBlock><CodeBlockCode>{error}</CodeBlockCode></CodeBlock>
                    </Alert>
                )}
                {output && (
                    <CodeBlock>
                        <CodeBlockCode>{output}</CodeBlockCode>
                    </CodeBlock>
                )}
            </ModalBody>
            <ModalFooter>
                <Button variant="primary" onClick={onClose}>{_("Close")}</Button>
            </ModalFooter>
        </Modal>
    );
}

// ---------------------------------------------------------------------------
// Raw ssacli command runner — escape hatch for the long tail of operations
// (encryption setup, SPDM, debug, anything not covered by typed wrappers).
// ---------------------------------------------------------------------------

interface RawCommandDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onRun: (cmdline: string) => Promise<string>;
}

export function RawCommandDialog({ isOpen, onClose, onRun }: RawCommandDialogProps) {
    const [cmd, setCmd] = React.useState('');
    const [busy, setBusy] = React.useState(false);
    const [output, setOutput] = React.useState<string | null>(null);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (isOpen) {
            setCmd('');
            setOutput(null);
            setError(null);
            setBusy(false);
        }
    }, [isOpen]);

    const handle = async () => {
        if (!cmd.trim()) return;
        setBusy(true);
        setError(null);
        setOutput(null);
        try {
            const out = await onRun(cmd);
            setOutput(out || _("(no output)"));
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal variant={ModalVariant.large} isOpen={isOpen} onClose={onClose}>
            <ModalHeader
title={_("Run ssacli command")}
                         description={_("Execute any ssacli command. The 'ssacli' prefix is optional.")}
            />
            <ModalBody>
                <Stack hasGutter>
                    <StackItem>
                        <FormGroup label={_("Command")} fieldId="raw-cmd" isRequired>
                            <TextInput
                                id="raw-cmd"
                                value={cmd}
                                placeholder="ctrl slot=1 show detail"
                                onChange={(_e, v) => setCmd(v)}
                                onKeyDown={e => { if (e.key === 'Enter' && !busy) handle(); }}
                            />
                            <FormHelperText>
                                <HelperText>
                                    <HelperTextItem>
                                        {_("Examples: \"ctrl slot=1 show detail\", \"ctrl slot=1 modify cacheratio=25/75\"")}
                                    </HelperTextItem>
                                </HelperText>
                            </FormHelperText>
                        </FormGroup>
                    </StackItem>
                    {error && (
                        <StackItem>
                            <Alert variant="danger" title={_("Command failed")} isInline>
                                <CodeBlock><CodeBlockCode>{error}</CodeBlockCode></CodeBlock>
                            </Alert>
                        </StackItem>
                    )}
                    {output && (
                        <StackItem>
                            <CodeBlock>
                                <CodeBlockCode>{output}</CodeBlockCode>
                            </CodeBlock>
                        </StackItem>
                    )}
                </Stack>
            </ModalBody>
            <ModalFooter>
                <Button variant="primary" onClick={handle} isDisabled={busy || !cmd.trim()} isLoading={busy}>
                    {_("Run")}
                </Button>
                <Button variant="link" onClick={onClose} isDisabled={busy}>
                    {_("Close")}
                </Button>
            </ModalFooter>
        </Modal>
    );
}
