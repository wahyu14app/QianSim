import React, { useState } from "react";
import { Clock, Layers, Copy, Check, FileJson, Info, AlertOctagon, Terminal } from "lucide-react";
import { ResponseLog } from "../types";

interface ResponseCodeHistoryProps {
  logsForEndpoint: Record<number, ResponseLog>;
  onClearLogs: () => void;
}

export default function ResponseCodeHistory({
  logsForEndpoint,
  onClearLogs,
}: ResponseCodeHistoryProps) {
  const codes = Object.keys(logsForEndpoint)
    .map(Number)
    .sort((a, b) => {
      const timeA = new Date(logsForEndpoint[a].timestamp).getTime();
      const timeB = new Date(logsForEndpoint[b].timestamp).getTime();
      return timeB - timeA;
    });

  const [activeCode, setActiveCode] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"body" | "headers" | "request">("body");

  // Keep active code synced with available codes
  React.useEffect(() => {
    if (codes.length > 0) {
      if (!activeCode || !codes.includes(activeCode)) {
        setActiveCode(codes[0]);
      }
    } else {
      setActiveCode(null);
    }
  }, [logsForEndpoint, codes]);

  const activeLog = activeCode ? logsForEndpoint[activeCode] : null;

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) {
      return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    }
    if (status >= 400 && status < 500) {
      return "text-orange-400 bg-orange-500/10 border-orange-500/20";
    }
    if (status >= 500) {
      return "text-rose-400 bg-rose-500/10 border-rose-500/20";
    }
    return "text-slate-400 bg-slate-500/10 border-slate-500/20";
  };

  const handleCopy = (text: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      // Fallback
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="bg-brand-sidebar border border-slate-800 rounded-xl p-4 sm:p-6 shadow-xl flex flex-col h-auto min-h-[500px] lg:h-[650px]">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-100 tracking-tight">
              Snapshot Respon per Kode HTTP
            </h2>
            <p className="text-xs text-slate-400">
              Menyimpan respon terbaru untuk setiap kode HTTP yang berbeda
            </p>
          </div>
        </div>

        {codes.length > 0 && (
          <button
            id="btn-clear-code-logs"
            onClick={onClearLogs}
            className="text-[11px] text-rose-400 hover:text-rose-300 transition hover:underline cursor-pointer"
          >
            Bersihkan Histori
          </button>
        )}
      </div>

      {codes.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-500">
          <Terminal className="w-12 h-12 text-slate-700 mb-3 animate-pulse" />
          <h4 className="text-xs font-semibold text-slate-400">Belum ada respon terekam</h4>
          <p className="text-[11px] text-slate-500 mt-1 max-w-sm">
            Kirim permintaan simulasi pertama Anda. Setiap kode status unik yang kembali akan diarsipkan di sini secara real-time.
          </p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col lg:flex-row gap-5 min-h-0">
          {/* Status Code Sidebar tabs selector */}
          <div className="lg:w-32 flex lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 shrink-0 select-none">
            {codes.map((code) => {
              const isActive = activeCode === code;
              const logItem = logsForEndpoint[code];
              return (
                <button
                  id={`btn-log-code-${code}`}
                  key={code}
                  onClick={() => {
                    setActiveCode(code);
                    setActiveTab("body");
                  }}
                  className={`px-3 py-2.5 rounded-lg border text-left transition text-xs shrink-0 cursor-pointer flex lg:flex-col justify-between items-center lg:items-start gap-1 ${
                    isActive
                      ? "bg-slate-800 border-indigo-500/50 text-white shadow-lg shadow-indigo-500/5"
                      : "bg-brand-bg/60 border-slate-800 text-slate-400 hover:bg-brand-bg/30"
                  }`}
                >
                  <span className={`px-2 py-0.5 text-xs font-bold rounded ${getStatusColor(code)}`}>
                    {code}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-1 font-mono shrink-0">
                    {logItem?.durationMs} ms
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active Log View Details */}
          {activeLog && (
            <div className="flex-1 flex flex-col bg-brand-bg border border-slate-800 rounded-xl overflow-hidden min-h-0">
              {/* Header inside detail block */}
              <div className="px-4 py-3 bg-brand-sidebar border-b border-slate-800 flex items-center justify-between flex-wrap gap-2 text-xs">
                <div className="flex items-center gap-3">
                  <span className={`font-mono text-[11px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded border ${getStatusColor(activeLog.status)}`}>
                    {activeLog.status} {activeLog.statusText || ""}
                  </span>
                  <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3 text-slate-500" /> {new Date(activeLog.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                <div className="flex flex-nowrap overflow-x-auto scrollbar-none bg-brand-bg p-0.5 rounded border border-slate-800 shrink-0">
                  {(["body", "headers", "request"] as const).map((tab) => (
                    <button
                      id={`tab-log-${tab}`}
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-3 py-1 text-[10px] font-bold rounded capitalize cursor-pointer transition whitespace-nowrap ${
                        activeTab === tab ? "bg-slate-850 text-indigo-400 font-semibold" : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {tab === "request" ? "Permintaan" : tab === "body" ? "Konten Respon" : "Header"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Detail Content Section */}
              <div className="flex-1 p-4 overflow-y-auto min-h-0 font-mono text-[11px] relative">
                {activeTab === "body" && (
                  <div className="h-full flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] text-slate-500 flex items-center gap-1 font-sans">
                        <FileJson className="w-3.5 h-3.5" /> Payload Konten Terbaca
                      </span>
                      <button
                        id="btn-copy-response-body"
                        type="button"
                        onClick={() => handleCopy(JSON.stringify(activeLog.body, null, 2))}
                        className="text-[10px] bg-brand-sidebar text-slate-400 border border-slate-850 hover:text-slate-200 px-2 py-1 rounded cursor-pointer transition flex items-center gap-1 font-sans"
                      >
                        {copied ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Tersalin!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Salin Body</span>
                          </>
                        )}
                      </button>
                    </div>

                    <pre className="flex-1 bg-brand-sidebar/40 border border-slate-800/60 p-3 rounded-lg text-emerald-300 overflow-auto max-h-[400px] leading-relaxed select-text font-mono">
                      {typeof activeLog.body === "object"
                        ? JSON.stringify(activeLog.body, null, 2)
                        : String(activeLog.body || "No response body returned from simulate server.")}
                    </pre>
                  </div>
                )}

                {activeTab === "headers" && (
                  <div className="space-y-3">
                    <span className="text-[10px] text-slate-500 flex items-center gap-1 font-sans mb-2">
                      <Info className="w-3.5 h-3.5" /> Metadata Response Headers
                    </span>
                    <div className="border border-slate-850 rounded-lg overflow-hidden">
                      <table className="w-full text-left font-mono text-xs text-slate-300">
                        <thead>
                          <tr className="bg-brand-sidebar text-[10px] text-slate-500 uppercase font-sans border-b border-slate-850">
                            <th className="px-3 py-2">Nama Header</th>
                            <th className="px-3 py-2">Nilai</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/40">
                          {Object.entries(activeLog.headers).map(([k, v]) => (
                            <tr key={k} className="hover:bg-slate-905/20">
                              <td className="px-3 py-2 text-indigo-400 font-semibold break-all border-r border-slate-850">{k}</td>
                              <td className="px-3 py-2 break-all text-slate-300">{v}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {activeTab === "request" && (
                  <div className="space-y-4">
                    {/* URL Route Path */}
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 font-sans block">Alamat Target</span>
                      <div className="bg-brand-sidebar px-3 py-2 rounded-lg border border-slate-850 flex items-center justify-between gap-2">
                        <span className="text-slate-300 font-bold break-all">{activeLog.requestSent.url}</span>
                        <span className="px-1.5 py-0.5 rounded bg-brand-bg text-[10.5px] text-slate-400 border border-slate-850 shrink-0">{activeLog.requestSent.method}</span>
                      </div>
                    </div>

                    {/* Headers Sent */}
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 font-sans block">HTTP Header Terkirim</span>
                      <div className="bg-brand-sidebar/40 border border-slate-800 p-3 rounded-lg overflow-auto">
                        <table className="w-full text-left text-[11px] text-slate-300">
                          <tbody>
                            {Object.entries(activeLog.requestSent.headers).map(([k, v]) => (
                              <tr key={k}>
                                <td className="text-slate-400 py-1 pr-4 font-semibold shrink-0 select-none">{k}:</td>
                                <td className="text-amber-350 py-1 break-all">
                                  {k.toLowerCase() === "authorization" || k.toLowerCase().includes("key") ? "••••••••••••••••" : v}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Request Payload Sent */}
                    {activeLog.requestSent.body && (
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-500 font-sans block">Payload Body Terkirim</span>
                        <pre className="bg-brand-sidebar/40 border border-slate-800 p-3 rounded-lg text-slate-350 overflow-auto max-h-[180px] font-mono">
                          {typeof activeLog.requestSent.body === "object"
                            ? JSON.stringify(activeLog.requestSent.body, null, 2)
                            : String(activeLog.requestSent.body)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
