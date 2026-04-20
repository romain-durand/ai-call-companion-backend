import {
  LayoutDashboard,
  Phone,
  Users,
  History,
  CalendarDays,
  Settings,
  PhoneCall,
  Bell,
  LogOut,
  PhoneOutgoing,
  UserCircle,
  SlidersHorizontal,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";

import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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
  { title: "Accueil", url: "/", icon: LayoutDashboard },
];

const activityNav = [
  { title: "Activité", url: "/activity", icon: History },
  { title: "Missions", url: "/missions", icon: PhoneOutgoing },
];

const settingsNav = [
  { title: "Vue d'ensemble", url: "/more", icon: SlidersHorizontal },
  { title: "Calendrier", url: "/calendar", icon: CalendarDays },
  { title: "Réglages", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();




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
              <span className="text-sm font-semibold tracking-tight">Victor</span>
              <span className="text-[10px] text-muted-foreground leading-tight">Assistant personnel</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">Accueil</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderNav(mainNav)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">Activité</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderNav(activityNav)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">Réglages</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderNav(settingsNav)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
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
