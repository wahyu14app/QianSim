import { RoleConfig, ResponseLog, ResponseCodeLogs } from "../types";

export const readWorkspaceConfig = async (ws: FileSystemDirectoryHandle): Promise<{
    roleConfigs: Record<string, RoleConfig>,
    inputsStore: Record<string, any>
} | null> => {
  try {
    const fileHandle = await ws.getFileHandle("config.json");
    const file = await fileHandle.getFile();
    const text = await file.text();
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
};

export const writeWorkspaceConfig = async (
    ws: FileSystemDirectoryHandle, 
    data: { roleConfigs: Record<string, RoleConfig>, inputsStore: Record<string, any> }
) => {
  try {
    const fileHandle = await ws.getFileHandle("config.json", { create: true });
    // @ts-ignore
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(data, null, 2));
    await writable.close();
  } catch (e) {
    console.error("Failed to write config.json", e);
  }
};

export const readWorkspaceResponses = async (ws: FileSystemDirectoryHandle): Promise<ResponseCodeLogs> => {
  const responses: ResponseCodeLogs = {};
  try {
    const root = await ws.getDirectoryHandle("responses");
    // @ts-ignore
    for await (const [role, roleHandle] of root.entries()) {
      if (roleHandle.kind !== "directory") continue;
      // @ts-ignore
      for await (const [apiSlug, apiHandle] of roleHandle.entries()) {
        if (apiHandle.kind !== "directory") continue;
        // @ts-ignore
        for await (const [statusFile, fileHandle] of apiHandle.entries()) {
          if (fileHandle.kind !== "file" || !statusFile.endsWith(".json")) continue;
          
          const file = await fileHandle.getFile();
          const text = await file.text();
          try {
            const data: ResponseLog = JSON.parse(text);
            const endpointKey = data.endpointKey;
            if (endpointKey) {
              if (!responses[endpointKey]) responses[endpointKey] = {};
              responses[endpointKey][data.status] = data;
            }
          } catch (err) {}
        }
      }
    }
  } catch (e) {
    // If responses dir doesn't exist, it's fine
  }
  return responses;
};

export const writeWorkspaceResponse = async (
    ws: FileSystemDirectoryHandle,
    role: string,
    endpointKey: string,
    log: ResponseLog
) => {
    try {
        const root = await ws.getDirectoryHandle("responses", { create: true });
        const rDir = await root.getDirectoryHandle(role, { create: true });
        
        // safe filename
        const aSlug = endpointKey.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
        const aDir = await rDir.getDirectoryHandle(aSlug, { create: true });
        
        const fileHandle = await aDir.getFileHandle(`${log.status}.json`, { create: true });
        // @ts-ignore
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(log, null, 2));
        await writable.close();
    } catch (e) {
        console.error("Failed to write response log", e);
    }
};

export const clearWorkspaceResponses = async (
    ws: FileSystemDirectoryHandle,
    role: string,
    endpointKey: string
) => {
    try {
        const root = await ws.getDirectoryHandle("responses");
        const rDir = await root.getDirectoryHandle(role);
        const aSlug = endpointKey.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
        await rDir.removeEntry(aSlug, { recursive: true });
    } catch (e) {
        console.error("Failed to clear response logs", e);
    }
};
