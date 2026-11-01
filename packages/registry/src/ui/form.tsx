import type { Handle, Props } from 'remix/component'
import * as form from 'stems-ui/form'

import { cn } from '#stems/lib/utils.ts'

export type FormProps = Props<'form'> & Omit<form.FormContextProps, 'children'>

/**
 * A native `<form>` with Stems validation: fields inside validate on submit (or per
 * `validationMode`), invalid submissions are blocked and the first invalid control is focused,
 * and server `errors` (keyed by field name) show on their fields. Without JavaScript it is a
 * plain form that the server handles.
 */
export function Form(handle: Handle<FormProps>) {
  return () => {
    let {
      class: className,
      mix,
      errors,
      onClearErrors,
      validationMode,
      onFormSubmit,
      actionsRef,
      ...props
    } = handle.props

    return (
      <form.Context
        errors={errors}
        onClearErrors={onClearErrors}
        validationMode={validationMode}
        onFormSubmit={onFormSubmit}
        actionsRef={actionsRef}
      >
        <form data-slot="form" {...props} class={cn(className)} mix={[form.root(), mix]} />
      </form.Context>
    )
  }
}

export { onFormSubmit } from 'stems-ui/form'
export type { FormErrors, FormSubmitEvent, FormValues } from 'stems-ui/form'
