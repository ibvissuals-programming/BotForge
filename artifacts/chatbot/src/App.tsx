import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import ChatPage from "@/pages/ChatPage";
import AdminPage from "@/pages/AdminPage";
import AdminGate from "@/components/AdminGate";
import ShowcasePage from "@/pages/ShowcasePage";
import { getConfigFromUrl } from "@/lib/configUrl";

const queryClient = new QueryClient();

function Router() {
  // Preserve existing #c= and ?c= shareable links at the root path.
  // If either is present, render ChatPage at "/" instead of the admin dashboard.
  const hasUrlConfig =
    !!getConfigFromUrl() ||
    !!new URLSearchParams(window.location.search).get("c");

  return (
    <Switch>
      <Route path="/admin">
        <AdminGate>
          <AdminPage />
        </AdminGate>
      </Route>
      <Route path="/">
        {hasUrlConfig ? (
          <ChatPage />
        ) : (
          <AdminGate>
            <AdminPage />
          </AdminGate>
        )}
      </Route>
      <Route path="/showcase" component={ShowcasePage} />
      <Route path="/:slug" component={ChatPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
