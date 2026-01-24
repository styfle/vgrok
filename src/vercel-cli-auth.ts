import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, platform } from 'node:os';

interface AuthJson {
  token: string;
  expiresAt: number;
}

interface ProjectJson {
  orgId: string;
  projectId: string;
}

/**
 * Get the Vercel CLI data directory based on platform
 * macOS: ~/Library/Application Support/com.vercel.cli/
 * Linux: ~/.local/share/com.vercel.cli/
 * Windows: %APPDATA%/com.vercel.cli/
 */
function getVercelCliDir(): string {
  const home = homedir();
  switch (platform()) {
    case 'darwin':
      return join(home, 'Library', 'Application Support', 'com.vercel.cli');
    case 'win32':
      return join(process.env.APPDATA || join(home, 'AppData', 'Roaming'), 'com.vercel.cli');
    default: // linux and others
      return join(home, '.local', 'share', 'com.vercel.cli');
  }
}

function readTokenFromAuthFile(): string | undefined {
  try {
    const content = readFileSync(join(getVercelCliDir(), 'auth.json'), 'utf-8');
    const auth: AuthJson = JSON.parse(content);
    return auth.token;
  } catch {
    return undefined;
  }
}

function readLocalProjectConfig(): ProjectJson | null {
  try {
    const projectPath = join(process.cwd(), '.vercel', 'project.json');
    const content = readFileSync(projectPath, 'utf-8');
    const project: ProjectJson = JSON.parse(content);
    return project;
  } catch {
    return null;
  }
}

export function vercelCliAuth() {
  const token = process.env.VERCEL_TOKEN || readTokenFromAuthFile();
  const projectConfig = readLocalProjectConfig();
  const teamId = process.env.VERCEL_TEAM_ID || projectConfig?.orgId;
  const projectId = process.env.VERCEL_PROJECT_ID || projectConfig?.projectId;

  if (!token) {
    throw new Error(
      'No Vercel token found.\n' +
      'Please run `vercel login` or set the VERCEL_TOKEN environment variable.'
    );
  }

  if (!teamId) {
    throw new Error(
      'No Vercel team found.\n' +
      'Please run `vercel link` in your project directory, or set the VERCEL_TEAM_ID environment variable.'
    );
  }

  if (!projectId) {
    throw new Error(
      'No Vercel project found.\n' +
      'Please run `vercel link` in your project directory, or set the VERCEL_PROJECT_ID environment variable.'
    );
  }

  return { token, teamId, projectId };
}

