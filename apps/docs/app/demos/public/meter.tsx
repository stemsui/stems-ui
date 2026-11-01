import { clientEntry, type Handle } from 'remix/component'
import { Meter, MeterLabel, MeterValue } from '@stemsui/registry/ui/meter.tsx'

export const MeterDemo = clientEntry(import.meta.url, function MeterDemo(_handle: Handle) {
  return () => (
    <div class="flex w-full max-w-sm flex-col gap-8">
      <Meter value={24}>
        <MeterLabel>Storage used</MeterLabel>
        <MeterValue />
      </Meter>

      <Meter
        value={3.2}
        max={5}
        format={{ style: 'unit', unit: 'gigabyte', maximumFractionDigits: 1 }}
        getAriaValueText={(formatted) => `${formatted} of 5 GB`}
      >
        <MeterLabel>Bandwidth</MeterLabel>
        <MeterValue />
      </Meter>

      <Meter value={0.82} max={1} format={{ style: 'percent' }}>
        <MeterLabel>Battery</MeterLabel>
        <MeterValue />
      </Meter>
    </div>
  )
})
