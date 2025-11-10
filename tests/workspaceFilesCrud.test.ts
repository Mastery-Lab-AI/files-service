import express from 'express';
import request from 'supertest';

jest.mock("../src/lib/supabase", () => ({
  supabaseAnon: { auth: { getUser: jest.fn() } },
  supabase: jest.fn(),
}));

jest.mock("../src/lib/gcs", () => ({
  writeObject: jest.fn(),
  buildFileObjectPath: jest.requireActual("../src/lib/gcs").buildFileObjectPath,
}));

import { supabaseAnon, supabase } from "../src/lib/supabase";
import { writeObject } from "../src/lib/gcs";
import { FilesController } from "../src/controllers/filesController";
import { authenticateUser } from "../src/middleware/authenticateUser";

describe("Workspace files CRUD", () => {
  const app = express();
  app.use(express.json());
  const controller = new FilesController();

  app.post('/workspace/:workspaceId/files', authenticateUser, controller.createFileInWorkspace.bind(controller));
  app.patch('/workspace/:workspaceId/files/:fileId', authenticateUser, controller.updateFile.bind(controller));
  app.put('/workspace/:workspaceId/files/:fileId/content', express.raw({ type: '*/*' }), authenticateUser, controller.putFileContent.bind(controller));
  app.delete('/workspace/:workspaceId/files/:fileId', authenticateUser, controller.deleteFile.bind(controller));

  const ws = '123e4567-e89b-12d3-a456-426614174000';
  const fileId = '123e4567-e89b-12d3-a456-426614174001';

  beforeEach(() => {
    jest.clearAllMocks();
    (supabaseAnon.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
  });

  it('creates a document in workspace', async () => {
    const single = jest.fn().mockResolvedValue({
      data: { id: fileId, type: 'document', student_id: 'u1', workspace_id: ws, name: 'Doc', created_at: '2024', updated_at: '2024' },
      error: null,
    });
    const select = jest.fn().mockReturnValue({ single });
    const insert = jest.fn().mockReturnValue({ select });
    const from = jest.fn().mockReturnValue({ insert });
    (supabase as jest.Mock).mockReturnValue({ from });

    const res = await request(app)
      .post(`/workspace/${ws}/files`)
      .set('Authorization', 'Bearer ok')
      .send({ name: 'Doc', type: 'document' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('contentRef');
    expect(res.body.type).toBe('document');
  });

  it('renames a file and returns updated record', async () => {
    const thirdEq = jest.fn().mockResolvedValue({ error: null });
    const secondEq = jest.fn().mockReturnValue({ eq: thirdEq });
    const firstEq = jest.fn().mockReturnValue({ eq: secondEq });
    const update = jest.fn().mockReturnValue({ eq: firstEq });

    const single = jest.fn().mockResolvedValue({ data: { id: fileId, type: 'document', student_id: 'u1', workspace_id: ws, name: 'Renamed', created_at: '2024', updated_at: '2024' }, error: null });
    const eq3 = jest.fn().mockReturnValue({ single });
    const eq2 = jest.fn().mockReturnValue({ eq: eq3 });
    const eq1 = jest.fn().mockReturnValue({ eq: eq2 });
    const select = jest.fn().mockReturnValue({ eq: eq1 });

    const from = jest.fn().mockReturnValue({ update, select });
    (supabase as jest.Mock).mockReturnValue({ from });

    const res = await request(app)
      .patch(`/workspace/${ws}/files/${fileId}`)
      .set('Authorization', 'Bearer ok')
      .send({ name: 'Renamed' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Renamed');
  });

  it('uploads file content (generic path)', async () => {
    const single = jest.fn().mockResolvedValue({ data: { id: fileId }, error: null });
    const eq3 = jest.fn().mockReturnValue({ single });
    const eq2 = jest.fn().mockReturnValue({ eq: eq3 });
    const eq1 = jest.fn().mockReturnValue({ eq: eq2 });
    const select = jest.fn().mockReturnValue({ eq: eq1 });
    const from = jest.fn().mockReturnValue({ select });
    (supabase as jest.Mock).mockReturnValue({ from });
    (writeObject as jest.Mock).mockResolvedValue({});

    const res = await request(app)
      .put(`/workspace/${ws}/files/${fileId}/content`)
      .set('Authorization', 'Bearer ok')
      .set('Content-Type', 'application/pdf')
      .send('PDF BYTES');

    expect(res.status).toBe(204);
    expect(writeObject).toHaveBeenCalled();
  });

  it('deletes a file record', async () => {
    const del = jest.fn().mockReturnValue({ eq: jest.fn().mockReturnThis() });
    const from = jest.fn().mockReturnValue({ delete: del });
    (supabase as jest.Mock).mockReturnValue({ from });

    const res = await request(app)
      .delete(`/workspace/${ws}/files/${fileId}`)
      .set('Authorization', 'Bearer ok');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
  });
});
