import React, { useState, useEffect, useRef } from "react";
import { 
  Play, Square, RefreshCw, CheckCircle2, XCircle, AlertTriangle, 
  Settings, ChevronRight, Activity, Layers, CheckCircle, Database 
} from "lucide-react";
import { ApiEndpoint, RoleConfig, ResponseCodeLogs, ResponseLog } from "../types";
import { getRoleFromPath, generateMockBody } from "../utils";

interface AutoRunnerPanelProps {
  endpoints: ApiEndpoint[];
  roleConfigs: Record<string, RoleConfig>;
  responseHistory: ResponseCodeLogs;
  onUpdateHistory: (updatedHistory: ResponseCodeLogs) => void;
  isUsingFallback: boolean;
  onSelectEndpoint: (ep: ApiEndpoint) => void;
}

interface RunStatus {
  endpointKey: string;
  method: string;
  path: string;
  status: "idle" | "running" | "success" | "error" | "skipped";
  statusCode?: number;
  statusText?: string;
  durationMs?: number;
  isCustomized: boolean;
}

export default function AutoRunnerPanel({
  endpoints,
  roleConfigs,
  responseHistory,
  onUpdateHistory,
  isUsingFallback,
  onSelectEndpoint
}: AutoRunnerPanelProps) {
  // Config state
  const [filterMode, setFilterMode] = useState<"all" | "custom_only">("custom_only");
  const [delayMs, setDelayMs] = useState<number>(300); // delay between requests to avoid rate limits
  
  // Runner states
  const [isRunning, setIsRunning] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [runStatuses, setRunStatuses] = useState<RunStatus[]>([]);
  const [showPanel, setShowPanel] = useState<boolean>(true);

  // References to handle stopping safely
  const stopRequested = useRef(false);

  // Initialize/Refresh local endpoint statuses & configuration checks
  useEffect(() => {
    if (isRunning) return; // don't disrupt during run

    const statuses: RunStatus[] = endpoints.map((ep) => {
      const endpointKey = `${ep.method}:${ep.path}`;
      const role = getRoleFromPath(ep.path);
      
      // Check if custom configurations are available in local storage
      const storageKey = `qian_saved_inputs_${role}_${endpointKey}`;
      const savedStr = localStorage.getItem(storageKey);
      
      let isCustomized = false;
      if (savedStr) {
        try {
          const parsed = JSON.parse(savedStr);
          // An endpoint counts as customized if the user has changed headers, raw body, path parameters or query parameters
          const hasCustomHeaders = Array.isArray(parsed.customHeaders) && parsed.customHeaders.length > 0;
          const hasPathParams = parsed.pathParams && Object.values(parsed.pathParams).some(v => v !== "");
          const hasQueryParams = parsed.queryParams && Object.values(parsed.queryParams).some(v => v !== "");
          const hasBodyParams = parsed.bodyParams && Object.values(parsed.bodyParams).some(v => v !== "");
          
          isCustomized = hasCustomHeaders || hasPathParams || hasQueryParams || hasBodyParams || !!parsed.rawBodyJson;
        } catch (e) {
          isCustomized = false;
        }
      }

      return {
        endpointKey,
        method: ep.method,
        path: ep.path,
        status: "idle",
        isCustomized
      };
    });

    setRunStatuses(statuses);
  }, [endpoints, isRunning]);

  // Helper to compile request parameters for a high-fidelity simulator fetch
  const compileReqData = (ep: ApiEndpoint) => {
    const endpointKey = `${ep.method}:${ep.path}`;
    const role = getRoleFromPath(ep.path);
    const roleConfig = roleConfigs[role] || { role, baseUrl: "", headers: {}, savedValues: {} };

    const storageKey = `qian_saved_inputs_${role}_${endpointKey}`;
    const savedStr = localStorage.getItem(storageKey);

    // Set fallback defaults
    const defaultPath: Record<string, string> = {};
    const pathParamNames = ep.path.match(/\{([^}]+)\}/g)?.map((m) => m.slice(1, -1)) || [];
    pathParamNames.forEach((p) => {
      const swParam = ep.parameters.find((sp) => sp.name === p && sp.in === "path");
      defaultPath[p] = swParam?.default || "";
    });

    const defaultQuery: Record<string, string> = {};
    ep.parameters
      .filter((p) => p.in === "query")
      .forEach((p) => {
        defaultQuery[p.name] = p.default !== undefined ? p.default : "";
      });

    let defaultBody: Record<string, any> = {};
    if (ep.requestBody?.properties) {
      defaultBody = generateMockBody(ep.requestBody.properties);
    }

    let pathParams = defaultPath;
    let queryParams = defaultQuery;
    let bodyParams = defaultBody;
    let rawBodyJson = JSON.stringify(defaultBody, null, 2);
    let customHeaders: Array<{ key: string; val: string }> = [];
    let bodyMode: "form" | "raw" = "form";

    if (savedStr) {
      try {
        const saved = JSON.parse(savedStr);
        pathParams = { ...defaultPath, ...saved.pathParams };
        queryParams = { ...defaultQuery, ...saved.queryParams };
        bodyParams = { ...defaultBody, ...saved.bodyParams };
        rawBodyJson = saved.rawBodyJson !== undefined ? saved.rawBodyJson : JSON.stringify(defaultBody, null, 2);
        customHeaders = saved.customHeaders || [];
        bodyMode = saved.bodyMode || "form";
      } catch (e) {
        // ignore fallback errors
      }
    }

    // Subst path parameters
    let processedPath = ep.path;
    Object.entries(pathParams).forEach(([pName, pValue]) => {
      processedPath = processedPath.replace(`{${pName}}`, encodeURIComponent(String(pValue) || `{${pName}}`));
    });

    // Query string
    const queryParts: string[] = [];
    Object.entries(queryParams).forEach(([qName, qValue]) => {
      if (qValue !== undefined && qValue !== "") {
        queryParts.push(`${encodeURIComponent(qName)}=${encodeURIComponent(String(qValue))}`);
      }
    });

    // Final URL
    const fullUrl =
      roleConfig.baseUrl.trim().replace(/\/+$/, "") +
      processedPath +
      (queryParts.length > 0 ? `?${queryParts.join("&")}` : "");

    // Prepare headers
    const headers: Record<string, string> = {
      ...roleConfig.headers,
    };

    customHeaders.forEach((ch) => {
      if (ch.key.trim() !== "") {
        headers[ch.key.trim()] = ch.val;
      }
    });

    // Body
    let bodyToSend: any = undefined;
    if (["POST", "PUT", "PATCH", "DELETE"].includes(ep.method)) {
      if (bodyMode === "raw") {
        try {
          bodyToSend = JSON.parse(rawBodyJson);
        } catch (e) {
          bodyToSend = rawBodyJson;
        }
      } else {
        bodyToSend = bodyParams;
      }
    }

    return {
      url: fullUrl,
      method: ep.method,
      headers,
      body: bodyToSend
    };
  };

  // Run all active configured APIs sequentially
  const startBulkRun = async () => {
    if (endpoints.length === 0 || isRunning) return;

    setIsRunning(true);
    stopRequested.current = false;
    
    // Copy the original status entries to update them in real time
    const updatedStatuses = [...runStatuses];

    // Reset all statuses first
    updatedStatuses.forEach((s) => {
      s.status = "idle";
      s.statusCode = undefined;
      s.statusText = undefined;
      s.durationMs = undefined;
    });
    setRunStatuses([...updatedStatuses]);

    // Gather active list
    for (let i = 0; i < endpoints.length; i++) {
      if (stopRequested.current) {
        setIsRunning(false);
        break;
      }

      const ep = endpoints[i];
      const endpointKey = `${ep.method}:${ep.path}`;
      const statusIdx = updatedStatuses.findIndex((s) => s.endpointKey === endpointKey);

      if (statusIdx === -1) continue;

      // Skip filter checks if filterMode is custom_only
      if (filterMode === "custom_only" && !updatedStatuses[statusIdx].isCustomized) {
        updatedStatuses[statusIdx].status = "skipped";
        setRunStatuses([...updatedStatuses]);
        continue;
      }

      // Mark running
      updatedStatuses[statusIdx].status = "running";
      setCurrentIndex(i);
      setRunStatuses([...updatedStatuses]);

      // Compile request data details
      const reqData = compileReqData(ep);

      // Perform simulation fetch matching normal execution
      try {
        let responsePayload;

        const isStaticOrWebView = isUsingFallback || 
                                  window.location.protocol === "file:" || 
                                  window.location.hostname.includes("github.io") || 
                                  window.location.hostname.includes("vercel.app") ||
                                  window.location.hostname.includes("github");

        if (isStaticOrWebView) {
          const startTime = Date.now();
          const fetchOptions: RequestInit = {
            method: reqData.method,
            headers: reqData.headers,
          };
          if (reqData.body && ["POST", "PUT", "PATCH", "DELETE"].includes(reqData.method.toUpperCase())) {
            fetchOptions.body = typeof reqData.body === "string" ? reqData.body : JSON.stringify(reqData.body);
          }

          try {
            const response = await fetch(reqData.url, fetchOptions);
            const duration = Date.now() - startTime;
            
            let responseBodyText = "";
            try { responseBodyText = await response.text(); } catch (e) {}

            let parsedBody: any = null;
            try { parsedBody = JSON.parse(responseBodyText); } catch (e) { parsedBody = responseBodyText; }

            const resHeaders: Record<string, string> = {};
            response.headers.forEach((v, k) => { resHeaders[k] = v; });

            responsePayload = {
              status: response.status,
              statusText: response.statusText,
              durationMs: duration,
              headers: resHeaders,
              body: parsedBody
            };
          } catch (directErr) {
            // express proxy fallback
            const resp = await fetch("/api/proxy-request", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                url: reqData.url,
                method: reqData.method,
                headers: reqData.headers,
                body: reqData.body,
              }),
            });
            responsePayload = await resp.json();
          }
        } else {
          const resp = await fetch("/api/proxy-request", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url: reqData.url,
              method: reqData.method,
              headers: reqData.headers,
              body: reqData.body,
            }),
          });
          responsePayload = await resp.json();
        }

        // Construct high fidelity log
        const logRecord: ResponseLog = {
          endpointKey,
          status: responsePayload.status,
          statusText: responsePayload.statusText,
          durationMs: responsePayload.durationMs,
          timestamp: new Date().toISOString(),
          headers: responsePayload.headers || {},
          body: responsePayload.body || {},
          requestSent: {
            url: reqData.url,
            method: reqData.method,
            headers: reqData.headers,
            body: reqData.body
          }
        };

        // Write to local responseHistory
        const nextHistory = { ...responseHistory };
        if (!nextHistory[endpointKey]) {
          nextHistory[endpointKey] = {};
        }
        nextHistory[endpointKey][responsePayload.status] = logRecord;
        onUpdateHistory(nextHistory);

        // Update local list state
        updatedStatuses[statusIdx].status = responsePayload.status >= 200 && responsePayload.status < 400 ? "success" : "error";
        updatedStatuses[statusIdx].statusCode = responsePayload.status;
        updatedStatuses[statusIdx].statusText = responsePayload.statusText;
        updatedStatuses[statusIdx].durationMs = responsePayload.durationMs;

      } catch (err: any) {
        // Log custom error record
        const errorRecord: ResponseLog = {
          endpointKey,
          status: 600,
          statusText: "Connection Offline",
          durationMs: 0,
          timestamp: new Date().toISOString(),
          headers: {},
          body: { error: "Automated test connection error", details: err.message },
          requestSent: {
            url: reqData.url,
            method: reqData.method,
            headers: reqData.headers,
            body: reqData.body
          }
        };

        const nextHistory = { ...responseHistory };
        if (!nextHistory[endpointKey]) {
          nextHistory[endpointKey] = {};
        }
        nextHistory[endpointKey][600] = errorRecord;
        onUpdateHistory(nextHistory);

        updatedStatuses[statusIdx].status = "error";
        updatedStatuses[statusIdx].statusCode = 600;
        updatedStatuses[statusIdx].statusText = "Offline Err";
        updatedStatuses[statusIdx].durationMs = 0;
      }

      setRunStatuses([...updatedStatuses]);

      // Introduce delay to visualize the transition nicely and respect request volumes
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    setIsRunning(false);
    setCurrentIndex(-1);
  };

  const stopBulkRun = () => {
    stopRequested.current = true;
  };

  // Calculations for stats
  const totalRan = runStatuses.filter((s) => s.status !== "idle" && s.status !== "skipped").length;
  const totalSkipped = runStatuses.filter((s) => s.status === "skipped").length;
  const totalCustomized = runStatuses.filter((s) => s.isCustomized).length;
  const activeTargets = filterMode === "custom_only" ? totalCustomized : endpoints.length;
  
  const successCount = runStatuses.filter((s) => s.status === "success").length;
  const errorCount = runStatuses.filter((s) => s.status === "error").length;

  const percentProgress = activeTargets > 0 ? Math.min(100, Math.round(((successCount + errorCount) / activeTargets) * 100)) : 0;

  return (
    <div className="bg-brand-sidebar border border-slate-800 rounded-xl shadow-xl overflow-hidden mb-6">
      {/* Header with expand control */}
      <div 
        className="px-5 py-4 bg-slate-900/40 border-b border-slate-800 flex items-center justify-between cursor-pointer select-none"
        onClick={() => setShowPanel(!showPanel)}
      >
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-indigo-500/10 text-indigo-400 rounded-lg">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              Automated API Runner Board
              <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 text-[9px] rounded font-sans uppercase">
                Fitur Baru
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">Jalankan seluruh rute/API terkonfigurasi secara serial otomatis</p>
          </div>
        </div>

        <button 
          id="btn-toggle-runner-panel"
          className="text-slate-400 hover:text-white transition p-1"
        >
          {showPanel ? (
            <span className="text-xs font-mono">Collapse [▲]</span>
          ) : (
            <span className="text-xs font-mono">Expand [▼]</span>
          )}
        </button>
      </div>

      {showPanel && (
        <div className="p-5 space-y-5">
          {/* Controls section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-brand-bg p-4 rounded-xl border border-slate-800">
            {/* Target Filter Mode */}
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-slate-400 font-sans tracking-wider block">Scope Penargetan</label>
              <div className="flex gap-1.5 bg-brand-sidebar p-1 rounded-lg border border-slate-800">
                <button
                  id="btn-set-custom-only"
                  disabled={isRunning}
                  onClick={() => setFilterMode("custom_only")}
                  className={`flex-1 text-[11px] font-semibold py-1.5 px-2 rounded transition text-center cursor-pointer ${
                    filterMode === "custom_only"
                      ? "bg-indigo-600 text-white"
                      : "text-slate-400 hover:text-slate-200 disabled:opacity-40"
                  }`}
                >
                  Kustom Saja ({totalCustomized})
                </button>
                <button
                  id="btn-set-all-endpoints"
                  disabled={isRunning}
                  onClick={() => setFilterMode("all")}
                  className={`flex-1 text-[11px] font-semibold py-1.5 px-2 rounded transition text-center cursor-pointer ${
                    filterMode === "all"
                      ? "bg-indigo-600 text-white"
                      : "text-slate-400 hover:text-slate-200 disabled:opacity-40"
                  }`}
                >
                  Semua Rute ({endpoints.length})
                </button>
              </div>
            </div>

            {/* Delay Speed setting */}
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-slate-400 font-sans tracking-wider block">Jeda Kecepatan (Delay)</label>
              <div className="flex items-center gap-2 bg-brand-sidebar p-1 rounded-lg border border-slate-800 px-2">
                <input
                  id="runner-delay-range"
                  type="range"
                  min="50"
                  max="1500"
                  step="50"
                  disabled={isRunning}
                  value={delayMs}
                  onChange={(e) => setDelayMs(Number(e.target.value))}
                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 disabled:opacity-40"
                />
                <span className="text-xs font-mono text-indigo-400 shrink-0 w-12 text-right">{delayMs}ms</span>
              </div>
            </div>

            {/* Run triggers */}
            <div className="flex items-end h-full">
              {!isRunning ? (
                <button
                  id="btn-trigger-bulk-run"
                  disabled={activeTargets === 0}
                  onClick={startBulkRun}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/10 cursor-pointer h-[38px]"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Mulai Jalankan Simulator ({activeTargets})
                </button>
              ) : (
                <button
                  id="btn-stop-bulk-run"
                  onClick={stopBulkRun}
                  className="w-full bg-rose-600/20 text-rose-400 hover:bg-rose-600/30 border border-rose-500/20 text-xs font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2 cursor-pointer h-[38px]"
                >
                  <Square className="w-3.5 h-3.5 fill-current text-rose-400" />
                  Hentikan Proses Run
                </button>
              )}
            </div>
          </div>

          {/* Progress gauge bar if runner has run previously or is running now */}
          {totalRan > 0 && (
            <div className="space-y-1.5 p-4 bg-slate-900/20 border border-slate-800/80 rounded-xl">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-semibold flex items-center gap-1">
                  {isRunning ? (
                    <>
                      <RefreshCw className="w-3 h-3 text-indigo-400 animate-spin" />
                      Mengeksekusi...
                    </>
                  ) : percentProgress === 100 ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Simulasi Selesai
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5 text-rose-400" />
                      Dihentikan
                    </>
                  )}
                </span>
                <span className="font-mono text-xs text-white font-bold">{percentProgress}% ({successCount + errorCount}/{activeTargets})</span>
              </div>

              {/* Slider wrapper progress */}
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${percentProgress === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                  style={{ width: `${percentProgress}%` }}
                />
              </div>

              {/* Breakdown counts metrics */}
              <div className="flex items-center gap-4 text-[11px] pt-1">
                <span className="flex items-center gap-1 text-emerald-400 font-medium font-mono">
                  ● {successCount} Berhasil (2xx)
                </span>
                <span className="flex items-center gap-1 text-amber-500 font-medium font-mono">
                  ● {errorCount} Gagal
                </span>
                {totalSkipped > 0 && (
                  <span className="flex items-center gap-1 text-slate-500 font-medium font-mono">
                    ● {totalSkipped} Dilewati
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Sequential Live Execution Feed table */}
          <div className="border border-slate-800/60 rounded-xl overflow-hidden bg-brand-bg select-none">
            <div className="px-4 py-2 bg-slate-900/60 border-b border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-widest flex justify-between items-center">
              <span>Rute Simulasi</span>
              <span>Status Eksekusi</span>
            </div>

            <div className="divide-y divide-slate-800/60 max-h-[220px] overflow-y-auto scrollbar-thin">
              {runStatuses.map((s, index) => {
                const isCurrent = isRunning && index === currentIndex;
                
                return (
                  <div 
                    key={s.endpointKey} 
                    onClick={() => {
                      const matchedEp = endpoints.find(e => `${e.method}:${e.path}` === s.endpointKey);
                      if (matchedEp) onSelectEndpoint(matchedEp);
                    }}
                    className={`px-4 py-2.5 flex items-center justify-between text-xs hover:bg-slate-800/30 transition cursor-pointer ${
                      isCurrent ? "bg-indigo-950/20 border-l-2 border-indigo-500 pl-3.5" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`px-1.5 py-0.5 text-[10px] font-extrabold rounded font-mono ${
                        s.method === "GET" ? "bg-emerald-950/50 text-emerald-400 border border-emerald-550/25" :
                        s.method === "POST" ? "bg-sky-950/50 text-sky-400 border border-sky-550/25" :
                        s.method === "PUT" ? "bg-amber-950/50 text-amber-400 border border-amber-550/25" :
                        "bg-red-950/50 text-red-450 border border-red-550/25"
                      }`}>
                        {s.method}
                      </span>
                      <span className="text-slate-300 font-mono text-[11px] truncate" title={s.path}>{s.path}</span>
                      
                      {s.isCustomized ? (
                        <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/15 text-[8px] px-1 py-0.2 rounded font-sans scale-90 origin-left uppercase">
                          Kustom
                        </span>
                      ) : (
                        <span className="bg-slate-800 text-slate-500 text-[8px] px-1 py-0.2 rounded font-sans scale-90 origin-left uppercase">
                          Bawaan
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {s.status === "idle" && (
                        <span className="text-[11px] text-slate-600 font-medium">Idle</span>
                      )}
                      {s.status === "skipped" && (
                        <span className="text-[11px] text-slate-500 font-medium">Dilewati</span>
                      )}
                      {s.status === "running" && (
                        <span className="text-[11px] text-indigo-400 font-bold flex items-center gap-1 bg-indigo-500/10 px-2 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-ping" />
                          Running
                        </span>
                      )}
                      {s.status === "success" && (
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[11px] text-slate-400">{s.durationMs}ms</span>
                          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold font-mono px-2 py-0.5 rounded text-[10px]">
                            {s.statusCode} OK
                          </span>
                        </div>
                      )}
                      {s.status === "error" && (
                        <div className="flex items-center gap-1.5">
                          {s.durationMs !== undefined && <span className="font-mono text-[11px] text-slate-400">{s.durationMs}ms</span>}
                          <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold font-mono px-2 py-0.5 rounded text-[10px]">
                            {s.statusCode || "ERR"}
                          </span>
                        </div>
                      )}
                      <ChevronRight className="w-3.5 h-3.5 text-slate-650" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
