import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { GitCompare, Layers3, ListTree, LogOut, ScanSearch, ShieldCheck, Sheet, Type, UploadCloud, UserRoundCog } from "lucide-react";
import { useLocation } from "wouter";
import type { ReactNode } from "react";
import AppFooter from "./AppFooter";
import { useAuth } from "@/_core/hooks/useAuth";

const tools = [
  { icon: Layers3, label: "Master consolidation", path: "/tools/consolidation" },
  { icon: ScanSearch, label: "Addition & exit match", path: "/tools/addition-exit" },
  { icon: Sheet, label: "Facility by facility", path: "/tools/facility" },
  { icon: ListTree, label: "Deletion summary list", path: "/tools/deletion-summary" },
  { icon: ListTree, label: "Deletion with summary", path: "/tools/entity-summary" },
  { icon: ScanSearch, label: "Deletion check with onboard", path: "/tools/onboard" },
  { icon: Layers3, label: "Duplicate separation", path: "/tools/duplicates" },
  { icon: GitCompare, label: "Multi-condition file compare", path: "/tools/file-comparison" },
  { icon: UploadCloud, label: "Ready file to upload", path: "/tools/ready-upload" },
  { icon: Type, label: "Column transform", path: "/tools/column-transform" },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const isMasterAdmin = user?.role === "admin";
  async function handleSignOut() {
    try {
      await logout();
    } catch {
      // The local session is cleared by useAuth even when server cleanup fails.
      // Always leave the protected workspace without showing an error popup.
    } finally {
      window.location.replace("/login");
    }
  }
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" className="!border-r-2 !border-[#bfd5bf] !bg-[#e8f3e8] shadow-[8px_0_28px_rgba(30,93,77,0.12)]">
        <SidebarHeader className="relative h-auto bg-[#e8f3e8] px-3 py-4 group-data-[collapsible=icon]:px-1.5 group-data-[collapsible=icon]:pb-12">
          <div className="flex items-center gap-2 pr-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:pr-0">
            <button type="button" onClick={() => setLocation("/")} className="flex min-w-0 flex-1 items-center gap-3 text-left group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:justify-center">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#0f6a51] text-white shadow-sm"><Layers3 size={18} /></span>
              <span className="min-w-0 group-data-[collapsible=icon]:hidden"><span className="block text-[10px] font-semibold tracking-[0.16em] text-[#738179]">OPERATIONS TOOLKIT</span><span className="block text-sm font-bold text-[#1d2923]">Excel Master File</span></span>
            </button>
          </div>
          <SidebarTrigger className="sidebar-toggle absolute top-4 right-2 hover:bg-white hover:text-[#0f6a51] group-data-[collapsible=icon]:right-1/2 group-data-[collapsible=icon]:top-14 group-data-[collapsible=icon]:translate-x-1/2" />
        </SidebarHeader>
        <SidebarContent className="px-2 !bg-[#e8f3e8]">
          <p className="px-2 pt-4 pb-2 text-[10px] font-bold tracking-[0.15em] text-[#849189] group-data-[collapsible=icon]:hidden">WORKFLOWS</p>
          <SidebarMenu>
            {tools.map(tool => {
              const active = location === tool.path;
              return <SidebarMenuItem key={tool.path}><SidebarMenuButton isActive={active} tooltip={tool.label} onClick={() => setLocation(tool.path)} className="sidebar-navigation-link h-10 text-[#445149] data-[active=true]:bg-[#e4f1e7] data-[active=true]:text-[#0f6a51]"><tool.icon size={16} /><span>{tool.label}</span></SidebarMenuButton></SidebarMenuItem>;
            })}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="bg-[#e8f3e8] p-3"><div className="rounded-xl border border-[#dce8dc] bg-white px-3 py-3 text-xs leading-relaxed text-[#66736b] group-data-[collapsible=icon]:hidden">Each tool creates a preview first. Download only after you review the output.</div></SidebarFooter>
        <SidebarFooter className="bg-[#e8f3e8] px-2 pb-4 pt-0"><SidebarMenu>
          {isMasterAdmin && <SidebarMenuItem><SidebarMenuButton isActive={location === "/admin"} tooltip="Master account" onClick={() => setLocation("/admin")} className="sidebar-navigation-link h-10 text-[#0f6a51] data-[active=true]:bg-[#e4f1e7]"><ShieldCheck size={16}/><span>Master account</span></SidebarMenuButton></SidebarMenuItem>}
          <SidebarMenuItem><SidebarMenuButton isActive={location === "/account" || location === "/profile"} tooltip="My account" onClick={() => setLocation("/account")} className="sidebar-navigation-link h-10 text-[#445149] data-[active=true]:bg-[#e4f1e7] data-[active=true]:text-[#0f6a51]"><UserRoundCog size={16}/><span>My account</span></SidebarMenuButton></SidebarMenuItem>
          <SidebarMenuItem><SidebarMenuButton tooltip="Sign out" onClick={handleSignOut} className="sidebar-navigation-link sidebar-signout-link h-10 text-[#9d4b4b]"><LogOut size={16}/><span>Sign out</span></SidebarMenuButton></SidebarMenuItem>
        </SidebarMenu></SidebarFooter>
      </Sidebar>
      <SidebarInset className="bg-[#f6f8f3]">
        <div className="flex h-12 items-center gap-2 border-b border-[#e5ece4] bg-[#fbfdf9] px-3 md:hidden">
          <SidebarTrigger className="sidebar-toggle hover:bg-[#e8f3e8] hover:text-[#0f6a51]" />
          <button type="button" onClick={() => setLocation("/")} className="flex min-w-0 items-center gap-2 text-left">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#0f6a51] text-white"><Layers3 size={15} /></span>
            <span className="truncate text-sm font-bold text-[#1d2923]">Excel Master File</span>
          </button>
        </div>
        <main className="flex-1">{children}</main>
        <AppFooter />
      </SidebarInset>
    </SidebarProvider>
  );
}
