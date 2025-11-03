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
    deleteObject: jest.fn(),
    buildFileObjectPath: jest.requireActual("../src/lib/gcs").buildFileObjectPath,
  };
});

import { supabaseAnon, supabase } from "../src/lib/supabase";
import { deleteObject } from "../src/lib/gcs";
import { FilesController } from "../src/controllers/filesController";
import { authenticateUser } from "../src/middleware/authenticateUser";

function buildDeleteChain(noteId: string) {
  const final = Promise.resolve({ data: null, error: null }); // unused now
  const eq4 = { eq: jest.fn().mockReturnValue(final) } as any;
  const eq3 = { eq: jest.fn().mockReturnValue(eq4) } as any;
  const eq2 = { eq: jest.fn().mockReturnValue(eq3) } as any;
  const eq1 = { eq: jest.fn().mockReturnValue(eq2) } as any;
  // Make the select chain tolerant to multiple .eq() calls and expose count
  const selectChain: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    count: 0,
  };
  const select = jest.fn().mockReturnValue(selectChain);
  return { delete: jest.fn().mockReturnValue(eq1), select } as any;
}

describe("DELETE /workspace/:workspaceId/notes/:noteId", () => {
  const app = express();
  app.use(express.json());
  const controller = new FilesController();
  app.delete(
    "/workspace/:workspaceId/notes/:noteId",
    authenticateUser,
    controller.deleteNote.bind(controller)
  );

  const workspaceId = "123e4567-e89b-12d3-a456-426614174000";
  const noteId = "123e4567-e89b-12d3-a456-426614174001";

  beforeEach(() => jest.clearAllMocks());

  it("deletes GCS objects and DB row, returns 200", async () => {
    (supabaseAnon.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "u1" } }, error: null });

    const single = jest.fn().mockResolvedValue({
      data: { id: noteId, type: "note", student_id: "u1", workspace_id: workspaceId, name: "Doc" },
      error: null,
    });
    const select = jest.fn().mockReturnThis();
    const eq = jest.fn().mockReturnThis();
    const selectChain: any = { select, eq, single };

    const from = jest.fn().mockReturnValue(buildDeleteChain(noteId));
    (supabase as jest.Mock).mockReturnValue({ from });

    (deleteObject as jest.Mock).mockResolvedValue(true);

    const res = await request(app)
      .delete(`/workspace/${workspaceId}/notes/${noteId}`)
      .set("Authorization", "Bearer valid");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: "Note deleted successfully" });
    expect(from).toHaveBeenCalledWith("workspace_files");
    expect(deleteObject).toHaveBeenCalledWith(`workspace/${workspaceId}/notes/${noteId}`);
    expect(deleteObject).toHaveBeenCalledWith(`workspace/${workspaceId}/files/${noteId}`);
  });

  it("returns 200 when note may not exist (no-op)", async () => {
    (supabaseAnon.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "u1" } }, error: null });

    const single = jest.fn().mockResolvedValue({ data: null, error: { message: "not found" } });
    const select = jest.fn().mockReturnThis();
    const eq = jest.fn().mockReturnThis();
    const selectChain: any = { select, eq, single };
    const from = jest.fn().mockReturnValue(buildDeleteChain(noteId));
    (supabase as jest.Mock).mockReturnValue({ from });
    (deleteObject as jest.Mock).mockResolvedValue(true);

    const res = await request(app)
      .delete(`/workspace/${workspaceId}/notes/${noteId}`)
      .set("Authorization", "Bearer valid");

    expect(res.status).toBe(200);
  });

  it("returns 401 when missing auth header", async () => {
    const res = await request(app)
      .delete(`/workspace/${workspaceId}/notes/${noteId}`);
    expect(res.status).toBe(401);
  });
});

describe("DELETE /files/notes/:noteId (my workspace)", () => {
  const app = express();
  app.use(express.json());
  const controller = new FilesController();
  app.delete(
    "/files/notes/:noteId",
    authenticateUser,
    controller.deleteMyNote.bind(controller)
  );

  const noteId = "123e4567-e89b-12d3-a456-426614174001";

  beforeEach(() => jest.clearAllMocks());

  it("uses studentId as workspaceId and deletes", async () => {
    (supabaseAnon.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "u1" } }, error: null });

    const single = jest.fn().mockResolvedValue({
      data: { id: noteId, type: "note", student_id: "u1", workspace_id: "u1", name: "Doc" },
      error: null,
    });
    const select = jest.fn().mockReturnThis();
    const eq = jest.fn().mockReturnThis();
    const selectChain: any = { select, eq, single };

    const from = jest.fn().mockReturnValue(buildDeleteChain(noteId));
    (supabase as jest.Mock).mockReturnValue({ from });

    (deleteObject as jest.Mock).mockResolvedValue(true);

    const res = await request(app)
      .delete(`/files/notes/${noteId}`)
      .set("Authorization", "Bearer valid");

    expect(res.status).toBe(200);
    expect(deleteObject).toHaveBeenCalledWith(`workspace/u1/notes/${noteId}`);
    expect(deleteObject).toHaveBeenCalledWith(`workspace/u1/files/${noteId}`);
  });
});








