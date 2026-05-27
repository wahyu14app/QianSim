import React, { useState, useEffect } from "react";
import { Play, Code, Edit2, AlertCircle, FileJson, Plus, Trash2 } from "lucide-react";
import { ApiEndpoint, RoleConfig } from "../types";
import { generateMockBody } from "../utils";

interface ProxyRequestFormProps {
  endpoint: ApiEndpoint;
  roleConfig: RoleConfig;
  onExecute: (requestData: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body: any;
  }) => void;
  isLoading: boolean;
}

export default function ProxyRequestForm({
  endpoint,
  roleConfig,
  onExecute,
  isLoading,
}: ProxyRequestFormProps) {
  const endpointKey = `${endpoint.method}:${endpoint.path}`;

  // Local states for inputs matching this specific endpoint
  const [pathParams, setPathParams] = useState<Record<string, string>>({});
  const [queryParams, setQueryParams] = useState<Record<string, string>>({});
  const [bodyParams, setBodyParams] = useState<Record<string, any>>({});
  const [rawBodyJson, setRawBodyJson] = useState("");
  const [bodyMode, setBodyMode] = useState<"form" | "raw">("form");
  const [customHeaders, setCustomHeaders] = useState<Array<{ key: string; val: string }>>([]);

  // Detect dynamic path params directly from path pattern: e.g. /api/v1/admin/staff/{id}
  const pathParamNames = React.useMemo(() => {
    const matches = endpoint.path.match(/\{([^}]+)\}/g);
    if (!matches) return [];
    return matches.map((m) => m.slice(1, -1));
  }, [endpoint.path]);

  // Load saved state from LocalStorage when endpoint change
  useEffect(() => {
    const storageKey = `qian_saved_inputs_${roleConfig.role}_${endpointKey}`;
    const savedStr = localStorage.getItem(storageKey);

    // Default bodies/query/path
    const defaultPath: Record<string, string> = {};
    pathParamNames.forEach((p) => {
      // look in Swagger specs
      const swParam = endpoint.parameters.find((sp) => sp.name === p && sp.in === "path");
      defaultPath[p] = swParam?.default || "";
    });

    const defaultQuery: Record<string, string> = {};
    endpoint.parameters
      .filter((p) => p.in === "query")
      .forEach((p) => {
        defaultQuery[p.name] = p.default !== undefined ? p.default : "";
      });

    let defaultBody: Record<string, any> = {};
    if (endpoint.requestBody?.properties) {
      defaultBody = generateMockBody(endpoint.requestBody.properties);
    }

    if (savedStr) {
      try {
        const saved = JSON.parse(savedStr);
        setPathParams({ ...defaultPath, ...saved.pathParams });
        setQueryParams({ ...defaultQuery, ...saved.queryParams });
        setBodyParams({ ...defaultBody, ...saved.bodyParams });
        setRawBodyJson(saved.rawBodyJson !== undefined ? saved.rawBodyJson : JSON.stringify(defaultBody, null, 2));
        setCustomHeaders(saved.customHeaders || []);
        setBodyMode(saved.bodyMode || "form");
      } catch (e) {
        console.error("Failed to parse saved inputs", e);
      }
    } else {
      setPathParams(defaultPath);
      setQueryParams(defaultQuery);
      setBodyParams(defaultBody);
      setRawBodyJson(JSON.stringify(defaultBody, null, 2));
      setCustomHeaders([]);
      setBodyMode("form");
    }
  }, [endpointKey, roleConfig.role, endpoint, pathParamNames]);

  // Sync back to local storage on change
  const saveInputsToStorage = (
    updatedPath: Record<string, string>,
    updatedQuery: Record<string, string>,
    updatedBody: Record<string, any>,
    updatedRawBody: string,
    updatedHeaders: Array<{ key: string; val: string }>,
    updatedMode: "form" | "raw"
  ) => {
    const storageKey = `qian_saved_inputs_${roleConfig.role}_${endpointKey}`;
    const dataToSave = {
      pathParams: updatedPath,
      queryParams: updatedQuery,
      bodyParams: updatedBody,
      rawBodyJson: updatedRawBody,
      customHeaders: updatedHeaders,
      bodyMode: updatedMode,
    };
    localStorage.setItem(storageKey, JSON.stringify(dataToSave));
  };

  const handlePathParamChange = (name: string, val: string) => {
    const next = { ...pathParams, [name]: val };
    setPathParams(next);
    saveInputsToStorage(next, queryParams, bodyParams, rawBodyJson, customHeaders, bodyMode);
  };

  const handleQueryParamChange = (name: string, val: string) => {
    const next = { ...queryParams, [name]: val };
    setQueryParams(next);
    saveInputsToStorage(pathParams, next, bodyParams, rawBodyJson, customHeaders, bodyMode);
  };

  const handleBodyParamChange = (name: string, val: any) => {
    const next = { ...bodyParams, [name]: val };
    setBodyParams(next);
    // Sync with raw JSON
    const nextRaw = JSON.stringify(next, null, 2);
    setRawBodyJson(nextRaw);
    saveInputsToStorage(pathParams, queryParams, next, nextRaw, customHeaders, bodyMode);
  };

  const handleRawBodyChange = (rawText: string) => {
    setRawBodyJson(rawText);
    try {
      const parsed = JSON.parse(rawText);
      setBodyParams(parsed);
      saveInputsToStorage(pathParams, queryParams, parsed, rawText, customHeaders, bodyMode);
    } catch (e) {
      // Just save the rawText, don't update object state if layout is invalid
      saveInputsToStorage(pathParams, queryParams, bodyParams, rawText, customHeaders, bodyMode);
    }
  };

  const handleBodyModeToggle = (mode: "form" | "raw") => {
    setBodyMode(mode);
    saveInputsToStorage(pathParams, queryParams, bodyParams, rawBodyJson, customHeaders, mode);
  };

  const addCustomHeader = () => {
    const next = [...customHeaders, { key: "", val: "" }];
    setCustomHeaders(next);
    saveInputsToStorage(pathParams, queryParams, bodyParams, rawBodyJson, next, bodyMode);
  };

  const removeCustomHeader = (idx: number) => {
    const next = customHeaders.filter((_, i) => i !== idx);
    setCustomHeaders(next);
    saveInputsToStorage(pathParams, queryParams, bodyParams, rawBodyJson, next, bodyMode);
  };

  const updateCustomHeader = (idx: number, field: "key" | "val", val: string) => {
    const next = [...customHeaders];
    next[idx] = { ...next[idx], [field]: val };
    setCustomHeaders(next);
    saveInputsToStorage(pathParams, queryParams, bodyParams, rawBodyJson, next, bodyMode);
  };

  // Compile full request and perform trigger
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Replace path parameters (e.g. {id} -> value)
    let processedPath = endpoint.path;
    Object.entries(pathParams).forEach(([pName, pValue]) => {
      processedPath = processedPath.replace(`{${pName}}`, encodeURIComponent(String(pValue) || `{${pName}}`));
    });

    // Build URL with Query string
    const queryParts: string[] = [];
    Object.entries(queryParams).forEach(([qName, qValue]) => {
      if (qValue !== undefined && qValue !== "") {
        queryParts.push(`${encodeURIComponent(qName)}=${encodeURIComponent(String(qValue))}`);
      }
    });

    const fullUrl =
      roleConfig.baseUrl.trim().replace(/\/+$/, "") +
      processedPath +
      (queryParts.length > 0 ? `?${queryParts.join("&")}` : "");

    // Prepare headers
    const headers: Record<string, string> = {
      ...roleConfig.headers,
    };

    // Append custom form headers
    customHeaders.forEach((ch) => {
      if (ch.key.trim() !== "") {
        headers[ch.key.trim()] = ch.val;
      }
    });

    // Prepare body
    let bodyToSend: any = undefined;
    if (["POST", "PUT", "PATCH", "DELETE"].includes(endpoint.method)) {
      if (bodyMode === "raw") {
        try {
          bodyToSend = JSON.parse(rawBodyJson);
        } catch (e) {
          // If invalid JSON, send as raw text string
          bodyToSend = rawBodyJson;
        }
      } else {
        bodyToSend = bodyParams;
      }
    }

    onExecute({
      url: fullUrl,
      method: endpoint.method,
      headers,
      body: bodyToSend,
    });
  };

  const hasBody = ["POST", "PUT", "PATCH", "DELETE"].includes(endpoint.method);

  return (
    <form onSubmit={handleSubmit} className="bg-brand-sidebar border border-slate-800 rounded-xl p-4 sm:p-6 shadow-xl space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 text-xs font-bold rounded border ${
              endpoint.method === "GET" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
              endpoint.method === "POST" ? "bg-sky-500/10 text-sky-400 border-sky-500/20" :
              endpoint.method === "PUT" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
              "bg-rose-500/10 text-rose-400 border-rose-500/20"
            }`}>
              {endpoint.method}
            </span>
            <span className="text-slate-100 font-mono text-xs break-all">{endpoint.path}</span>
          </div>
          <h2 className="text-sm font-semibold text-slate-350 tracking-tight mt-1">
            {endpoint.summary}
          </h2>
        </div>

        <button
          id="btn-execute-simulate"
          type="submit"
          disabled={isLoading}
          className={`flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs py-2 px-5 rounded-lg shadow-md cursor-pointer transition shrink-0 disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <Play className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          {isLoading ? "Memproses..." : "Kirim Permintaan"}
        </button>
      </div>

      {/* Dynamic Path Parameters */}
      {pathParamNames.length > 0 && (
        <div className="space-y-3 bg-brand-bg/40 p-4 border border-slate-800/80 rounded-lg">
          <h3 className="text-xs font-semibold text-indigo-400 flex items-center gap-1.5 uppercase tracking-wider">
            <Code className="w-3.5 h-3.5" /> Path Variables (Parameter Route)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {pathParamNames.map((pName) => {
              const paramSpec = endpoint.parameters.find((sp) => sp.name === pName && sp.in === "path");
              return (
                <div key={pName} className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-400 block font-mono">
                    {pName} <span className="text-red-500">*</span>
                  </label>
                  <input
                    id={`input-path-${pName}`}
                    type="text"
                    required
                    value={pathParams[pName] || ""}
                    onChange={(e) => handlePathParamChange(pName, e.target.value)}
                    placeholder={paramSpec?.description || `Nilai untuk {${pName}}`}
                    className="w-full bg-brand-input border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Query Parameters */}
      {endpoint.parameters.filter((p) => p.in === "query").length > 0 && (
        <div className="space-y-3 bg-brand-bg/40 p-4 border border-slate-800/80 rounded-lg">
          <h3 className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider">
            <Edit2 className="w-3.5 h-3.5" /> Parameter Query url (?key=value)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {endpoint.parameters
              .filter((p) => p.in === "query")
              .map((p) => (
                <div key={p.name} className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-400 block font-mono flex justify-between">
                    <span>
                      {p.name}
                      {p.required && <span className="text-red-500 font-sans ml-1">*</span>}
                    </span>
                    <span className="text-[9px] text-slate-500 italic font-sans">{p.type}</span>
                  </label>
                  
                  {p.enum ? (
                    <select
                      id={`input-query-${p.name}`}
                      value={queryParams[p.name] || ""}
                      onChange={(e) => handleQueryParamChange(p.name, e.target.value)}
                      className="w-full bg-brand-input border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="">-- Pilih Nilai --</option>
                      {p.enum.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={`input-query-${p.name}`}
                      type="text"
                      required={p.required}
                      value={queryParams[p.name] || ""}
                      onChange={(e) => handleQueryParamChange(p.name, e.target.value)}
                      placeholder={p.description || `Parameter ${p.name}`}
                      className="w-full bg-brand-input border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                    />
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Custom Header Injection block */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Custom Header Tambahan ({customHeaders.length})
          </h3>
          <button
            type="button"
            onClick={addCustomHeader}
            className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer font-semibold"
          >
            <Plus className="w-3 h-3" /> Tambah Header
          </button>
        </div>

        {customHeaders.length > 0 && (
          <div className="space-y-2 max-h-40 overflow-y-auto bg-brand-bg/25 p-2 rounded-lg border border-slate-800">
            {customHeaders.map((header, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <input
                  type="text"
                  placeholder="Key (e.g. x-custom-device)"
                  value={header.key}
                  onChange={(e) => updateCustomHeader(idx, "key", e.target.value)}
                  className="flex-1 bg-brand-input border border-slate-705 rounded px-2 py-1 text-xs text-slate-200 focus:ring-1 focus:ring-indigo-500 font-mono"
                />
                <input
                  type="text"
                  placeholder="Value"
                  value={header.val}
                  onChange={(e) => updateCustomHeader(idx, "val", e.target.value)}
                  className="flex-1 bg-brand-input border border-slate-705 rounded px-2 py-1 text-xs text-slate-200 focus:ring-1 focus:ring-indigo-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => removeCustomHeader(idx)}
                  className="p-1 text-rose-400 hover:text-rose-300 transition shrink-0 hover:bg-rose-500/10 rounded cursor-pointer"
                  title="Hapus"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* JSON Payload Body Builder */}
      {hasBody && (
        <div className="space-y-3 bg-brand-bg/40 p-4 border border-slate-800/80 rounded-lg">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/65">
            <h3 className="text-xs font-semibold text-indigo-400 flex items-center gap-1.5 uppercase tracking-wider">
              <FileJson className="w-3.5 h-3.5" /> Request Body (Payload JSON)
            </h3>
            <div className="flex bg-brand-bg p-0.5 rounded border border-slate-800">
              <button
                type="button"
                onClick={() => handleBodyModeToggle("form")}
                className={`px-3 py-1 text-[10px] font-semibold rounded cursor-pointer transition ${
                  bodyMode === "form" ? "bg-brand-sidebar text-indigo-400" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Formulir
              </button>
              <button
                type="button"
                onClick={() => handleBodyModeToggle("raw")}
                className={`px-3 py-1 text-[10px] font-semibold rounded cursor-pointer transition ${
                  bodyMode === "raw" ? "bg-brand-sidebar text-indigo-400" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Raw JSON
              </button>
            </div>
          </div>

          {bodyMode === "form" && endpoint.requestBody?.properties ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Object.entries(endpoint.requestBody.properties).map(([bName, bSpec]) => (
                <div key={bName} className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-400 block font-mono flex justify-between">
                    <span>
                      {bName}
                      {bSpec.required && <span className="text-red-500 ml-1 font-sans">*</span>}
                    </span>
                    <span className="text-[9px] text-slate-500 italic font-sans">
                      {bSpec.type}
                      {bSpec.nullable && "? (null)"}
                    </span>
                  </label>

                  {bSpec.enum ? (
                    <select
                      id={`input-body-${bName}`}
                      value={bodyParams[bName] || ""}
                      onChange={(e) => handleBodyParamChange(bName, e.target.value)}
                      className="w-full bg-brand-input border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none"
                    >
                      <option value="">-- Pilih Nilai --</option>
                      {bSpec.enum.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  ) : bSpec.type === "boolean" ? (
                    <select
                      id={`input-body-${bName}`}
                      value={bodyParams[bName] !== undefined ? String(bodyParams[bName]) : "true"}
                      onChange={(e) => handleBodyParamChange(bName, e.target.value === "true")}
                      className="w-full bg-brand-input border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none"
                    >
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                  ) : bSpec.type === "number" || bSpec.type === "integer" ? (
                    <input
                      id={`input-body-${bName}`}
                      type="number"
                      required={bSpec.required}
                      min={bSpec.minimum}
                      value={bodyParams[bName] !== undefined ? bodyParams[bName] : ""}
                      onChange={(e) => handleBodyParamChange(bName, e.target.value === "" ? 0 : Number(e.target.value))}
                      className="w-full bg-brand-input border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 font-mono focus:ring-1 focus:ring-indigo-500"
                    />
                  ) : (
                    <input
                      id={`input-body-${bName}`}
                      type="text"
                      required={bSpec.required}
                      value={bodyParams[bName] !== undefined ? bodyParams[bName] : ""}
                      onChange={(e) => handleBodyParamChange(bName, e.target.value)}
                      placeholder={bSpec.description || `Masukkan ${bName}`}
                      className="w-full bg-brand-input border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 font-mono focus:ring-1 focus:ring-indigo-500"
                    />
                  )}
                </div>
              ))}
            </div>
          ) : bodyMode === "form" ? (
            <div className="text-center p-4 bg-brand-bg rounded border border-indigo-500/10 text-slate-500">
              <AlertCircle className="w-5 h-5 mx-auto text-indigo-400 mb-1" />
              <p className="text-[10px]">Endpoint ini menerima JSON tetapi spesifikasi tidak mendetailkan skema.</p>
              <button
                type="button"
                onClick={() => handleBodyModeToggle("raw")}
                className="mt-1.5 text-[10px] text-indigo-400 hover:underline cursor-pointer"
              >
                Gunakan editor Raw JSON
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex justify-between items-center bg-brand-bg px-2 py-1 rounded-t border-t border-x border-slate-800">
                <span className="text-[10px] text-slate-500 font-sans">Editor JSON Raw</span>
                {(() => {
                  try {
                    JSON.parse(rawBodyJson);
                    return <span className="text-[9px] text-emerald-400 font-sans">Valid JSON</span>;
                  } catch (e) {
                    return <span className="text-[9px] text-rose-400 font-sans font-medium">Invalid JSON Format</span>;
                  }
                })()}
              </div>
              <textarea
                id="raw-json-textarea"
                value={rawBodyJson}
                onChange={(e) => handleRawBodyChange(e.target.value)}
                rows={8}
                placeholder={'{\n  "key": "value"\n}'}
                className="w-full bg-brand-input border border-slate-700 rounded-b px-3 py-2 text-xs font-mono text-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          )}
        </div>
      )}
    </form>
  );
}
