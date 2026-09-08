import { Link } from "wouter";
import {
  ArrowRight,
  Box,
  CheckCircle2,
  Clock3,
  DollarSign,
  Package,
  RefreshCw,
  ShoppingCart,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function StatCard({
  label,
  value,
  description,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  description: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  accent: "navy" | "orange" | "green" | "purple";
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex items-start justify-between gap-4 p-6">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
            <p className="mt-2 text-xs text-muted-foreground">{description}</p>
          </div>

          <div
            className={`flex h-11 w-11 items-center justify-center rounded-full ${
              accent === "navy"
                ? "bg-slate-100 text-slate-900"
                : accent === "orange"
                  ? "bg-orange-100 text-orange-700"
                  : accent === "green"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-purple-100 text-purple-700"
            }`}
          >
            <Icon size={20} strokeWidth={1.8} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickAction({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between rounded-xl border bg-white p-5 transition-colors hover:border-slate-900 hover:bg-slate-50"
    >
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="mt-1 block text-sm text-muted-foreground">{description}</span>
      </span>
      <ArrowRight
        size={18}
        className="text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-slate-900"
      />
    </Link>
  );
}

export default function AdminDashboard() {
  const dashboard = trpc.admin.dashboard.useQuery();

  if (dashboard.isPending) {
    return (
      <div className="rounded-xl border bg-white p-8">
        <p className="text-sm text-muted-foreground">Loading dashboard…</p>
      </div>
    );
  }

  if (dashboard.isError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <p className="font-semibold text-red-900">Dashboard unavailable</p>
        <p className="mt-2 text-sm text-red-800">
          {dashboard.error.message}
        </p>
        <button
          type="button"
          onClick={() => dashboard.refetch()}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-900 px-4 py-2 text-sm font-medium text-white hover:bg-red-800"
        >
          <RefreshCw size={15} />
          Retry
        </button>
      </div>
    );
  }

  const stats = dashboard.data;

  const hasData = stats.products.total > 0 || stats.orders.total > 0;

  return (
    <div className="space-y-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">
            <span className="eyebrow-line" />
            Administration
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Store overview
          </h1>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Manage your digital products, orders, categories, and customer
            deliveries from one place.
          </p>
        </div>

        <button
          type="button"
          onClick={() => dashboard.refetch()}
          className="inline-flex items-center justify-center gap-2 rounded-lg border bg-white px-4 py-2.5 text-sm font-medium transition-colors hover:bg-slate-50"
        >
          <RefreshCw size={16} />
          Refresh data
        </button>
      </header>

      {!hasData && (
        <div className="rounded-2xl border border-dashed bg-white p-8 text-center">
          <Box className="mx-auto text-muted-foreground" size={34} strokeWidth={1.5} />
          <h2 className="mt-4 text-lg font-semibold">Your store is empty</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Create your first product to start building your digital catalogue.
          </p>
          <Link
            href="/admin/products"
            className="button button-primary mt-5 inline-flex"
          >
            Create a product
            <ArrowRight size={16} />
          </Link>
        </div>
      )}

      <section
        aria-label="Store statistics"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard
          label="Total products"
          value={stats.products.total}
          description={`${stats.products.published} published`}
          icon={Package}
          accent="navy"
        />

        <StatCard
          label="Paid orders"
          value={stats.orders.paid}
          description={`${stats.orders.pending} awaiting payment`}
          icon={CheckCircle2}
          accent="green"
        />

        <StatCard
          label="Pending orders"
          value={stats.orders.pending}
          description={`${stats.orders.total} orders in total`}
          icon={Clock3}
          accent="orange"
        />

        <StatCard
          label="Paid revenue"
          value={`$${stats.revenue.paidTotal}`}
          description="Revenue from paid orders"
          icon={DollarSign}
          accent="purple"
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package size={18} />
              Product status
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <span className="text-sm text-muted-foreground">Published</span>
              <strong>{stats.products.published}</strong>
            </div>

            <div className="flex items-center justify-between border-b pb-3">
              <span className="text-sm text-muted-foreground">Drafts</span>
              <strong>{stats.products.draft}</strong>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Archived</span>
              <strong>{stats.products.archived}</strong>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart size={18} />
              Order status
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <span className="text-sm text-muted-foreground">All orders</span>
              <strong>{stats.orders.total}</strong>
            </div>

            <div className="flex items-center justify-between border-b pb-3">
              <span className="text-sm text-muted-foreground">Paid</span>
              <strong>{stats.orders.paid}</strong>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Pending</span>
              <strong>{stats.orders.pending}</strong>
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-xl font-semibold">Quick actions</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Continue managing your store.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <QuickAction
            href="/admin/products"
            title="Manage products"
            description="Create, edit, publish, or archive products."
          />

          <QuickAction
            href="/admin/categories"
            title="Manage categories"
            description="Organize your digital catalogue."
          />

          <QuickAction
            href="/admin/orders"
            title="View orders"
            description="Review customer orders and payment status."
          />
        </div>
      </section>
    </div>
  );
}
