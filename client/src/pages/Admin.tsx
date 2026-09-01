import { useMemo, useState } from "react";
import { Ban, History, Search, ShieldCheck, Trash2, UserCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type AdminUser = {
  id: string;
  email: string;
  emailConfirmed: boolean;
  bannedUntil: string | null;
  workflows: number;
  files: number;
  records: number;
  lastActivity: string | null;
};

type AdminActionHistory = {
  id: string;
  actorEmail: string;
  targetUserId: string;
  targetEmail: string;
  action: "ban" | "unban" | "delete";
  status: "pending" | "completed" | "failed";
  createdAt: string | Date;
};

export default function Admin() {
  const [search, setSearch] = useState("");
  const usersQuery = trpc.admin.users.useQuery();
  const actionHistoryQuery = trpc.admin.actionHistory.useQuery();
  const moderate = trpc.admin.moderate.useMutation({
    onSuccess: () => {
      void usersQuery.refetch();
      void actionHistoryQuery.refetch();
    },
  });
  const users = useMemo(
    () => (usersQuery.data as AdminUser[] | undefined ?? []).filter((user: AdminUser) => user.email.toLowerCase().includes(search.toLowerCase())),
    [usersQuery.data, search],
  );
  const history = (actionHistoryQuery.data as AdminActionHistory[] | undefined) ?? [];
  const totals = users.reduce(
    (a: { workflows: number; files: number; records: number }, user: AdminUser) => ({
      workflows: a.workflows + user.workflows,
      files: a.files + user.files,
      records: a.records + user.records,
    }),
    { workflows: 0, files: 0, records: 0 },
  );

  async function act(userId: string, action: "ban" | "unban" | "delete", email: string) {
    const confirmation = action === "delete"
      ? `Permanently delete ${email}? This cannot be undone.`
      : action === "ban"
        ? `Ban ${email}? They will not be able to sign in until unbanned.`
        : `Unban ${email}? They will be able to sign in again.`;
    if (!window.confirm(confirmation)) return;

    try {
      await moderate.mutateAsync({ userId, action });
      toast.success(action === "delete" ? "User deleted." : action === "ban" ? "User banned." : "User unbanned.");
    } catch {
      toast.error("Admin action could not be completed.");
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-heading">
        <div>
          <span className="soft-badge"><ShieldCheck size={14} /> MASTER ACCOUNT</span>
          <h1>User management</h1>
          <p>Review account activity and manage access from one protected console.</p>
        </div>
        <div className="admin-search"><Search size={16} /><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search email" aria-label="Search users by email" /></div>
      </div>

      <div className="admin-stats">
        <div><strong>{users.length}</strong><span>Users</span></div>
        <div><strong>{totals.workflows}</strong><span>Workflows run</span></div>
        <div><strong>{totals.files}</strong><span>Files processed</span></div>
        <div><strong>{totals.records.toLocaleString()}</strong><span>Records processed</span></div>
      </div>

      <div className="admin-table-wrap">
        {usersQuery.isLoading ? <p className="admin-empty">Loading users…</p> : usersQuery.error ? <p className="admin-empty">Could not load users. Check the master account configuration.</p> : users.length === 0 ? <p className="admin-empty">No users match your search.</p> : (
          <table className="admin-table">
            <thead><tr><th>Email</th><th>Status</th><th>Workflows</th><th>Files</th><th>Records</th><th>Last activity</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>{users.map((user: AdminUser) => (
              <tr key={user.id}>
                <td><strong>{user.email}</strong><small>{user.emailConfirmed ? "Verified" : "Unverified"}</small></td>
                <td><span className={user.bannedUntil ? "admin-status banned" : "admin-status active"}>{user.bannedUntil ? "Banned" : "Active"}</span></td>
                <td>{user.workflows}</td><td>{user.files}</td><td>{user.records.toLocaleString()}</td>
                <td>{user.lastActivity ? new Date(user.lastActivity).toLocaleDateString() : "—"}</td>
                <td className="admin-actions">
                  {user.bannedUntil ? <Button variant="outline" size="sm" onClick={() => act(user.id, "unban", user.email)}><UserCheck size={14} /> Unban</Button> : <Button variant="outline" size="sm" onClick={() => act(user.id, "ban", user.email)}><Ban size={14} /> Ban</Button>}
                  <Button variant="outline" size="sm" className="admin-delete" onClick={() => act(user.id, "delete", user.email)}><Trash2 size={14} /> Delete</Button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>

      <section className="admin-history-section" aria-labelledby="admin-history-title">
        <div className="admin-history-heading">
          <span className="soft-badge"><History size={14} /> ACTION HISTORY</span>
          <h2 id="admin-history-title">Access and deletion history</h2>
          <p>Ban, unban, and delete actions remain listed here, including users removed from Supabase Auth.</p>
        </div>
        <div className="admin-table-wrap">
          {actionHistoryQuery.isLoading ? <p className="admin-empty">Loading action history…</p> : actionHistoryQuery.error ? <p className="admin-empty">Could not load action history. Apply the Supabase admin-history migration and try again.</p> : history.length === 0 ? <p className="admin-empty">No administrative actions have been recorded.</p> : (
            <table className="admin-table admin-history-table">
              <thead><tr><th>User</th><th>Action</th><th>Status</th><th>Performed by</th><th>Date</th></tr></thead>
              <tbody>{history.map(item => (
                <tr key={item.id}>
                  <td><strong>{item.targetEmail}</strong><small>{item.targetUserId}</small></td>
                  <td>{item.action === "delete" ? "Deleted" : item.action === "ban" ? "Banned" : "Unbanned"}</td>
                  <td><span className={`admin-status ${item.status === "completed" ? "active" : item.status === "failed" ? "banned" : "pending"}`}>{item.status}</span></td>
                  <td>{item.actorEmail}</td>
                  <td>{new Date(item.createdAt).toLocaleString()}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
