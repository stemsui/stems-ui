import type { Handle, Props, RemixNode } from 'remix/component'
import * as field from 'stems-ui/field'
import * as fieldset from 'stems-ui/fieldset'

import { cn } from '#stems/lib/utils.ts'
import { Label } from '#stems/ui/label.tsx'
import { Separator } from '#stems/ui/separator.tsx'

// Behavior parts only apply inside their Context, so these components also work as plain
// layout (for example a <FieldLabel> wrapping a choice card, as in shadcn's examples).
function inField(handle: Handle<any>) {
  return handle.context.get(field.Context) !== undefined
}

function inFieldset(handle: Handle<any>) {
  return handle.context.get(fieldset.Context) !== undefined
}

export type FieldSetProps = Props<'fieldset'> & fieldset.FieldsetContextProps

export function FieldSet(handle: Handle<FieldSetProps>) {
  return () => {
    let { class: className, mix, disabled, ...props } = handle.props

    return (
      <fieldset.Context disabled={disabled}>
        <fieldset
          data-slot="field-set"
          {...props}
          class={cn(
            'flex flex-col gap-6 has-[>[data-slot=checkbox-group]]:gap-3 has-[>[data-slot=radio-group]]:gap-3',
            className,
          )}
          mix={[fieldset.root(), mix]}
        />
      </fieldset.Context>
    )
  }
}

export type FieldLegendProps = Props<'legend'> & { variant?: 'legend' | 'label' }

export function FieldLegend(handle: Handle<FieldLegendProps>) {
  return () => {
    let { class: className, mix, variant = 'legend', ...props } = handle.props

    return (
      <legend
        data-slot="field-legend"
        data-variant={variant}
        {...props}
        class={cn(
          'mb-3 font-medium data-[variant=label]:text-sm data-[variant=legend]:text-base',
          className,
        )}
        mix={[inFieldset(handle) && fieldset.legend(), mix]}
      />
    )
  }
}

export function FieldGroup(handle: Handle<Props<'div'>>) {
  return () => {
    let { class: className, ...props } = handle.props

    return (
      <div
        data-slot="field-group"
        {...props}
        class={cn(
          'group/field-group @container/field-group flex w-full flex-col gap-7 data-[slot=checkbox-group]:gap-3 *:data-[slot=field-group]:gap-4',
          className,
        )}
      />
    )
  }
}

const orientations = {
  vertical: 'flex-col *:w-full [&>.sr-only]:w-auto',
  horizontal:
    'flex-row items-center has-[>[data-slot=field-content]]:items-start *:data-[slot=field-label]:flex-auto has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px',
  responsive:
    'flex-col *:w-full @md/field-group:flex-row @md/field-group:items-center @md/field-group:*:w-auto @md/field-group:has-[>[data-slot=field-content]]:items-start @md/field-group:*:data-[slot=field-label]:flex-auto [&>.sr-only]:w-auto @md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px',
} as const

export type FieldOrientation = keyof typeof orientations

export type FieldProps = Props<'div'> &
  Omit<field.FieldContextProps, 'children'> & { orientation?: FieldOrientation }

/** A `<field.Context>` with its root `<div>`. Field options are forwarded to the Context. */
export function Field(handle: Handle<FieldProps>) {
  return () => {
    let {
      class: className,
      mix,
      orientation = 'vertical',
      name,
      disabled,
      invalid,
      dirty,
      touched,
      validate,
      validationMode,
      validationDebounceTime,
      actionsRef,
      ...props
    } = handle.props

    return (
      <field.Context
        name={name}
        disabled={disabled}
        invalid={invalid}
        dirty={dirty}
        touched={touched}
        validate={validate}
        validationMode={validationMode}
        validationDebounceTime={validationDebounceTime}
        actionsRef={actionsRef}
      >
        <div
          role="group"
          data-slot="field"
          data-orientation={orientation}
          {...props}
          class={cn(
            'group/field flex w-full gap-3 data-invalid:text-destructive',
            orientations[orientation],
            className,
          )}
          mix={[field.root(), mix]}
        />
      </field.Context>
    )
  }
}

export function FieldContent(handle: Handle<Props<'div'>>) {
  return () => {
    let { class: className, ...props } = handle.props

    return (
      <div
        data-slot="field-content"
        {...props}
        class={cn('group/field-content flex flex-1 flex-col gap-1 leading-snug', className)}
      />
    )
  }
}

