import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, useLocation } from "wouter";
import { useEffect } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { SiteLayout } from "./components/SiteLayout";
import Home from "./pages/Home";
import Products from "./pages/Products";
import Product from "./pages/Product";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Note from "./pages/Note";
import BuyNow from "./pages/BuyNow";
import Signup from "./pages/Signup";
import ChildrenRoom from "./pages/ChildrenRoom";
import ColorSortPage from "./pages/ColorSortPage";
import Games from "./pages/Games";
import NotFound from "./pages/NotFound";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import { AdminGate, AdminLayout } from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminCategories from "./pages/admin/AdminCategories";
import AdminOrders, { AdminOrderDetail } from "./pages/admin/AdminOrders";
import { CartProvider } from "./contexts/CartContext";
import PaymentResult from "./pages/PaymentResult";
import DevAdminLogin from "./pages/DevAdminLogin";

function ScrollManager() { const [location] = useLocation(); useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }); }, [location]); return null; }

function AdminRoute({ component: Component, params }: { component: React.ComponentType<any>; params?: Record<string, string | undefined> }) {
  return <AdminGate><AdminLayout><Component params={params} /></AdminLayout></AdminGate>;
}

function Router() {
  return <><ScrollManager /><SiteLayout><Switch><Route path="/" component={Home} /><Route path="/products" component={Products} /><Route path="/products/:slug" component={Product} /><Route path="/buy" component={BuyNow} /><Route path="/cart" component={Cart} /><Route path="/checkout/success" component={PaymentResult} /><Route path="/checkout/cancel" component={PaymentResult} /><Route path="/checkout" component={Checkout} /><Route path="/signup" component={Signup} /><Route path="/games" component={Games} /><Route path="/children/game" component={ColorSortPage} /><Route path="/children" component={ChildrenRoom} /><Route path="/notes/:slug" component={Note} /><Route path="/about" component={About} /><Route path="/contact" component={Contact} /><Route path="/dev-admin-login" component={DevAdminLogin} /><Route path="/admin">{() => <AdminRoute component={AdminDashboard} />}</Route><Route path="/admin/products">{() => <AdminRoute component={AdminProducts} />}</Route><Route path="/admin/categories">{() => <AdminRoute component={AdminCategories} />}</Route><Route path="/admin/orders">{() => <AdminRoute component={AdminOrders} />}</Route><Route path="/admin/orders/:id">{params => <AdminRoute component={AdminOrderDetail} params={params} />}</Route><Route component={NotFound} /></Switch></SiteLayout></>;
}

export default function App() { return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><CartProvider><Toaster position="bottom-right" /><Router /></CartProvider></TooltipProvider></ThemeProvider></ErrorBoundary>; }
