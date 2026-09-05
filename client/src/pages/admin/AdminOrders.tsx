import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

function formatDate(value: Date | string) {
  return new Date(value).toLocaleString();
}

export default function AdminOrders() {
  const orders = trpc.admin.orders.list.useQuery({ limit: 50, offset: 0 });

  if (orders.isPending) return <p>Loading orders…</p>;
  if (orders.isError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <p className="font-semibold">Orders unavailable</p>
        <p className="text-sm text-muted-foreground">{orders.error.message}</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Orders ({orders.data.total})</h1>
      {orders.data.orders.length === 0 ? (
        <div className="rounded-xl border p-8 text-center text-muted-foreground">No orders yet.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3">Order</th><th className="p-3">Date</th>
                <th className="p-3">Customer</th><th className="p-3">Total</th>
                <th className="p-3">Status</th><th className="p-3">Payment</th>
                <th className="p-3">Items</th><th className="p-3 text-right">Detail</th>
              </tr>
            </thead>
            <tbody>
              {orders.data.orders.map(order => (
                <tr key={order.id} className="border-t">
                  <td className="p-3 font-medium">#{order.id}</td>
                  <td className="p-3 text-muted-foreground">{formatDate(order.createdAt)}</td>
                  <td className="p-3">{order.customerEmail}</td>
                  <td className="p-3">{order.total} {order.currency}</td>
                  <td className="p-3"><span className="rounded-full bg-muted px-2 py-0.5 text-xs">{order.status}</span></td>
                  <td className="p-3"><span className="rounded-full bg-muted px-2 py-0.5 text-xs">{order.paymentStatus}</span></td>
                  <td className="p-3">{order.itemCount}</td>
                  <td className="p-3 text-right">
                    <Link href={`/admin/orders/${order.id}`}><Button size="sm" variant="outline">View</Button></Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function AdminOrderDetail({ params }: { params: { id?: string } }) {
  const id = Number(params.id);
  const order = trpc.admin.orders.getById.useQuery({ id }, { enabled: Number.isInteger(id) && id > 0 });

  if (!Number.isInteger(id) || id <= 0) return <p>Invalid order id.</p>;
  if (order.isPending) return <p>Loading order…</p>;
  if (order.isError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <p className="font-semibold">Order unavailable</p>
        <p className="text-sm text-muted-foreground">{order.error.message}</p>
        <p className="mt-4"><Link href="/admin/orders" className="back-link">← All orders</Link></p>
      </div>
    );
  }

  const { order: detail, customer, items } = order.data;
  return (
    <div>
      <Link href="/admin/orders" className="back-link">← All orders</Link>
      <h1 className="text-2xl font-semibold mb-6">Order #{detail.id}</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border p-5">
          <h2 className="font-semibold mb-3">Customer</h2>
          <p className="text-sm">{customer.name ?? "—"}</p>
          <p className="text-sm text-muted-foreground">{customer.email}</p>
        </div>
        <div className="rounded-xl border p-5">
          <h2 className="font-semibold mb-3">Payment</h2>
          <p className="text-sm">Status: {detail.status} / {detail.paymentStatus}</p>
          <p className="text-sm text-muted-foreground">Provider: {detail.stripe.provider ?? "—"}</p>
          <p className="text-sm text-muted-foreground">Reference: {detail.stripe.reference ?? "—"}</p>
        </div>
      </div>
      <h2 className="font-semibold mt-6 mb-3">Items</h2>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-muted/50 text-left">
            <tr><th className="p-3">Product</th><th className="p-3">Qty</th><th className="p-3">Unit price</th><th className="p-3">Total</th></tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} className="border-t">
                <td className="p-3">{item.productNameSnapshot}</td>
                <td className="p-3">{item.quantity}</td>
                <td className="p-3">{item.unitPrice}</td>
                <td className="p-3">{item.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-lg font-semibold">Total: {detail.total} {detail.currency}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        Order status is controlled exclusively by the Stripe webhook — it cannot be changed from this interface.
      </p>
    </div>
  );
}
