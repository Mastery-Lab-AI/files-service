import express from "express";
import request from "supertest";

jest.mock("../src/lib/supabase", () => {
  return {
    supabaseAnon: { auth: { getUser: jest.fn() } },
    supabase: jest.fn(),
  };
});

import { supabaseAnon, supabase } from "../src/lib/supabase";
import { authenticateUser } from "../src/middleware/authenticateUser";
import { FilesController } from "../src/controllers/filesController";

describe("GET /workspace/:workspaceId/files", () => {
  const app = express();
  app.use(express.json());
  const controller = new FilesController();
  app.get("/workspace/:workspaceId/files", authenticateUser, controller.listFiles.bind(controller));

  const uuid = "123e4567-e89b-12d3-a456-426614174000";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("validates workspaceId and type", async () => {
    (supabaseAnon.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "u1" } }, error: null });

    const res1 = await request(app).get("/workspace/not-a-uuid/files").set("Authorization", "Bearer valid");
    expect(res1.status).toBe(400);

    const res2 = await request(app).get(`/workspace/${uuid}/files?type=bad`).set("Authorization", "Bearer valid");
    expect(res2.status).toBe(400);
  });

  it("lists files for student within workspace with pagination", async () => {
    (supabaseAnon.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "u1" } }, error: null });

    const order = jest.fn().mockReturnThis();
    const eq = jest.fn().mockReturnThis();
    const select = jest.fn().mockReturnThis();
    const range = jest.fn().mockResolvedValue({
      data: [
        {
          id: "f1",
          type: "note",
          student_id: "u1",
          workspace_id: uuid,
          name: "Doc 1",
          created_at: "2024-01-01T00:00:00.000Z",
          updated_at: "2024-01-01T00:00:00.000Z",
        },
      ],
      count: 10,
      error: null,
    });
    const from = jest.fn().mockReturnValue({ select, eq, order, range });
    (supabase as jest.Mock).mockReturnValue({ from });

    const res = await request(app)
      .get(`/workspace/${uuid}/files?pageStart=0&pageSize=5&type=note`)
      .set("Authorization", "Bearer valid");

    expect(res.status).toBe(200);
    expect(from).toHaveBeenCalledWith("workspace_files");
    expect(res.body).toHaveProperty("pagination");
    expect(res.body.pagination.total).toBe(10);
    expect(res.body.pagination.pageSize).toBe(5);
    expect(res.body.pagination.pageStart).toBe(0);
    expect(res.body.pagination.hasMore).toBe(true);
    expect(res.body.data[0]).toMatchObject({
      id: "f1",
      type: "note",
      studentId: "u1",
      workspaceId: uuid,
      name: "Doc 1",
      contentRef: `/workspace/${uuid}/notes/f1/content`,
    });
  });
});
