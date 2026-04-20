import { LayoutDashboard, History, SlidersHorizontal } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const tabs = [
  { title: "Accueil", url: "/", icon: LayoutDashboard, match: (p: string) => p === "/" },
  {
    title: "Activité",
    url: "/activity",
    icon: History,
    match: (p: string) => p.startsWith("/activity") || p.startsWith("/missions"),
  },
  {
    title: "Réglages",
    url: "/more",
    icon: SlidersHorizontal,
    match: (p: string) =>
      p.startsWith("/more") ||
      p.startsWith("/about-me") ||
      p.startsWith("/who") ||
      p.startsWith("/how") ||
      p.startsWith("/when") ||
      p.startsWith("/calendar") ||
      p.startsWith("/settings"),
  },
];

export function BottomTabBar() {
  const location = useLocation();

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex items-stretch justify-around h-16">
        {tabs.map((tab) => {
          const active = tab.match(location.pathname);
          const Icon = tab.icon;
          return (
            <li key={tab.url} className="flex-1">
              <NavLink
                to={tab.url}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-1 h-full text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {active && (
                  <span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" />
                )}
                <Icon className="h-5 w-5" />
                <span>{tab.title}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
