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
import { FileSpreadsheet, FolderKanban, GitCompare, Layers3, ListTree, LogOut, ScanSearch, ShieldCheck, Sheet, UploadCloud, UserRoundCog } from "lucide-react";
import { useLocation } from "wouter";
import type { ReactNode } from "react";
import AppFooter from "./AppFooter";
import { useAuth } from "@/_core/hooks/useAuth";

const tools = [
  { icon: FolderKanban, label: "Tool overview", path: "/" },
  { icon: Layers3, label: "Master consolidation", path: "/tools/consolidation" },
  { icon: ListTree, label: "Deletion summary list", path: "/tools/deletion-summary" },
  { icon: Layers3, label: "Duplicate separation", path: "/tools/duplicates" },
  { icon: ListTree, label: "Deletion with summary", path: "/tools/entity-summary" },
  { icon: ScanSearch, label: "Addition & exit match", path: "/tools/addition-exit" },
  { icon: GitCompare, label: "Multi-condition file compare", path: "/tools/file-comparison" },
  { icon: ScanSearch, label: "Deletion & onboard check", path: "/tools/onboard" },
  { icon: UploadCloud, label: "Ready file to upload", path: "/tools/ready-upload" },
  { icon: Sheet, label: "Facility by facility", path: "/tools/facility" },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const isMasterAdmin = user?.email?.trim().toLowerCase() === "minnyo.work@gmail.com";
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
        <SidebarHeader className="h-auto px-3 py-5">
          <button type="button" onClick={() => setLocation("/")} className="flex items-center gap-3 text-left group-data-[collapsible=icon]:justify-center">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#0f6a51] text-white shadow-sm"><Layers3 size={18} /></span>
            <span className="min-w-0 group-data-[collapsible=icon]:hidden"><span className="block text-[10px] font-semibold tracking-[0.16em] text-[#738179]">OPERATIONS TOOLKIT</span><span className="block text-sm font-bold text-[#1d2923]">Excel Master File</span></span>
          </button>
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
        <SidebarFooter className="p-3"><div className="rounded-xl border border-[#dce8dc] bg-white px-3 py-3 text-xs leading-relaxed text-[#66736b] group-data-[collapsible=icon]:hidden">Each tool creates a preview first. Download only after you review the output.</div></SidebarFooter>
        <SidebarFooter className="px-2 pb-4 pt-0"><SidebarMenu>
          {isMasterAdmin && <SidebarMenuItem><SidebarMenuButton isActive={location === "/admin"} tooltip="Master account" onClick={() => setLocation("/admin")} className="sidebar-navigation-link h-10 text-[#0f6a51] data-[active=true]:bg-[#e4f1e7]"><ShieldCheck size={16}/><span>Master account</span></SidebarMenuButton></SidebarMenuItem>}
          <SidebarMenuItem><SidebarMenuButton isActive={location === "/account" || location === "/profile"} tooltip="My account" onClick={() => setLocation("/account")} className="sidebar-navigation-link h-10 text-[#445149] data-[active=true]:bg-[#e4f1e7] data-[active=true]:text-[#0f6a51]"><UserRoundCog size={16}/><span>My account</span></SidebarMenuButton></SidebarMenuItem>
          <SidebarMenuItem><SidebarMenuButton tooltip="Sign out" onClick={handleSignOut} className="sidebar-navigation-link sidebar-signout-link h-10 text-[#9d4b4b]"><LogOut size={16}/><span>Sign out</span></SidebarMenuButton></SidebarMenuItem>
        </SidebarMenu></SidebarFooter>
      </Sidebar>
      <SidebarInset className="bg-[#f6f8f3]">
        <header className="flex h-14 items-center border-b border-[#e5ece4] bg-[#fbfdf9] px-3 lg:px-5"><SidebarTrigger className="mr-3" /><div><p className="text-xs font-semibold text-[#1d2923]">Excel workflow workspace</p><p className="text-[11px] text-[#7a877f]">Files are processed in memory and not saved to this application</p></div></header>
        <main className="flex-1">{children}</main>
        <AppFooter />
      </SidebarInset>
    </SidebarProvider>
  );
}
