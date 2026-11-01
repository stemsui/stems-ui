import { clientEntry, type Handle } from 'remix/component'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@stemsui/registry/ui/accordion.tsx'

export const AccordionDemo = clientEntry(import.meta.url, function AccordionDemo(handle: Handle) {
  let open: string[] = ['shipping']

  return () => (
    <div class="flex w-full max-w-lg flex-col gap-4">
      <Accordion
        defaultValue={['shipping']}
        hiddenUntilFound
        onValueChange={(value) => {
          open = value
          void handle.update()
        }}
      >
        <AccordionItem value="shipping">
          <AccordionTrigger>How long does shipping take?</AccordionTrigger>
          <AccordionContent>
            <p>
              Standard shipping takes 3–5 business days. Express delivery arrives in 1–2 business
              days.
            </p>
            <p>Orders placed before noon ship the same day.</p>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="returns">
          <AccordionTrigger>What is your return policy?</AccordionTrigger>
          <AccordionContent>
            <p>
              Return any item within 30 days of delivery. Opened items may be subject to a 10%
              restocking fee.
            </p>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="international">
          <AccordionTrigger>Do you ship internationally?</AccordionTrigger>
          <AccordionContent>
            <p>
              Yes, we ship to over 40 countries. International orders usually arrive within 7–14
              business days.
            </p>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="gift-cards" disabled>
          <AccordionTrigger>Can I pay with a gift card?</AccordionTrigger>
          <AccordionContent>
            <p>Gift cards are coming soon.</p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <p class="text-sm text-muted-foreground" data-testid="accordion-result">
        Open: <span class="font-medium text-foreground">{open.join(', ') || 'none'}</span>
      </p>
    </div>
  )
})
