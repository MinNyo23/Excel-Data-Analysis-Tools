import { useMemo, useState } from "react";
import { ShieldCheck, Search, Ban, Trash2, UserCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function Admin() {
  const [search, setSearch] = useState("");
  const usersQuery = trpc.admin.users.useQuery();
  const moderate = trpc.admin.moderate.useMutation({ onSuccess: () => usersQuery.refetch() });
  const users = useMemo(() => (usersQuery.data ?? []).filter(user => user.email.toLowerCase().includes(search.toLowerCase())), [usersQuery.data, search]);
  const totals = users.reduce((a, user) => ({ workflows: a.workflows + user.workflows, files: a.files + user.files, records: a.records + user.records }), { workflows: 0, files: 0, records: 0 });
  async function act(userId: string, action: "ban" | "unban" | "delete", email: string) {
    if (action === "delete" && !window.confirm(`Permanently delete ${email}? This cannot be undone.`)) return;
    try { await moderate.mutateAsync({ userId, action }); toast.success(action === "delete" ? "User deleted." : action === "ban" ? "User banned." : "User unbanned."); }
    catch { toast.error("Admin action could not be completed."); }
  }
  return <div className="admin-page"><div className="admin-heading"><div><span className="soft-badge"><ShieldCheck size={14} /> MASTER ACCOUNT</span><h1>User management</h1><p>Review account activity and manage access from one protected console.</p></div><div className="admin-search"><Search size={16} /><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search email" aria-label="Search users by email" /></div></div>
    <div className="admin-stats"><div><strong>{users.length}</strong><span>Users</span></div><div><strong>{totals.workflows}</strong><span>Workflows run</span></div><div><strong>{totals.files}</strong><span>Files processed</span></div><div><strong>{totals.records.toLocaleString()}</strong><span>Records processed</span></div></div>
    <div className="admin-table-wrap">{usersQuery.isLoading ? <p className="admin-empty">Loading users…</p> : usersQuery.error ? <p className="admin-empty">Could not load users. Check the master account configuration.</p> : users.length === 0 ? <p className="admin-empty">No users match your search.</p> : <table className="admin-table"><thead><tr><th>Email</th><th>Status</th><th>Workflows</th><th>Files</th><th>Records</th><th>Last activity</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{users.map(user => <tr key={user.id}><td><strong>{user.email}</strong><small>{user.emailConfirmed ? "Verified" : "Unverified"}</small></td><td><span className={user.bannedUntil ? "admin-status banned" : "admin-status active"}>{user.bannedUntil ? "Banned" : "Active"}</span></td><td>{user.workflows}</td><td>{user.files}</td><td>{user.records.toLocaleString()}</td><td>{user.lastActivity ? new Date(user.lastActivity).toLocaleDateString() : "—"}</td><td className="admin-actions">{user.bannedUntil ? <Button variant="outline" size="sm" onClick={() => act(user.id, "unban", user.email)}><UserCheck size={14} /> Unban</Button> : <Button variant="outline" size="sm" onClick={() => act(user.id, "ban", user.email)}><Ban size={14} /> Ban</Button>}<Button variant="outline" size="sm" className="admin-delete" onClick={() => act(user.id, "delete", user.email)}><Trash2 size={14} /> Delete</Button></td></tr>)}</tbody></table>}</div>
  </div>;
}
