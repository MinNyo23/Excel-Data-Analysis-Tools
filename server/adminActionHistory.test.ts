import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mockFrom = vi.hoisted(() => vi.fn());
const mockAdmin = vi.hoisted(() => ({
  from: mockFrom,
  auth: { admin: {} },
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => mockAdmin),
}));

describe("Supabase admin action history", () => {
  beforeAll(() => {
    process.env.VITE_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  });

  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("falls back to security audit events when the optional history table is missing", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "admin_user_action_history") {
        return {
          select: () => ({
            order: () => ({
              limit: async () => ({
                data: null,
                error: { code: "PGRST205", message: "Could not find the table public.admin_user_action_history" },
              }),
            }),
          }),
        };
      }

      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: () => ({
                limit: async () => ({
                  data: [{
                    id: 17,
                    user_id: "master-user-id",
                    event_type: "admin_action",
                    metadata: { action: "delete", targetId: "deleted-user-id", target: "deleted@example.com", status: "completed" },
                    created_at: "2026-09-01T00:00:00.000Z",
                  }],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      };
    });

    const { supabaseListUserActionHistory } = await import("./supabaseIntegration");
    await expect(supabaseListUserActionHistory("master-user-id")).resolves.toEqual([{
      id: "17",
      actorEmail: "minnyo.work@gmail.com",
      targetUserId: "deleted-user-id",
      targetEmail: "deleted@example.com",
      action: "delete",
      status: "completed",
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
    }]);
  });
});
