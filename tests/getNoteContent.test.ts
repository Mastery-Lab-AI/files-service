import express from "express";
import request from "supertest";

jest.mock("../src/lib/supabase", () => {
  return {
    supabaseAnon: { auth: { getUser: jest.fn() } },
    supabase: jest.fn(),
  };
});

jest.mock("../src/lib/gcs", () => {
  return {
    readObject: jest.fn(),
    buildFileObjectPath: jest.requireActual("../src/lib/gcs").buildFileObjectPath,
  };
});

import { supabaseAnon, supabase } from "../src/lib/supabase";
import { readObject } from "../src/lib/gcs";
import { FilesController } from "../src/controllers/filesController";
import { authenticateUser } from "../src/middleware/authenticateUser";

describe("GET /workspace/:workspaceId/notes/:noteId/content", () => {
  const app = express();
  app.use(express.json());
  const controller = new FilesController();
  app.get(
    "/workspace/:workspaceId/notes/:noteId/content",
    authenticateUser,
    controller.getNoteContent.bind(controller)
  );

  const workspaceId = "123e4567-e89b-12d3-a456-426614174000";
  const noteId = "123e4567-e89b-12d3-a456-426614174001";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns parsed JSON when object exists (notes path)", async () => {
    (supabaseAnon.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "u1" } }, error: null });

    const single = jest.fn().mockResolvedValue({
      data: {
        id: noteId,
        type: "note",
        student_id: "u1",
        workspace_id: workspaceId,
        name: "Doc",
        created_at: "2024-01-01T00:00:00.000Z",
        updated_at: "2024-01-01T00:00:00.000Z",
      },
      error: null,
    });
    const select = jest.fn();
    const eq = jest.fn();
    const chain: any = { select, eq, single };
    select.mockReturnValue(chain);
    eq.mockReturnValue(chain);
    const from = jest.fn().mockReturnValue(chain);
    (supabase as jest.Mock).mockReturnValue({ from });

    (readObject as jest.Mock)
      .mockResolvedValueOnce({
        contentType: "application/json",
        buffer: Buffer.from(JSON.stringify({ content: "Hello Note" }), "utf-8"),
        metadata: {} as any,
      });

    const res = await request(app)
      .get(`/workspace/${workspaceId}/notes/${noteId}/content`)
      .set("Authorization", "Bearer valid");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ content: "Hello Note" });
    expect(from).toHaveBeenCalledWith("workspace_files");
    expect(readObject).toHaveBeenCalledTimes(1);
  });

  it("404s when note row is not found (type enforced)", async () => {
    (supabaseAnon.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "u1" } }, error: null });

    const single = jest.fn().mockResolvedValue({ data: null, error: { message: "not found" } });
    const select = jest.fn();
    const eq = jest.fn();
    const chain: any = { select, eq, single };
    select.mockReturnValue(chain);
    eq.mockReturnValue(chain);
    const from = jest.fn().mockReturnValue(chain);
    (supabase as jest.Mock).mockReturnValue({ from });

    const res = await request(app)
      .get(`/workspace/${workspaceId}/notes/${noteId}/content`)
      .set("Authorization", "Bearer valid");

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 401 when missing auth header", async () => {
    const res = await request(app)
      .get(`/workspace/${workspaceId}/notes/${noteId}/content`);
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid UUIDs", async () => {
    (supabaseAnon.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    const res = await request(app)
      .get(`/workspace/not-a-uuid/notes/${noteId}/content`)
      .set("Authorization", "Bearer valid");
    expect(res.status).toBe(400);
  });
});

