import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useCategories } from '@/api/hooks/categories';
import { useProducts } from '@/api/hooks/products';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatUsd } from '@/lib/money';
import { BulkUploadDialog } from './bulk-upload-dialog';

const ALL_CATEGORIES = '__all__';

export function ProductsPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const [showInactive, setShowInactive] = useState(true);
  const [page, setPage] = useState(1);

  const { data: categories } = useCategories();
  const { data, isLoading, error } = useProducts({
    q: q || undefined,
    category: category === ALL_CATEGORIES ? undefined : category,
    page,
    all: showInactive,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Products</h1>
        <div className="flex items-center gap-2">
          <BulkUploadDialog
            categoryNames={(categories ?? []).map((c) => c.name)}
          />
          <Button asChild>
            <Link to="/products/new">New product</Link>
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search products…"
          className="max-w-xs"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <Select
          value={category}
          onValueChange={(v) => {
            setCategory(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_CATEGORIES}>All categories</SelectItem>
            {(categories ?? []).map((c) => (
              <SelectItem key={c.id} value={c.slug}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Switch
            id="show-inactive"
            checked={showInactive}
            onCheckedChange={(v) => {
              setShowInactive(v);
              setPage(1);
            }}
          />
          <Label htmlFor="show-inactive">Include inactive</Label>
        </div>
      </div>

      {isLoading && <div className="text-muted-foreground">Loading…</div>}
      {error != null && (
        <div className="text-destructive">Failed to load products.</div>
      )}

      {data && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((p) => (
                <TableRow
                  key={p.id}
                  className="cursor-pointer"
                  onClick={() => void navigate(`/products/${p.id}`)}
                >
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.category?.name ?? '—'}</TableCell>
                  <TableCell>{formatUsd(p.priceCents)}</TableCell>
                  <TableCell>{p.stockQty}</TableCell>
                  <TableCell>
                    {p.averageRating === null
                      ? '—'
                      : `${p.averageRating} (${p.reviewCount})`}
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.active ? 'default' : 'secondary'}>
                      {p.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {data.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    No products found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="mt-4 flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {data.page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
