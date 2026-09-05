import { useEffect, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type ProductRow = {
  id: number; name: string; slug: string; price: string; currency: string;
  category: string; status: "draft" | "published" | "archived";
};

const emptyForm = {
  name: "", slug: "", description: "", shortDescription: "", price: "",
  currency: "USD", categoryId: "", image: "", status: "draft",
  featured: false, downloadType: "file", features: "", tags: "",
  mockup: "book", accent: "", checkoutUrl: "", priceNote: "",
  format: "standard", ageRange: "",
};

type FormState = typeof emptyForm;

function toForm(p: Record<string, unknown>): FormState {
  return {
    ...emptyForm,
    name: String(p.name ?? ""), slug: String(p.slug ?? ""),
    description: String(p.description ?? ""),
    shortDescription: String(p.shortDescription ?? ""),
    price: String(p.price ?? ""), currency: String(p.currency ?? "USD"),
    categoryId: String(p.categoryId ?? ""), image: String(p.image ?? ""),
    status: String(p.status ?? "draft"),
    featured: Number(p.featured ?? 0) === 1,
    downloadType: String(p.downloadType ?? "file"),
    features: Array.isArray(p.features) ? (p.features as string[]).join(", ") : "",
    tags: Array.isArray(p.tags) ? (p.tags as string[]).join(", ") : "",
    mockup: String(p.mockup ?? "book"), accent: String(p.accent ?? ""),
    checkoutUrl: String(p.checkoutUrl ?? ""), priceNote: String(p.priceNote ?? ""),
    format: String(p.format ?? "standard"), ageRange: String(p.ageRange ?? ""),
  };
}

function splitList(value: string) {
  return value.split(",").map(s => s.trim()).filter(Boolean);
}

export default function AdminProducts() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"draft" | "published" | "archived" | "">("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [assetsFor, setAssetsFor] = useState<ProductRow | null>(null);

  const utils = trpc.useUtils();
  const products = trpc.admin.products.list.useQuery({
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(status ? { status } : {}),
  });
  const categories = trpc.admin.categories.list.useQuery();
  const detail = trpc.admin.products.getById.useQuery(
    { id: editingId ?? 0 },
    { enabled: editingId !== null && dialogOpen },
  );
  useEffect(() => {
    if (detail.data && editingId !== null) {
      setForm(toForm(detail.data as unknown as Record<string, unknown>));
    }
  }, [detail.data, editingId]);

  const invalidate = () => {
    utils.admin.products.list.invalidate();
    utils.admin.dashboard.invalidate();
  };

  const create = trpc.admin.products.create.useMutation({
    onSuccess: () => { toast.success("Product created"); setDialogOpen(false); setForm(emptyForm); setEditingId(null); invalidate(); },
    onError: error => toast.error(error.message),
  });
  const update = trpc.admin.products.update.useMutation({
    onSuccess: () => { toast.success("Product updated"); setDialogOpen(false); setForm(emptyForm); setEditingId(null); invalidate(); },
    onError: error => toast.error(error.message),
  });
  const publish = trpc.admin.products.publish.useMutation({
    onSuccess: () => { toast.success("Product published"); invalidate(); },
    onError: error => toast.error(error.message),
  });
  const archive = trpc.admin.products.archive.useMutation({
    onSuccess: () => { toast.success("Product archived"); invalidate(); },
    onError: error => toast.error(error.message),
  });

  const openCreate = () => { setEditingId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (row: ProductRow) => { setEditingId(row.id); setDialogOpen(true); };

  const submit = () => {
    if (!form.categoryId) { toast.error("Please choose a category"); return; }
    if (editingId === null) {
      create.mutate({
        name: form.name, slug: form.slug, description: form.description,
        shortDescription: form.shortDescription || null, price: form.price,
        currency: form.currency, categoryId: Number(form.categoryId),
        image: form.image || null, status: form.status as "draft" | "published" | "archived",
        featured: form.featured, downloadType: form.downloadType as "file" | "external",
        features: splitList(form.features), tags: splitList(form.tags),
        mockup: form.mockup as "book" | "dashboard" | "browser" | "phone",
        accent: form.accent || null, checkoutUrl: form.checkoutUrl || null,
        priceNote: form.priceNote || null, format: form.format as "standard" | "story" | "game",
        ageRange: form.ageRange || null,
      });
    } else {
      update.mutate({
        id: editingId,
        name: form.name, slug: form.slug, description: form.description,
        shortDescription: form.shortDescription || null, price: form.price,
        currency: form.currency, categoryId: Number(form.categoryId),
        image: form.image || null, status: form.status as "draft" | "published" | "archived",
        featured: form.featured, downloadType: form.downloadType as "file" | "external",
        features: splitList(form.features), tags: splitList(form.tags),
        mockup: form.mockup as "book" | "dashboard" | "browser" | "phone",
        accent: form.accent || null, checkoutUrl: form.checkoutUrl || null,
        priceNote: form.priceNote || null, format: form.format as "standard" | "story" | "game",
        ageRange: form.ageRange || null,
      });
    }
  };

  const set = (key: keyof FormState, value: string | boolean) =>
    setForm(prev => ({ ...prev, [key]: value }));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-semibold">Products</h1>
        <Button onClick={openCreate}>New product</Button>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <Input placeholder="Search name or slug…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
        <select value={status} onChange={e => setStatus(e.target.value as typeof status)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {products.isPending ? <p>Loading products…</p>
        : products.isError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6">
            <p className="font-semibold">Products unavailable</p>
            <p className="text-sm text-muted-foreground">{products.error.message}</p>
          </div>
        ) : products.data.length === 0 ? (
          <div className="rounded-xl border p-8 text-center text-muted-foreground">No products found.</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-3">Name</th><th className="p-3">Price</th>
                  <th className="p-3">Category</th><th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.data.map(row => (
                  <tr key={row.id} className="border-t">
                    <td className="p-3 font-medium">{row.name}<br /><span className="text-xs text-muted-foreground">{row.slug}</span></td>
                    <td className="p-3">{row.price} {row.currency}</td>
                    <td className="p-3">{row.category}</td>
                    <td className="p-3"><span className="rounded-full bg-muted px-2 py-0.5 text-xs">{row.status}</span></td>
                    <td className="p-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEdit(row)}>Edit</Button>
                        <Button size="sm" variant="outline" onClick={() => setAssetsFor(row)}>Assets</Button>
                        {row.status !== "published" && (
                          <Button size="sm" onClick={() => publish.mutate({ id: row.id })} disabled={publish.isPending}>Publish</Button>
                        )}
                        {row.status !== "archived" && (
                          <Button size="sm" variant="destructive" onClick={() => { if (window.confirm(`Archive "${row.name}"?`)) archive.mutate({ id: row.id }); }} disabled={archive.isPending}>Archive</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      <Dialog open={dialogOpen} onOpenChange={open => { setDialogOpen(open); if (!open) { setEditingId(null); setForm(emptyForm); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId === null ? "New product" : "Edit product"}</DialogTitle>
            <DialogDescription>Fields map to the existing product model. Slug must stay unique.</DialogDescription>
          </DialogHeader>
          {editingId !== null && detail.isPending ? <p>Loading…</p> : (
            <ProductForm
              form={form}
              onChange={set}
              categories={(categories.data ?? []).map(c => ({ id: c.id, name: c.name }))}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={create.isPending || update.isPending}>
              {create.isPending || update.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {assetsFor && (
        <AssetManager
          product={assetsFor}
          onClose={() => setAssetsFor(null)}
        />
      )}
    </div>
  );
}

function ProductForm({ form, onChange, categories }: {
  form: FormState;
  onChange: (key: keyof FormState, value: string | boolean) => void;
  categories: Array<{ id: number; name: string }>;
}) {
  const field = "grid gap-1.5";
  const label = "text-xs font-medium text-muted-foreground";
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className={field}><span className={label}>Name *</span><Input value={form.name} onChange={e => onChange("name", e.target.value)} /></div>
      <div className={field}><span className={label}>Slug *</span><Input value={form.slug} onChange={e => onChange("slug", e.target.value)} placeholder="my-product" /></div>
      <div className={`${field} sm:col-span-2`}><span className={label}>Description *</span><Textarea value={form.description} onChange={e => onChange("description", e.target.value)} rows={3} /></div>
      <div className={`${field} sm:col-span-2`}><span className={label}>Short description</span><Input value={form.shortDescription} onChange={e => onChange("shortDescription", e.target.value)} /></div>
      <div className={field}><span className={label}>Price *</span><Input value={form.price} onChange={e => onChange("price", e.target.value)} placeholder="19.00" inputMode="decimal" /></div>
      <div className={field}><span className={label}>Currency</span><Input value={form.currency} onChange={e => onChange("currency", e.target.value.toUpperCase())} maxLength={3} /></div>
      <div className={field}><span className={label}>Category *</span>
        <select value={form.categoryId} onChange={e => onChange("categoryId", e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
          <option value="">Choose…</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className={field}><span className={label}>Status</span>
        <select value={form.status} onChange={e => onChange("status", e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
          <option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option>
        </select>
      </div>
      <div className={field}><span className={label}>Image</span><Input value={form.image} onChange={e => onChange("image", e.target.value)} placeholder="/images/… or URL" /></div>
      <div className={field}><span className={label}>Checkout URL</span><Input value={form.checkoutUrl} onChange={e => onChange("checkoutUrl", e.target.value)} /></div>
      <div className={field}><span className={label}>Mockup</span>
        <select value={form.mockup} onChange={e => onChange("mockup", e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
          <option value="book">Book</option><option value="dashboard">Dashboard</option><option value="browser">Browser</option><option value="phone">Phone</option>
        </select>
      </div>
      <div className={field}><span className={label}>Format</span>
        <select value={form.format} onChange={e => onChange("format", e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
          <option value="standard">Standard</option><option value="story">Story</option><option value="game">Game</option>
        </select>
      </div>
      <div className={field}><span className={label}>Download type</span>
        <select value={form.downloadType} onChange={e => onChange("downloadType", e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
          <option value="file">File</option><option value="external">External</option>
        </select>
      </div>
      <div className={field}><span className={label}>Accent</span><Input value={form.accent} onChange={e => onChange("accent", e.target.value)} placeholder="#ff5c1a" /></div>
      <div className={field}><span className={label}>Price note</span><Input value={form.priceNote} onChange={e => onChange("priceNote", e.target.value)} /></div>
      <div className={field}><span className={label}>Age range</span><Input value={form.ageRange} onChange={e => onChange("ageRange", e.target.value)} /></div>
      <div className={`${field} sm:col-span-2`}><span className={label}>Features (comma-separated)</span><Textarea value={form.features} onChange={e => onChange("features", e.target.value)} rows={2} /></div>
      <div className={`${field} sm:col-span-2`}><span className={label}>Tags (comma-separated)</span><Input value={form.tags} onChange={e => onChange("tags", e.target.value)} /></div>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" checked={form.featured} onChange={e => onChange("featured", e.target.checked)} /> Featured product
      </label>
    </div>
  );
}

function AssetManager({ product, onClose }: { product: ProductRow; onClose: () => void }) {
  const utils = trpc.useUtils();
  const assets = trpc.admin.assets.list.useQuery({ productId: product.id });
  const [editing, setEditing] = useState<null | { id?: number; fileName: string; storageKey: string; fileSize: string; mimeType: string; version: string }>(null);

  const invalidate = () => { utils.admin.assets.list.invalidate(); };
  const create = trpc.admin.assets.create.useMutation({
    onSuccess: data => {
      toast.success(data.filePresent ? "Asset added" : "Asset added — file not yet in private storage");
      setEditing(null); invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const update = trpc.admin.assets.update.useMutation({
    onSuccess: () => { toast.success("Asset updated"); setEditing(null); invalidate(); },
    onError: error => toast.error(error.message),
  });
  const remove = trpc.admin.assets.delete.useMutation({
    onSuccess: () => { toast.success("Asset deleted"); invalidate(); },
    onError: error => toast.error(error.message),
  });

  const save = () => {
    if (!editing || !editing.fileName.trim() || !editing.storageKey.trim()) { toast.error("File name and storage key are required"); return; }
    const fileSize = editing.fileSize.trim() === "" ? null : Number(editing.fileSize);
    if (fileSize !== null && (!Number.isInteger(fileSize) || fileSize < 0)) { toast.error("File size must be a positive integer"); return; }
    if (editing.id === undefined) {
      create.mutate({
        productId: product.id, fileName: editing.fileName.trim(), storageKey: editing.storageKey.trim(),
        fileSize, mimeType: editing.mimeType.trim() || null, version: editing.version.trim() || "1",
      });
    } else {
      update.mutate({
        id: editing.id, fileName: editing.fileName.trim(), storageKey: editing.storageKey.trim(),
        fileSize, mimeType: editing.mimeType.trim() || null, version: editing.version.trim() || "1",
      });
    }
  };

  return (
    <Dialog open onOpenChange={open => { if (!open) { onClose(); setEditing(null); } }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Digital assets — {product.name}</DialogTitle>
          <DialogDescription>
            Metadata only. Premium files stay in private storage (PRIVATE_STORAGE_ROOT) and are never served publicly.
          </DialogDescription>
        </DialogHeader>
        {assets.isPending ? <p>Loading assets…</p>
          : assets.isError ? <p className="text-sm text-red-600">{assets.error.message}</p>
          : assets.data.length === 0 && !editing ? <p className="text-sm text-muted-foreground">No assets yet for this product.</p>
          : (
            <ul className="grid gap-3">
              {assets.data.map(asset => (
                <li key={asset.id} className="rounded-lg border p-3 text-sm">
                  <p className="font-medium">{asset.fileName} <span className="text-xs text-muted-foreground">v{asset.version}</span></p>
                  <p className="text-xs text-muted-foreground">key: {asset.storageKey} · {asset.mimeType ?? "unknown type"} · {asset.fileSize ?? "unknown size"}</p>
                  {!asset.filePresent && <p className="text-xs text-amber-600">File not present in private storage yet.</p>}
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditing({ id: asset.id, fileName: asset.fileName, storageKey: asset.storageKey, fileSize: asset.fileSize?.toString() ?? "", mimeType: asset.mimeType ?? "", version: asset.version })}>Edit</Button>
                    <Button size="sm" variant="destructive" onClick={() => { if (window.confirm(`Delete asset "${asset.fileName}"?`)) remove.mutate({ id: asset.id }); }}>Delete</Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        {!editing
          ? <Button variant="outline" onClick={() => setEditing({ fileName: "", storageKey: "", fileSize: "", mimeType: "", version: "1" })}>Add asset</Button>
          : (
            <Card>
              <CardHeader><CardTitle className="text-sm">{editing.id === undefined ? "New asset" : "Edit asset"}</CardTitle></CardHeader>
              <CardContent className="grid gap-3">
                <Input placeholder="File name *" value={editing.fileName} onChange={e => setEditing({ ...editing, fileName: e.target.value })} />
                <Input placeholder="Storage key * (relative path, e.g. guides/my-guide-v1.pdf)" value={editing.storageKey} onChange={e => setEditing({ ...editing, storageKey: e.target.value })} />
                <div className="grid gap-3 sm:grid-cols-3">
                  <Input placeholder="Size (bytes)" value={editing.fileSize} onChange={e => setEditing({ ...editing, fileSize: e.target.value })} inputMode="numeric" />
                  <Input placeholder="MIME type" value={editing.mimeType} onChange={e => setEditing({ ...editing, mimeType: e.target.value })} />
                  <Input placeholder="Version" value={editing.version} onChange={e => setEditing({ ...editing, version: e.target.value })} />
                </div>
                <div className="flex gap-2">
                  <Button onClick={save} disabled={create.isPending || update.isPending}>Save</Button>
                  <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}
        <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
