import {
  LayoutDashboard,
  Phone,
  Users,
  History,
  CalendarDays,
  Settings,
  Bot,
  UserCircle,
  PhoneCall,
  Bell,
  PlayCircle,
  LogOut,
  PhoneOutgoing,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useUserAccountId } from "@/hooks/useUserAccountId";
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
  { title: "Missions", url: "/missions", icon: PhoneOutgoing },
  { title: "Historique", url: "/history", icon: History },
  { title: "Tester", url: "/test", icon: PlayCircle },
];

const configNav = [
  { title: "Qui peut me joindre", url: "/who", icon: Users },
  { title: "Comment gérer les appels", url: "/how", icon: PhoneCall },
  { title: "Quand me prévenir", url: "/when", icon: Bell },
];

const secondaryNav = [
  { title: "Profils", url: "/profiles", icon: UserCircle },
  { title: "Calendrier", url: "/calendar", icon: CalendarDays },
  { title: "Assistant IA", url: "/assistant", icon: Bot },
  { title: "Réglages", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { data: accountId } = useUserAccountId();

  const modeIcons: Record<string, string> = {
    work: "💼", personal: "🏠", autopilot: "🤖", focus: "🎯",
  };

  const { data: activeMode } = useQuery({
    queryKey: ["active-mode-sidebar", accountId],
    queryFn: async () => {
      const { data } = await supabase
        .from("assistant_modes")
        .select("name, slug, is_active")
        .eq("account_id", accountId!)
        .eq("is_active", true)
        .maybeSingle();
      return data;
    },
    enabled: !!accountId,
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  const renderNav = (items: typeof mainNav) =>
    items.map((item) => (
      <SidebarMenuItem key={item.url}>
        <SidebarMenuButton asChild isActive={isActive(item.url)}>
          <NavLink
            to={item.url}
            end={item.url === "/"}
            className="hover:bg-muted/50 transition-colors"
            activeClassName="bg-primary/8 text-primary font-medium"
            onClick={() => isMobile && setOpenMobile(false)}
          >
            <item.icon className="mr-2 h-4 w-4" />
            {!collapsed && <span>{item.title}</span>}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    ));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Phone className="w-4 h-4 text-primary" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight">Aria</span>
              <span className="text-[10px] text-muted-foreground leading-tight">Assistant personnel</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">Vue d'ensemble</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderNav(mainNav)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">Configuration</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderNav(configNav)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">Système</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderNav(secondaryNav)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 space-y-2">
        {!collapsed && (
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-primary/5 border border-primary/10">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-[11px] text-muted-foreground">
              Mode {activeMode?.name || "…"} actif {activeMode?.slug ? (modeIcons[activeMode.slug] || "") : ""}
            </span>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors text-sm"
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span>Se déconnecter</span>}
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
