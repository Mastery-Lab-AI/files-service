import express from "express";
import request from "supertest";

jest.mock("../src/lib/supabase", () => {
  return {
    supabaseAnon: { auth: { getUser: jest.fn() } },
    supabase: jest.fn(),
  };
});

import { authenticateUser } from "../src/middleware/authenticateUser";
import { supabaseAnon } from "../src/lib/supabase";

describe("authenticateUser middleware", () => {
  const app = express();
  app.get(
    "/protected",
    authenticateUser,
    (req, res) => res.json({ studentId: (req as any).studentId })
  );

  it("returns 401 when missing token", async () => {
    const res = await request(app).get("/protected");
    expect(res.status).toBe(401);
  });

  it("attaches studentId from auth.uid() (ignoring metadata)", async () => {
    (supabaseAnon.auth.getUser as jest.Mock).mockResolvedValueOnce({
      data: { user: { id: "user-1", user_metadata: { student_id: "stu-123" } } },
      error: null,
    });

    const res = await request(app)
      .get("/protected")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body.studentId).toBe("user-1");
  });

  it("uses auth.uid() when metadata missing", async () => {
    (supabaseAnon.auth.getUser as jest.Mock).mockResolvedValueOnce({
      data: { user: { id: "user-xyz", user_metadata: {} } },
      error: null,
    });

    const res = await request(app)
      .get("/protected")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body.studentId).toBe("user-xyz");
  });
});

