import { clientEntry, Fragment, type Handle } from 'remix/component'
import { ScrollArea, ScrollBar } from '@stemsui/registry/ui/scroll-area.tsx'
import { Separator } from '@stemsui/registry/ui/separator.tsx'

const tags = Array.from({ length: 50 }).map((_, i, a) => `v1.2.0-beta.${a.length - i}`)

const works = [
  {
    artist: 'Ornella Binni',
    art: 'https://images.unsplash.com/photo-1465869185982-5a1a7522cbcb?auto=format&fit=crop&w=300&q=80',
  },
  {
    artist: 'Tom Byrom',
    art: 'https://images.unsplash.com/photo-1548516173-3cabfa4607e9?auto=format&fit=crop&w=300&q=80',
  },
  {
    artist: 'Vladimir Malyavko',
    art: 'https://images.unsplash.com/photo-1494337480532-3725c85fd2ab?auto=format&fit=crop&w=300&q=80',
  },
]

export const ScrollAreaDemo = clientEntry(
  import.meta.url,
  function ScrollAreaDemo(_handle: Handle) {
    return () => (
      <div class="flex flex-col items-center gap-8">
        <ScrollArea class="h-72 w-48 rounded-md border">
          <div class="p-4">
            <h4 class="mb-4 text-sm leading-none font-medium">Tags</h4>
            {tags.map((tag) => (
              <Fragment key={tag}>
                <div class="text-sm">{tag}</div>
                <Separator class="my-2" />
              </Fragment>
            ))}
          </div>
        </ScrollArea>

        <ScrollArea class="w-96 max-w-full rounded-md border whitespace-nowrap">
          <div class="flex w-max space-x-4 p-4">
            {works.map((artwork) => (
              <figure key={artwork.artist} class="shrink-0">
                <div class="overflow-hidden rounded-md">
                  <img
                    src={artwork.art}
                    alt={`Photo by ${artwork.artist}`}
                    class="aspect-[3/4] h-fit w-fit object-cover"
                    width={300}
                    height={400}
                  />
                </div>
                <figcaption class="pt-2 text-xs text-muted-foreground">
                  Photo by <span class="font-semibold text-foreground">{artwork.artist}</span>
                </figcaption>
              </figure>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    )
  },
)
