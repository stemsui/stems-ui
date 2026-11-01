import { clientEntry, type Handle } from 'remix/component'
import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
  type ImageLoadingStatus,
} from '@stemsui/registry/ui/avatar.tsx'

export const AvatarDemo = clientEntry(import.meta.url, function AvatarDemo(handle: Handle) {
  let status: ImageLoadingStatus = 'idle'

  return () => (
    <div class="flex flex-col items-center gap-6">
      <div class="flex flex-wrap items-center justify-center gap-4">
        <Avatar>
          <AvatarImage
            src="https://github.com/shadcn.png"
            alt="@shadcn"
            onLoadingStatusChange={(next) => {
              status = next
              void handle.update()
            }}
          />
          <AvatarFallback>CN</AvatarFallback>
        </Avatar>

        <Avatar>
          <AvatarImage src="/missing-avatar.png" alt="Broken image" />
          <AvatarFallback>ER</AvatarFallback>
        </Avatar>

        <Avatar size="lg">
          <AvatarImage src="https://github.com/remix-run.png" alt="@remix-run" />
          <AvatarFallback delay={600}>RR</AvatarFallback>
          <AvatarBadge />
        </Avatar>

        <Avatar size="sm">
          <AvatarFallback>SM</AvatarFallback>
        </Avatar>
      </div>

      <AvatarGroup>
        <Avatar>
          <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
          <AvatarFallback>CN</AvatarFallback>
        </Avatar>
        <Avatar>
          <AvatarImage src="https://github.com/remix-run.png" alt="@remix-run" />
          <AvatarFallback>RR</AvatarFallback>
        </Avatar>
        <Avatar>
          <AvatarFallback>AL</AvatarFallback>
        </Avatar>
        <AvatarGroupCount>+3</AvatarGroupCount>
      </AvatarGroup>

      <p class="text-sm text-muted-foreground" data-testid="avatar-status">
        First image: {status}
      </p>
    </div>
  )
})
