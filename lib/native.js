export const DEFAULT_HOST_NAME = "com.file_bricks.rss_bookstore";
const DEFAULT_TIMEOUT_MS = 10_000;

export function createNativeClient(hostName = DEFAULT_HOST_NAME) {
  const port = chrome.runtime.connectNative(hostName);
  const pending = new Map();
  const eventListeners = new Set();
  let nextRequestId = 1;
  let disconnected = false;

  port.onMessage.addListener((message) => {
    const requestId = message?.requestId;
    if (requestId !== undefined && pending.has(requestId)) {
      const { resolve, reject, timeoutId } = pending.get(requestId);
      clearTimeout(timeoutId);
      pending.delete(requestId);

      if (message?.ok === false) {
        reject(new Error(message.message || message.error || "Native host request failed."));
        return;
      }

      resolve(message);
      return;
    }

    if (message?.event) {
      for (const listener of eventListeners) {
        listener(message);
      }
    }
  });

  port.onDisconnect.addListener(() => {
    disconnected = true;
    const disconnectReason = chrome.runtime.lastError?.message || "Native host disconnected.";
    for (const { reject, timeoutId } of pending.values()) {
      clearTimeout(timeoutId);
      reject(new Error(disconnectReason));
    }
    pending.clear();
  });

  function request(cmd, payload = {}, options = {}) {
    if (disconnected) {
      return Promise.reject(new Error("Native host is disconnected."));
    }

    const requestId = nextRequestId++;
    const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : DEFAULT_TIMEOUT_MS;

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        pending.delete(requestId);
        reject(new Error(`Native host timeout for '${cmd}' after ${timeoutMs} ms.`));
      }, timeoutMs);

      pending.set(requestId, { resolve, reject, timeoutId });
      port.postMessage({
        ...payload,
        cmd,
        requestId
      });
    });
  }

  return {
    request,
    ping(options) {
      return request("ping", {}, options);
    },
    exportItems(baseDir, items, options) {
      return request("export_items", { baseDir, items }, options);
    },
    deletePaths(paths, options = {}) {
      const { baseDir, timeoutMs } = options;
      return request("delete_paths", { baseDir, paths }, { timeoutMs });
    },
    scanFolder(baseDir, options) {
      return request("scan_folder", { baseDir }, options);
    },
    pollFolderChanges(baseDir, knownState = {}, options = {}) {
      const { timeoutMs } = options;
      return request("poll_folder_changes", { baseDir, knownState }, { timeoutMs });
    },
    watchFolder(baseDir, options = {}) {
      const { intervalMs, maxPolls, timeoutMs } = options;
      return request("watch_folder", { baseDir, intervalMs, maxPolls }, { timeoutMs });
    },
    getDefaultExportRoot(options = {}) {
      const { folderName, create, timeoutMs } = options;
      return request("get_default_export_root", { folderName, create }, { timeoutMs });
    },
    onEvent(listener) {
      eventListeners.add(listener);
      return () => eventListeners.delete(listener);
    },
    disconnect() {
      port.disconnect();
    }
  };
}
