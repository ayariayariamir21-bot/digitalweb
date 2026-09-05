import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminDashboard() {
  const dashboard = trpc.admin.dashboard.useQuery();

  if (dashboard.isPending) return <p>Loading dashboard…</p>;
  if (dashboard.isError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <p className="font-semibold">Dashboard unavailable</p>
        <p className="text-sm text-muted-foreground">{dashboard.error.message}</p>
      </div>
    );
  }

  const stats = dashboard.data;
  const cards = [
    { label: "Products", value: stats.products.total },
    { label: "Published", value: stats.products.published },
    { label: "Drafts", value: stats.products.draft },
    { label: "Orders", value: stats.orders.total },
    { label: "Paid orders", value: stats.orders.paid },
    { label: "Pending orders", value: stats.orders.pending },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Dashboard</h1>
      {stats.products.total === 0 && stats.orders.total === 0 ? (
        <div className="rounded-xl border p-8 text-center text-muted-foreground">
          No products or orders yet. Create your first product to get started.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map(card => (
            <Card key={card.label}>
              <CardHeader><CardTitle className="text-sm text-muted-foreground">{card.label}</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-semibold">{card.value}</p></CardContent>
            </Card>
          ))}
          <Card>
            <CardHeader><CardTitle className="text-sm text-muted-foreground">Revenue (paid orders)</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-semibold">${stats.revenue.paidTotal}</p></CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
