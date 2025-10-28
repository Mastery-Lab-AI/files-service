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
    writeObject: jest.fn(),
  };
});

import { supabaseAnon, supabase } from "../src/lib/supabase";
import { writeObject } from "../src/lib/gcs";
import { FilesController } from "../src/controllers/filesController";
import { authenticateUser } from "../src/middleware/authenticateUser";

describe("PUT /workspace/:workspaceId/notes/:noteId/content", () => {
  const app = express();
  app.use(express.json());
  const controller = new FilesController();
  app.put(
    "/workspace/:workspaceId/notes/:noteId/content",
    authenticateUser,
    controller.putNoteContent.bind(controller)
  );

  const workspaceId = "123e4567-e89b-12d3-a456-426614174000";
  const noteId = "123e4567-e89b-12d3-a456-426614174001";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("stores JSON content and returns 204", async () => {
    (supabaseAnon.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "u1" } }, error: null });

    const single = jest.fn().mockResolvedValue({
      data: {
        id: noteId,
        type: "note",
        student_id: "u1",
        workspace_id: workspaceId,
        name: "Doc",
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

    (writeObject as jest.Mock).mockResolvedValue({});

    const res = await request(app)
      .put(`/workspace/${workspaceId}/notes/${noteId}/content`)
      .set("Authorization", "Bearer valid")
      .send({ content: "Hello" });

    expect(res.status).toBe(204);
    expect(writeObject).toHaveBeenCalledWith(
      `workspace/${workspaceId}/notes/${noteId}`,
      JSON.stringify({ content: "Hello" }),
      expect.any(String)
    );
  });

  it("returns 404 when note row missing", async () => {
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
      .put(`/workspace/${workspaceId}/notes/${noteId}/content`)
      .set("Authorization", "Bearer valid")
      .send({ content: "Hello" });

    expect(res.status).toBe(404);
  });
});

