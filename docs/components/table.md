# Table

Styled native HTML table parts. Table does not sort, filter, or paginate records.
Use [Data Table](/components/data-table) when you need those features.

## Usage

Install the component with `npx shadcn add @stemsui/table`.
Import its parts from your installed `ui/table.tsx` file.
All parts accept the corresponding native element props, including `class`, `mix`, and `children`.

```tsx
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#app/ui/table.tsx'

function Invoices() {
  return () => (
    <Table>
      <TableCaption>Recent invoices</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Invoice</TableHead>
          <TableHead>Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>INV001</TableCell>
          <TableCell>$250.00</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}
```

## Parts

| Export         | Native element                                 | Styling hook                                       |
| -------------- | ---------------------------------------------- | -------------------------------------------------- |
| `Table`        | `<table>` inside a horizontal scroll container | `data-slot="table"`, `data-slot="table-container"` |
| `TableHeader`  | `<thead>`                                      | `data-slot="table-header"`                         |
| `TableBody`    | `<tbody>`                                      | `data-slot="table-body"`                           |
| `TableFooter`  | `<tfoot>`                                      | `data-slot="table-footer"`                         |
| `TableRow`     | `<tr>`                                         | `data-slot="table-row"`                            |
| `TableHead`    | `<th scope="col">`                             | `data-slot="table-head"`                           |
| `TableCell`    | `<td>`                                         | `data-slot="table-cell"`                           |
| `TableCaption` | `<caption>`                                    | `data-slot="table-caption"`                        |

Caller classes override conflicting default classes.
Set `data-selected=""` on a row to give it the selected background.
Table uses shadcn theme variables and supports dark mode and RTL text direction.

## Accessibility

Give the table a caption or an accessible name through `aria-label` or `aria-labelledby`.
Use `TableHead` for headers and `TableCell` for data.
For row headers, pass `scope="row"` to `TableHead`.
Keep native table semantics instead of adding `role="grid"` without grid keyboard behavior.
