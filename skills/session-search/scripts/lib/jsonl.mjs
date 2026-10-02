// GENERATED skill payload for session-search.

// src/skills/session-search/src/lib/jsonl.ts
import { open } from "node:fs/promises";
var OVERSIZE_PREFIX_BYTES = 8 * 1024;
var DEFAULT_MAX_OVERSIZE_BYTES = 32 * 1024 * 1024;
var CHUNK_BYTES = 256 * 1024;
async function readLines(file, options, onLine) {
  const maxOversize = options.maxOversizeBytes ?? DEFAULT_MAX_OVERSIZE_BYTES;
  const handle = await open(file, "r");
  const chunk = Buffer.allocUnsafe(CHUNK_BYTES);
  let parts = [];
  let lineBytes = 0;
  let mode = "normal";
  let prefix = "";
  let bytesRead = 0;
  let stopped = false;
  let timedOut = false;
  const append = (slice) => {
    if (slice.length === 0) return;
    lineBytes += slice.length;
    if (mode === "normal") {
      parts.push(Buffer.from(slice));
      if (lineBytes > options.maxLineBytes) {
        const head = Buffer.concat(parts).subarray(0, OVERSIZE_PREFIX_BYTES);
        prefix = head.toString("utf8");
        mode = options.keepOversize?.(prefix) ? "keep" : "drop";
        if (mode === "drop") parts = [];
      }
      return;
    }
    if (mode === "keep") {
      if (lineBytes > maxOversize) {
        mode = "drop";
        parts = [];
        return;
      }
      parts.push(Buffer.from(slice));
    }
  };
  const decode = (buffer) => {
    const end = buffer.length > 0 && buffer[buffer.length - 1] === 13 ? buffer.length - 1 : buffer.length;
    return buffer.toString("utf8", 0, end);
  };
  const finish = () => {
    if (lineBytes === 0) return true;
    let event;
    if (mode === "normal") {
      const text = decode(parts.length === 1 ? parts[0] : Buffer.concat(parts));
      event = text.trim() === "" ? null : { kind: "line", text };
    } else {
      event = {
        kind: "oversize",
        text: mode === "keep" ? decode(Buffer.concat(parts)) : null,
        prefix,
        bytes: lineBytes
      };
    }
    parts = [];
    lineBytes = 0;
    mode = "normal";
    prefix = "";
    return event === null ? true : onLine(event) !== false;
  };
  try {
    outer: for (; ; ) {
      if (options.deadline != null && Date.now() >= options.deadline) {
        timedOut = true;
        break;
      }
      const { bytesRead: count } = await handle.read(
        chunk,
        0,
        CHUNK_BYTES,
        null
      );
      if (count === 0) break;
      bytesRead += count;
      const view = chunk.subarray(0, count);
      let position = 0;
      while (position < count) {
        const newline = view.indexOf(10, position);
        if (newline === -1) {
          append(view.subarray(position));
          break;
        }
        if (lineBytes === 0 && newline - position <= options.maxLineBytes) {
          const text = decode(view.subarray(position, newline));
          position = newline + 1;
          if (text.trim() === "") continue;
          if (onLine({ kind: "line", text }) === false) {
            stopped = true;
            break outer;
          }
          continue;
        }
        append(view.subarray(position, newline));
        position = newline + 1;
        if (!finish()) {
          stopped = true;
          break outer;
        }
      }
    }
    if (!stopped && !timedOut && !finish()) stopped = true;
  } finally {
    await handle.close().catch(() => {
    });
  }
  return { bytesRead, stopped, timedOut };
}
function parseJsonObject(text) {
  try {
    const value = JSON.parse(text);
    return typeof value === "object" && value !== null && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}
export {
  DEFAULT_MAX_OVERSIZE_BYTES,
  OVERSIZE_PREFIX_BYTES,
  parseJsonObject,
  readLines
};
