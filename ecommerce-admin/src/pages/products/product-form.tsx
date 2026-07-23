import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  useCreateProduct,
  useProduct,
  useUpdateProduct,
} from '@/api/hooks/products';
import { useBrands } from '@/api/hooks/brands';
import { useCategories } from '@/api/hooks/categories';
import type { ApiError } from '@/api/unwrap';
import MDEditor from '@uiw/react-md-editor';
import '@uiw/react-md-editor/markdown-editor.css';
import { ImageUpload } from '@/components/ImageUpload';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { suggestUsdFromCad } from '@/lib/fx';
import { centsToDollars, dollarsToCents } from '@/lib/money';
import { slugify } from '@/lib/slugify';

const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be kebab-case'),
  description: z.string().min(1, 'Description is required'),
  priceCad: z
    .string()
    .refine((v) => dollarsToCents(v) !== null, 'Enter a valid price'),
  priceUsd: z
    .string()
    .refine((v) => dollarsToCents(v) !== null, 'Enter a valid price'),
  categoryId: z.string().min(1, 'Pick a category'),
  // 'none' sentinel — Radix Select items cannot have empty-string values.
  brandId: z.string(),
  stockQty: z.coerce.number<number>().int().min(0),
  active: z.boolean(),
  images: z.array(z.string()),
});

type FormValues = z.infer<typeof formSchema>;

const EMPTY: FormValues = {
  name: '',
  slug: '',
  description: '',
  priceCad: '',
  priceUsd: '',
  categoryId: '',
  brandId: 'none',
  stockQty: 0,
  active: true,
  images: [],
};

export function ProductFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const { data: categories } = useCategories();
  const { data: brands } = useBrands();
  const { data: existing, isLoading } = useProduct(id ?? '');
  const create = useCreateProduct();
  const update = useUpdateProduct();
  const [slugTouched, setSlugTouched] = useState(isEdit);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (isEdit && existing) {
      // Deferred to a macrotask: Radix's <Select> mounts its hidden native
      // <select> before its items finish registering as native <option>s.
      // If we call form.reset() with a real categoryId in the same effect
      // flush as that initial mount, the Select's internal value-sync effect
      // can fire while the native <select> still has zero <option>s, silently
      // fail to apply the value, and echo an empty-string change event back
      // into react-hook-form — clobbering categoryId back to ''. Pushing the
      // reset past the current render/effect cycle lets Select's own item
      // registration settle first, so the value lands rather than being
      // stomped back to empty (see product-form.test.tsx "edit" suite).
      const timer = setTimeout(() => {
        form.reset({
          name: existing.name,
          slug: existing.slug,
          description: existing.description,
          priceCad: centsToDollars(existing.priceCents),
          priceUsd: centsToDollars(existing.priceUsdCents),
          categoryId: existing.categoryId,
          brandId: existing.brandId ?? 'none',
          stockQty: existing.stockQty,
          active: existing.active,
          images: existing.images,
        });
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isEdit, existing, form]);

  function onNameChange(name: string) {
    form.setValue('name', name);
    if (!slugTouched) form.setValue('slug', slugify(name));
  }

  function onAutofillUsd() {
    const suggested = suggestUsdFromCad(form.getValues('priceCad'));
    if (suggested) form.setValue('priceUsd', suggested, { shouldValidate: true });
  }

  function onSubmit(values: FormValues) {
    const body = {
      name: values.name,
      slug: values.slug,
      description: values.description,
      priceCents: dollarsToCents(values.priceCad)!,
      priceUsdCents: dollarsToCents(values.priceUsd)!,
      categoryId: values.categoryId,
      brandId: values.brandId === 'none' ? null : values.brandId,
      stockQty: values.stockQty,
      active: values.active,
      images: values.images,
    };
    const opts = {
      onSuccess: () => {
        toast.success(isEdit ? 'Product updated' : 'Product created');
        void navigate('/products');
      },
      onError: (e: unknown) =>
        toast.error((e as ApiError).message ?? 'Something went wrong'),
    };
    if (isEdit && id) update.mutate({ id, body }, opts);
    else create.mutate(body, opts);
  }

  if (isEdit && isLoading) {
    return <div className="text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold">
        {isEdit ? 'Edit product' : 'New product'}
      </h1>
      <Form {...form}>
        <form
          onSubmit={(e) => void form.handleSubmit(onSubmit)(e)}
          className="grid gap-5"
        >
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    onChange={(e) => onNameChange(e.target.value)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="slug"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Slug</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    onChange={(e) => {
                      setSlugTouched(true);
                      field.onChange(e);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <div data-color-mode="light">
                    <MDEditor
                      value={field.value}
                      onChange={(v) => field.onChange(v ?? '')}
                      height={280}
                      preview="live"
                      textareaProps={{
                        placeholder:
                          'Describe the product. Use the toolbar for bold, italic, headings, lists, links…',
                      }}
                    />
                  </div>
                </FormControl>
                <p className="text-xs text-muted-foreground">
                  Formatting toolbar with live preview — the storefront renders
                  this Markdown.
                </p>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="priceCad"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Price (CAD)</FormLabel>
                  <FormControl>
                    <Input placeholder="54.99" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="priceUsd"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Price (USD)</FormLabel>
                  <FormControl>
                    <Input placeholder="39.99" {...field} />
                  </FormControl>
                  {/* Suggestion only — the admin is expected to review it. */}
                  <Button type="button" variant="outline" onClick={onAutofillUsd}>
                    Autofill from CAD
                  </Button>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="stockQty"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Stock</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="categoryId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger aria-label="Category">
                      <SelectValue placeholder="Pick a category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {(categories ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="brandId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Brand</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger aria-label="Brand">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {(brands ?? []).map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="images"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Images</FormLabel>
                <FormControl>
                  <ImageUpload value={field.value} onChange={field.onChange} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="active"
            render={({ field }) => (
              <FormItem className="flex items-center gap-3">
                <FormLabel>Active</FormLabel>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <div className="flex gap-3">
            <Button
              type="submit"
              disabled={create.isPending || update.isPending}
            >
              {isEdit ? 'Save changes' : 'Create product'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void navigate('/products')}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
