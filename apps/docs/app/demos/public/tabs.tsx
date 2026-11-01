import { clientEntry, type Handle } from 'remix/component'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@stemsui/registry/ui/tabs.tsx'

const cardClass =
  'flex flex-col gap-6 rounded-xl border bg-card py-6 text-card-foreground shadow-sm'
const inputClass =
  'h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30'
const buttonClass =
  'inline-flex h-9 w-fit items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90'

function Field(handle: Handle<{ id: string; label: string; password?: boolean; value?: string }>) {
  return () => {
    let { id, label, password, value } = handle.props
    return (
      <div class="grid gap-3">
        <label for={id} class="text-sm leading-none font-medium">
          {label}
        </label>
        {password ? (
          <input id={id} type="password" class={inputClass} />
        ) : (
          <input id={id} type="text" value={value} class={inputClass} />
        )}
      </div>
    )
  }
}

export const TabsDemo = clientEntry(import.meta.url, function TabsDemo(handle: Handle) {
  let section = 'general'

  return () => (
    <div class="flex w-full max-w-sm flex-col gap-10">
      <Tabs defaultValue="account">
        <TabsList>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="password">Password</TabsTrigger>
        </TabsList>
        <TabsContent value="account">
          <div class={cardClass}>
            <div class="grid gap-1.5 px-6">
              <h3 class="leading-none font-semibold">Account</h3>
              <p class="text-sm text-muted-foreground">
                Make changes to your account here. Click save when you're done.
              </p>
            </div>
            <div class="grid gap-6 px-6">
              <Field id="tabs-demo-name" label="Name" value="Pedro Duarte" />
              <Field id="tabs-demo-username" label="Username" value="@peduarte" />
            </div>
            <div class="px-6">
              <button type="button" class={buttonClass}>
                Save changes
              </button>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="password">
          <div class={cardClass}>
            <div class="grid gap-1.5 px-6">
              <h3 class="leading-none font-semibold">Password</h3>
              <p class="text-sm text-muted-foreground">
                Change your password here. After saving, you'll be logged out.
              </p>
            </div>
            <div class="grid gap-6 px-6">
              <Field id="tabs-demo-current" label="Current password" password />
              <Field id="tabs-demo-new" label="New password" password />
            </div>
            <div class="px-6">
              <button type="button" class={buttonClass}>
                Save password
              </button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Tabs
        orientation="vertical"
        value={section}
        onValueChange={(value) => {
          section = value
          void handle.update()
        }}
      >
        <TabsList variant="line" activateOnFocus>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="billing" disabled>
            Billing
          </TabsTrigger>
        </TabsList>
        <TabsContent value="general" class="text-muted-foreground">
          Workspace name, language, and time zone.
        </TabsContent>
        <TabsContent value="notifications" class="text-muted-foreground">
          Email and push notification preferences.
        </TabsContent>
        <TabsContent value="billing" class="text-muted-foreground">
          Plans and invoices.
        </TabsContent>
      </Tabs>

      <p class="text-sm text-muted-foreground" data-testid="tabs-result">
        Vertical tabs: <span class="font-medium text-foreground">{section}</span>
      </p>
    </div>
  )
})
