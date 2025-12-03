import { Database } from 'bun:sqlite';
import { randomUUID } from 'crypto';
import type { Project, ProjectRow, ProjectConfig, Environment } from '../types/index.js';
import {
  findProjectRoot,
  getProjectName,
  loadProjectConfig,
  saveProjectConfig,
  updateGitignore,
  writeEnvFile,
  detectEnvironment,
  fileExists
} from '../storage/filesystem.js';
import { PROJECT_CONFIG_FILE } from '../utils/constants.js';
import { ProjectNotInitializedError } from '../utils/errors.js';
import { join } from 'path';

export class ProjectManager {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  findProjectRoot(startPath: string): string | null {
    return findProjectRoot(startPath);
  }

  detectEnvironment(projectPath: string): string {
    return detectEnvironment(projectPath);
  }

  initProject(projectPath: string, options: { name?: string; envs?: Environment[] } = {}): Project {
    const name = options.name ?? getProjectName(projectPath);
    const id = randomUUID();
    const now = Date.now();

    const config: ProjectConfig = {
      version: '1.0',
      project: { name, id },
      environments: options.envs ?? ['dev', 'staging', 'prod'],
      secrets: []
    };

    saveProjectConfig(projectPath, config);
    updateGitignore(projectPath);

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO projects (id, name, path, created_at)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(id, name, projectPath, now);

    return { id, name, path: projectPath, created_at: now };
  }

  getProject(projectPath: string): Project | null {
    const stmt = this.db.prepare('SELECT * FROM projects WHERE path = ?');
    const row = stmt.get(projectPath) as ProjectRow | null;

    if (!row) {
      return null;
    }

    return this.rowToProject(row);
  }

  getProjectById(id: string): Project | null {
    const stmt = this.db.prepare('SELECT * FROM projects WHERE id = ?');
    const row = stmt.get(id) as ProjectRow | null;

    if (!row) {
      return null;
    }

    return this.rowToProject(row);
  }

  listProjects(): Project[] {
    const stmt = this.db.prepare('SELECT * FROM projects ORDER BY name');
    const rows = stmt.all() as ProjectRow[];
    return rows.map(row => this.rowToProject(row));
  }

  deleteProject(projectPath: string): boolean {
    const stmt = this.db.prepare('DELETE FROM projects WHERE path = ?');
    const result = stmt.run(projectPath);
    return result.changes > 0;
  }

  linkSecret(projectId: string, secretId: string): void {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO project_secrets (project_id, secret_id, added_at)
      VALUES (?, ?, ?)
    `);
    stmt.run(projectId, secretId, Date.now());
  }

  unlinkSecret(projectId: string, secretId: string): void {
    const stmt = this.db.prepare('DELETE FROM project_secrets WHERE project_id = ? AND secret_id = ?');
    stmt.run(projectId, secretId);
  }

  getProjectSecretIds(projectId: string): string[] {
    const stmt = this.db.prepare('SELECT secret_id FROM project_secrets WHERE project_id = ?');
    const rows = stmt.all(projectId) as Array<{ secret_id: string }>;
    return rows.map(r => r.secret_id);
  }

  syncToEnv(projectPath: string, secrets: Record<string, string>, environment: string): void {
    writeEnvFile(projectPath, secrets, environment);

    const stmt = this.db.prepare('UPDATE projects SET last_synced_at = ? WHERE path = ?');
    stmt.run(Date.now(), projectPath);
  }

  loadProjectConfig(projectPath: string): ProjectConfig | null {
    return loadProjectConfig(projectPath);
  }

  isProjectInitialized(projectPath: string): boolean {
    return fileExists(join(projectPath, PROJECT_CONFIG_FILE));
  }

  private rowToProject(row: ProjectRow): Project {
    return {
      id: row.id,
      name: row.name,
      path: row.path,
      created_at: row.created_at,
      last_synced_at: row.last_synced_at ?? undefined
    };
  }
}
