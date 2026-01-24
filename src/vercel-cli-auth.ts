import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, platform } from 'node:os';

// Vercel CLI file structures
interface AuthJson {
  token?: string;
}

interface ConfigJson {
  currentTeam?: string;
}

interface ProjectJson {
  orgId?: string;
  projectId?: string;
}

interface VercelAuth {
  token: string;
  teamId: string;
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

const VERCEL_CLI_DIR = getVercelCliDir();
const AUTH_FILE = join(VERCEL_CLI_DIR, 'auth.json');
const CONFIG_FILE = join(VERCEL_CLI_DIR, 'config.json');

/**
 * Read token from Vercel CLI auth file
 */
function readTokenFromAuthFile(): string | null {
  try {
    const content = readFileSync(AUTH_FILE, 'utf-8');
    const auth: AuthJson = JSON.parse(content);
    return auth.token || null;
  } catch {
    return null;
  }
}

/**
 * Read current team from Vercel CLI global config
 */
function readCurrentTeamFromConfig(): string | null {
  try {
    const content = readFileSync(CONFIG_FILE, 'utf-8');
    const config: ConfigJson = JSON.parse(content);
    return config.currentTeam || null;
  } catch {
    return null;
  }
}

/**
 * Read project config from local .vercel/project.json
 */
function readLocalProjectConfig(): { orgId: string | null; projectId: string | null } {
  try {
    const projectPath = join(process.cwd(), '.vercel', 'project.json');
    const content = readFileSync(projectPath, 'utf-8');
    const project: ProjectJson = JSON.parse(content);
    return {
      orgId: project.orgId || null,
      projectId: project.projectId || null,
    };
  } catch {
    return { orgId: null, projectId: null };
  }
}

/**
 * Load Vercel token with priority:
 * 1. Vercel CLI auth file
 * 2. VERCEL_TOKEN environment variable
 */
export function loadVercelToken(): string | null {
  return readTokenFromAuthFile() || process.env.VERCEL_TOKEN || null;
}

/**
 * Load Vercel config (teamId, projectId) with priority:
 * 1. Local .vercel/project.json
 * 2. Global Vercel CLI config (currentTeam only)
 * 3. Environment variables
 */
export function loadVercelConfig(): { teamId: string | null; projectId: string | null } {
  // Priority 1: Local project config
  const localConfig = readLocalProjectConfig();
  
  // Priority 2: Global CLI config (for team only)
  const globalTeam = readCurrentTeamFromConfig();
  
  // Priority 3: Environment variables
  const envTeamId = process.env.VERCEL_TEAM_ID || null;
  const envProjectId = process.env.VERCEL_PROJECT_ID || null;

  return {
    teamId: localConfig.orgId || globalTeam || envTeamId,
    projectId: localConfig.projectId || envProjectId,
  };
}

/**
 * Load all Vercel auth credentials, throwing helpful errors if missing
 */
export function requireVercelAuth(): VercelAuth {
  const token = loadVercelToken();
  const { teamId, projectId } = loadVercelConfig();

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

