import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export function captureWriter() {
  let value = '';
  return {
    stream: {
      write(chunk) {
        value += chunk;
      }
    },
    value() {
      return value;
    }
  };
}

export function parseJsonl(contents) {
  return String(contents)
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

export async function runNodeScript(scriptPath, args = [], options = {}) {
  try {
    return await execFileAsync(process.execPath, [scriptPath, ...args], {
      cwd: options.cwd,
      env: options.env,
      maxBuffer: options.maxBuffer ?? 8 * 1024 * 1024
    });
  } catch (error) {
    error.message = `${error.message}\nstdout:\n${error.stdout ?? ''}\nstderr:\n${error.stderr ?? ''}`;
    throw error;
  }
}
