import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { StoreProvider } from "./contexts/StoreContext";
import { CustomerProvider } from "./contexts/CustomerContext";
import Home from "./pages/Home";
const Admin = lazy(() => import("./pages/Admin"));

function AdminRoute() {
  return <Suspense fallback={<main className="admin-gate" dir="rtl"><div className="admin-gate-card">جارٍ تحميل لوحة المالك…</div></main>}><Admin /></Suspense>;
}

function Router() {
  return <Switch>
    <Route path="/admin/:section?" component={AdminRoute} />
    <Route path="/Admin/:section?" component={AdminRoute} />
    <Route path="/product/:id" component={Home} />
    <Route path="/products" component={Home} />
    <Route path="/categories" component={Home} />
    <Route path="/cart" component={Home} />
    <Route path="/favorites" component={Home} />
    <Route path="/orders" component={Home} />
    <Route path="/account" component={Home} />
    <Route path="/assistant" component={Home} />
    <Route path="/" component={Home} />
    <Route component={NotFound} />
  </Switch>;
}

export default function App() {
  return <ErrorBoundary>
    <ThemeProvider defaultTheme="light">
      <TooltipProvider>
        <StoreProvider>
          <CustomerProvider>
            <Toaster position="top-center" richColors />
            <Router />
          </CustomerProvider>
        </StoreProvider>
      </TooltipProvider>
    </ThemeProvider>
  </ErrorBoundary>;
}
