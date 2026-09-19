import { homedir } from 'node:os';
import path from 'node:path';

import { CollaborationError } from './records.js';
import { assertUuid, pinKey, type Pin } from './types.js';

export interface CollaborationPaths {
  root: string;
  directory: string;
  collaboration: string;
  members: string;
  bindings: string;
  departures: string;
  inbox: string;
  acknowledgments: string;
  logEntries: string;
  renderedLog: string;
  closed: string;
}

function requireAbsolute(value: string, name: string): string {
  if (!path.isAbsolute(value)) {
    throw new CollaborationError('INVALID_ROOT', `${name} must be absolute`);
  }
  return path.resolve(value);
}

export function resolveCollaborationRoot(
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (env.SESSION_OBSERVER_STATE_DIR) {
    return requireAbsolute(
      env.SESSION_OBSERVER_STATE_DIR,
      'SESSION_OBSERVER_STATE_DIR',
    );
  }
  if (env.XDG_STATE_HOME) {
    return path.join(
      requireAbsolute(env.XDG_STATE_HOME, 'XDG_STATE_HOME'),
      'session-observer',
      'collab',
    );
  }
  const home = env.HOME || homedir();
  return path.join(
    requireAbsolute(home, 'HOME'),
    '.local',
    'state',
    'session-observer',
    'collab',
  );
}

export function collaborationPaths(
  root: string,
  collaborationId: string,
): CollaborationPaths {
  if (!path.isAbsolute(root))
    throw new CollaborationError('INVALID_ROOT', 'root must be absolute');
  try {
    assertUuid(collaborationId, 'collaboration ID');
  } catch (error) {
    throw new CollaborationError('INVALID_ID', (error as Error).message);
  }
  const directory = path.join(root, 'collaborations', collaborationId);
  return {
    root,
    directory,
    collaboration: path.join(directory, 'collaboration.json'),
    members: path.join(directory, 'members'),
    bindings: path.join(directory, 'bindings'),
    departures: path.join(directory, 'departures'),
    inbox: path.join(directory, 'inbox'),
    acknowledgments: path.join(directory, 'acks'),
    logEntries: path.join(directory, 'log', 'entries'),
    renderedLog: path.join(directory, 'collaboration.md'),
    closed: path.join(directory, 'closed.json'),
  };
}

export function activationDirectory(root: string, pin: Pin): string {
  return path.join(root, 'activations', pinKey(pin));
}
