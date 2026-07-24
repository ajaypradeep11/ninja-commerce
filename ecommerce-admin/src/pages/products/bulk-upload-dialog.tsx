import { useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import { toast } from 'sonner';
import { useBulkCreateProducts } from '@/api/hooks/products';
import type { BulkProductItemDto } from '@/api/generated/types.gen';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const SAMPLE_CSV = `name,description,price,priceUsd,stock,category,active
Fairy Tail Guild LED Lamp,16-color RGB lamp with remote,49.99,36.99,10,Anime Lamps,true
Naruto Uzumaki LED Lamp,Sage mode pose with wood base,39.99,28.99,5,Anime Lamps,true`;

interface ParsedRow {
  row: number;
  name: string;
  category: string;
  price: string;
  priceUsd: string;
  stock: string;
  item?: BulkProductItemDto; // present when the row is valid
  error?: string;
}

// Parse + validate a single CSV row against the known category names.
export function validateRow(
  r: Record<string, string | undefined>,
  row: number,
  categoryNames: Set<string>,
): ParsedRow {
  const name = (r.name ?? '').trim();
  const category = (r.category ?? '').trim();
  const priceStr = (r.price ?? '').trim();
  const priceUsdStr = (r.priceUsd ?? '').trim();
  const stockStr = (r.stock ?? '').trim();
  const base = { row, name, category, price: priceStr, priceUsd: priceUsdStr, stock: stockStr };

  if (!name) return { ...base, error: 'name is required' };
  const price = Number(priceStr);
  if (priceStr === '' || !Number.isFinite(price) || price < 0)
    return { ...base, error: 'invalid price' };
  const priceUsd = Number(priceUsdStr);
  if (priceUsdStr === '' || !Number.isFinite(priceUsd) || priceUsd < 0)
    return { ...base, error: 'invalid USD price' };
  const stock = Number(stockStr);
  if (!Number.isInteger(stock) || stock < 0)
    return { ...base, error: 'invalid stock' };
  if (!categoryNames.has(category.toLowerCase()))
    return { ...base, error: `unknown category "${category}"` };

  const activeRaw = (r.active ?? '').trim().toLowerCase();
  const active =
    activeRaw === '' ? true : ['true', '1', 'yes', 'y'].includes(activeRaw);

  return {
    ...base,
    item: {
      name,
      description: (r.description ?? '').trim(),
      priceCents: Math.round(price * 100),
      priceUsdCents: Math.round(priceUsd * 100),
      stockQty: stock,
      categoryName: category,
      active,
    },
  };
}

function downloadSample() {
  const url = URL.createObjectURL(
    new Blob([SAMPLE_CSV], { type: 'text/csv;charset=utf-8' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = 'products-sample.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export function BulkUploadDialog({
  categoryNames,
}: {
  categoryNames: string[];
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bulk = useBulkCreateProducts();

  const catSet = useMemo(
    () => new Set(categoryNames.map((n) => n.trim().toLowerCase())),
    [categoryNames],
  );

  function onFile(file: File) {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: (res) => {
        setRows(res.data.map((r, i) => validateRow(r, i + 1, catSet)));
      },
    });
  }

  function reset() {
    setRows(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  const valid = rows?.filter((r) => r.item) ?? [];
  const invalid = rows?.filter((r) => r.error) ?? [];

  async function doImport() {
    try {
      const res = await bulk.mutateAsync({
        items: valid.map((v) => v.item as BulkProductItemDto),
      });
      toast.success(
        `Imported ${res.created} product${res.created === 1 ? '' : 's'}`,
      );
      res.errors?.forEach((e) => toast.error(`Row ${e.row}: ${e.message}`));
      setOpen(false);
      reset();
    } catch {
      toast.error('Bulk import failed');
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">Bulk upload</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk upload products</DialogTitle>
          <DialogDescription>
            Upload a CSV of products. Category must already exist. Prices
            (price = CAD, priceUsd = USD) are in dollars. Images are added
            per-product afterwards.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" onClick={downloadSample}>
            Download sample CSV
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            aria-label="CSV file"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
            className="text-sm"
          />
        </div>

        {rows && (
          <>
            <p className="text-sm text-muted-foreground">
              {valid.length} valid · {invalid.length} with errors
            </p>
            <div className="max-h-72 overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Price (CAD)</TableHead>
                    <TableHead>Price (USD)</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.row}>
                      <TableCell className="text-muted-foreground">
                        {r.row}
                      </TableCell>
                      <TableCell>{r.name || '—'}</TableCell>
                      <TableCell>{r.category || '—'}</TableCell>
                      <TableCell>{r.price || '—'}</TableCell>
                      <TableCell>{r.priceUsd || '—'}</TableCell>
                      <TableCell>
                        {r.item ? (
                          <span className="text-green-600">ok</span>
                        ) : (
                          <span className="text-destructive">{r.error}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        <DialogFooter>
          <Button
            onClick={doImport}
            disabled={valid.length === 0 || bulk.isPending}
          >
            {bulk.isPending
              ? 'Importing…'
              : `Import ${valid.length} valid product${valid.length === 1 ? '' : 's'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
