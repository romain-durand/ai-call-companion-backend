import {
  LayoutDashboard,
  Phone,
  Users,
  Shield,
  History,
  CalendarDays,
  Settings,
  Bot,
  UserCircle,
  Zap,
  AlertTriangle,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const mainNav = [
  { title: "Tableau de bord", url: "/", icon: LayoutDashboard },
  { title: "Historique", url: "/history", icon: History },
];

const configNav = [
  { title: "Qui peut me joindre", url: "/groups", icon: Users },
  { title: "Scénarios", url: "/scenarios", icon: Zap },
  { title: "Urgences", url: "/urgency", icon: AlertTriangle },
  { title: "Profils", url: "/profiles", icon: UserCircle },
  { title: "Calendrier", url: "/calendar", icon: CalendarDays },
];

const secondaryNav = [
  { title: "Assistant IA", url: "/assistant", icon: Bot },
  { title: "Réglages", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  const renderNav = (items: typeof mainNav) =>
    items.map((item) => (
      <SidebarMenuItem key={item.url}>
        <SidebarMenuButton asChild isActive={isActive(item.url)}>
          <NavLink
            to={item.url}
            end={item.url === "/"}
            className="hover:bg-muted/50"
            activeClassName="bg-muted text-primary font-medium"
          >
            <item.icon className="mr-2 h-4 w-4" />
            {!collapsed && <span>{item.title}</span>}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    ));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Phone className="w-4 h-4 text-primary" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight">Aria</span>
              <span className="text-[10px] text-muted-foreground">Assistant personnel</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Vue d'ensemble</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderNav(mainNav)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Configuration</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderNav(configNav)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Système</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderNav(secondaryNav)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        {!collapsed && (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-primary/5 border border-primary/10">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs text-muted-foreground">Mode Travail actif</span>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