export function FieldLabel(handle: Handle<Props<'label'>>) {
  return () => {
    let { class: className, mix, ...props } = handle.props

    return (
      <Label
        data-slot="field-label"
        {...props}
        class={cn(
          'group/field-label peer/field-label flex w-fit gap-2 leading-snug group-data-disabled/field:opacity-50 has-data-checked:border-primary/30 has-data-checked:bg-primary/5 has-[>[data-slot=field]]:rounded-md has-[>[data-slot=field]]:border has-[>[data-slot=field]]:not-has-[:disabled,[data-disabled]]:hover:bg-muted/50 has-[>[data-slot=field]]:has-[:focus-visible]:border-ring has-[>[data-slot=field]]:has-[:focus-visible]:ring-3 has-[>[data-slot=field]]:has-[:focus-visible]:ring-ring/50 *:data-[slot=field]:p-3 dark:has-data-checked:border-primary/20 dark:has-data-checked:bg-primary/10',
          'has-[>[data-slot=field]]:w-full has-[>[data-slot=field]]:flex-col',
          className,
        )}
        mix={[inField(handle) && field.label(), mix]}
      />
    )
  }
}

export function FieldTitle(handle: Handle<Props<'div'>>) {
  return () => {
    let { class: className, ...props } = handle.props

    return (
      <div
        data-slot="field-label"
        {...props}
        class={cn(
          'flex w-fit items-center gap-2 text-sm font-medium group-data-disabled/field:opacity-50',
          className,
        )}
      />
    )
  }
}

export function FieldDescription(handle: Handle<Props<'p'>>) {
  return () => {
    let { class: className, mix, ...props } = handle.props

    return (
      <p
        data-slot="field-description"
        {...props}
        class={cn(
          'text-left text-sm leading-normal font-normal text-muted-foreground group-has-data-horizontal/field:text-balance [[data-variant=legend]+&]:-mt-1.5',
          'last:mt-0 nth-last-2:-mt-1',
          '[&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary',
          className,
        )}
        mix={[inField(handle) && field.description(), mix]}
      />
    )
  }
}

export function FieldSeparator(handle: Handle<Props<'div'>>) {
  return () => {
    let { class: className, children, ...props } = handle.props

    return (
      <div
        data-slot="field-separator"
        data-content={children ? 'true' : 'false'}
        {...props}
        class={cn(
          'relative -my-2 h-5 text-sm group-data-[variant=outline]/field-group:-mb-2',
          className,
        )}
      >
        <Separator class="absolute inset-0 top-1/2" />
        {children ? (
          <span
            class="relative mx-auto block w-fit bg-background px-2 text-muted-foreground"
            data-slot="field-separator-content"
          >
            {children}
          </span>
        ) : null}
      </div>
    )
  }
}

function renderMessages(messages: string[]): RemixNode {
  let unique = [...new Set(messages.filter(Boolean))]
  if (unique.length === 0) return null
  if (unique.length === 1) return unique[0]
  return (
    <ul class="ml-4 flex list-disc flex-col gap-1">
      {unique.map((message) => (
        <li>{message}</li>
      ))}
    </ul>
  )
}

export type FieldErrorProps = Props<'div'> &
  field.FieldErrorOptions & {
    /** shadcn's error list (e.g. from a validation library). Shown whenever it has messages. */
    errors?: Array<{ message?: string } | undefined>
  }

/**
 * Inside a `<Field>`, shows when the field is invalid (or when `match` matches), with the
 * children, the `errors` messages, or the field's own validation messages. Outside a Field it
 * renders `errors` / children like shadcn's FieldError.
 */
export function FieldError(handle: Handle<FieldErrorProps>) {
  return () => {
    let { class: className, mix, children, errors, match, ...props } = handle.props
    let messages = (errors ?? []).map((error) => error?.message ?? '').filter(Boolean)
    let hasChildren = children !== undefined && children !== null && children !== false
    let attached = inField(handle)

    let content: RemixNode = hasChildren ? (
      children
    ) : messages.length > 0 ? (
      renderMessages(messages)
    ) : attached ? (
      <field.Validity>{(state) => renderMessages(state.errors)}</field.Validity>
    ) : null

    if (!attached && !content) return null

    return (
      <div
        role="alert"
        data-slot="field-error"
        {...props}
        class={cn('text-sm font-normal text-destructive', className)}
        mix={[
          attached && field.error({ match: match ?? (messages.length > 0 ? true : undefined) }),
          mix,
        ]}
      >
        {content}
      </div>
    )
  }
}
