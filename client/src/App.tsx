import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import DashboardLayout from "./components/DashboardLayout";
import { ThemeProvider } from "./contexts/ThemeContext";
import AccountManagement from "./pages/AccountManagement";
import Home from "./pages/Home";
import ProfileSettings from "./pages/ProfileSettings";
import TermsConditions from "./pages/TermsConditions";
import RouteTransition from "./components/RouteTransition";
import Login from "./pages/Login";
import { AuthGate } from "./components/AuthGate";
import { useLocation } from "wouter";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"}><AuthGate><Home /></AuthGate></Route>
      <Route path={"/login"} component={Login} />
      <Route path={"/tools/:tool"}><AuthGate><Home /></AuthGate></Route>
      <Route path={"/profile"}><AuthGate><ProfileSettings /></AuthGate></Route>
      <Route path={"/account"}><AuthGate><AccountManagement /></AuthGate></Route>
      <Route path={"/terms"} component={TermsConditions} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function AppContent() {
  const [location] = useLocation();
  const routedContent = <RouteTransition><Router /></RouteTransition>;
  if (location.startsWith("/login")) return routedContent;
  return <DashboardLayout>{routedContent}</DashboardLayout>;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <AppContent />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
