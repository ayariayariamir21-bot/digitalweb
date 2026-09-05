import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function AdminCategories() {
  const utils = trpc.useUtils();
  const categories = trpc.admin.categories.list.useQuery();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");

  const invalidate = () => {
    utils.admin.categories.list.invalidate();
    utils.admin.dashboard.invalidate();
  };

  const create = trpc.admin.categories.create.useMutation({
    onSuccess: () => { toast.success("Category created"); close(); invalidate(); },
    onError: error => toast.error(error.message),
  });
  const update = trpc.admin.categories.update.useMutation({
    onSuccess: () => { toast.success("Category updated"); close(); invalidate(); },
    onError: error => toast.error(error.message),
  });
  const remove = trpc.admin.categories.delete.useMutation({
    onSuccess: () => { toast.success("Category deleted"); invalidate(); },
    onError: error => toast.error(error.message),
  });

  const close = () => {
    setDialogOpen(false); setEditingId(null);
    setName(""); setSlug(""); setDescription("");
  };

  const openCreate = () => { close(); setDialogOpen(true); };
  const openEdit = (row: { id: number; name: string; slug: string; description: string | null }) => {
    setEditingId(row.id); setName(row.name); setSlug(row.slug);
    setDescription(row.description ?? ""); setDialogOpen(true);
  };

  const save = () => {
    if (editingId === null) {
      create.mutate({ name, slug, description: description || null });
    } else {
      update.mutate({ id: editingId, name, slug, description: description || null });
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-semibold">Categories</h1>
        <Button onClick={openCreate}>New category</Button>
      </div>

      {categories.isPending ? <p>Loading categories…</p>
        : categories.isError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6">
            <p className="font-semibold">Categories unavailable</p>
            <p className="text-sm text-muted-foreground">{categories.error.message}</p>
          </div>
        ) : categories.data.length === 0 ? (
          <div className="rounded-xl border p-8 text-center text-muted-foreground">No categories yet.</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-muted/50 text-left">
                <tr><th className="p-3">Name</th><th className="p-3">Slug</th><th className="p-3">Products</th><th className="p-3 text-right">Actions</th></tr>
              </thead>
              <tbody>
                {categories.data.map(row => (
                  <tr key={row.id} className="border-t">
                    <td className="p-3 font-medium">{row.name}</td>
                    <td className="p-3 text-muted-foreground">{row.slug}</td>
                    <td className="p-3">{row.productCount}</td>
                    <td className="p-3">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEdit(row)}>Edit</Button>
                        <Button
                          size="sm" variant="destructive" disabled={remove.isPending}
                          onClick={() => {
                            if (window.confirm(`Delete category "${row.name}"? This is blocked while products still use it.`)) {
                              remove.mutate({ id: row.id });
                            }
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      <Dialog open={dialogOpen} onOpenChange={open => { if (!open) close(); else setDialogOpen(true); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId === null ? "New category" : "Edit category"}</DialogTitle>
            <DialogDescription>Slug must stay unique across categories.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Input placeholder="Name *" value={name} onChange={e => setName(e.target.value)} />
            <Input placeholder="Slug * (lowercase, dashes)" value={slug} onChange={e => setSlug(e.target.value)} />
            <Textarea placeholder="Description (optional)" value={description} onChange={e => setDescription(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close}>Cancel</Button>
            <Button onClick={save} disabled={create.isPending || update.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
