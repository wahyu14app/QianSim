import React, { useState, useMemo } from "react";
import { Search, Hash, Lock, Globe, HelpCircle } from "lucide-react";
import { ApiEndpoint } from "../types";
import { getRoleFromPath } from "../utils";

interface EndpointListProps {
  endpoints: ApiEndpoint[];
  selectedEndpoint: ApiEndpoint | null;
  onSelectEndpoint: (endpoint: ApiEndpoint) => void;
  activeRoleFilter: string;
  setActiveRoleFilter: (role: string) => void;
}

export default function EndpointList({
  endpoints,
  selectedEndpoint,
  onSelectEndpoint,
  activeRoleFilter,
  setActiveRoleFilter,
}: EndpointListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string>("All Tags");

  // Get unique tags for advanced filter
  const allTags = useMemo(() => {
    const tagsSet = new Set<string>();
    endpoints.forEach((ep) => {
      ep.tags.forEach((t) => tagsSet.add(t));
    });
    return ["All Tags", ...Array.from(tagsSet).sort()];
  }, [endpoints]);

  // Filter endpoints according to search query, role selection, and tag selection
  const filteredEndpoints = useMemo(() => {
    return endpoints.filter((ep) => {
      const epRole = getRoleFromPath(ep.path);
      
      // Role match
      if (activeRoleFilter !== "all" && epRole !== activeRoleFilter) {
        return false;
      }

      // Tag match
      if (selectedTag !== "All Tags" && !ep.tags.includes(selectedTag)) {
        return false;
      }

      // Search match
      if (searchQuery.trim() !== "") {
        const query = searchQuery.toLowerCase();
        const pathMatch = ep.path.toLowerCase().includes(query);
        const summaryMatch = ep.summary.toLowerCase().includes(query);
        const tagMatch = ep.tags.some((t) => t.toLowerCase().includes(query));
        return pathMatch || summaryMatch || tagMatch;
      }

      return true;
    });
  }, [endpoints, activeRoleFilter, selectedTag, searchQuery]);

  const getMethodStyle = (method: string) => {
    switch (method.toUpperCase()) {
      case "GET":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "POST":
        return "bg-sky-500/10 text-sky-400 border-sky-500/20";
      case "PUT":
        return "bg-amber-500/10 text-amber-400 border-amber-550/20";
      case "DELETE":
        return "bg-rose-500/10 text-rose-400 border-rose-500/20";
      case "PATCH":
        return "bg-purple-500/10 text-purple-400 border-purple-550/20";
      default:
        return "bg-slate-500/10 text-slate-400 border-slate-500/20";
    }
  };

  return (
    <div className="bg-brand-sidebar border border-slate-800 rounded-xl flex flex-col h-full shadow-xl overflow-hidden">
      {/* Header Info */}
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center gap-2 mb-3">
          <Globe className="w-4 h-4 text-indigo-400 animate-pulse" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Daftar API Terdeteksi ({endpoints.length})
          </h3>
        </div>

        {/* Role Tabs */}
        <div className="flex overflow-x-auto whitespace-nowrap scrollbar-none gap-1 bg-brand-bg p-1 rounded-lg border border-slate-800/60 mb-3">
          {(["all", "admin", "seller", "store", "other"] as const).map((role) => (
            <button
              id={`tab-role-${role}`}
              key={role}
              onClick={() => {
                setActiveRoleFilter(role);
                setSelectedTag("All Tags"); // reset tags
              }}
              className={`flex-1 min-w-[65px] py-1.5 text-center text-xs rounded font-medium capitalize transition cursor-pointer ${
                activeRoleFilter === role
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-brand-sidebar/40"
              }`}
            >
              {role === "all" ? "semua" : role}
            </button>
          ))}
        </div>

        {/* Search & Tags row */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-500" />
            <input
              id="endpoint-search"
              type="text"
              placeholder="Cari rute/kata kunci..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-brand-bg border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
            />
          </div>

          <div className="flex items-center gap-1.5 sm:w-32 shrink-0">
            <select
              id="tag-filter"
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              className="w-full bg-brand-bg border border-slate-700 rounded px-2 py-2 text-[11px] text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              {allTags.map((t) => (
                <option key={t} value={t}>
                  {t === "All Tags" ? "Semua Tag" : t}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Endpoint List Body */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40 p-2 space-y-1">
        {filteredEndpoints.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500 mt-10">
            <HelpCircle className="w-8 h-8 text-slate-600 mb-2 animate-bounce" />
            <p className="text-xs">Tidak ada endpoint yang cocok.</p>
            <p className="text-[10px] text-slate-600 mt-1">Coba kata kunci lain atau bersihkan filter.</p>
          </div>
        ) : (
          filteredEndpoints.map((ep) => {
            const isSelected =
              selectedEndpoint?.path === ep.path &&
              selectedEndpoint?.method === ep.method;
            const key = `${ep.method}:${ep.path}`;

            return (
              <button
                id={`btn-endpoint-${ep.method}-${ep.path.replace(/\//g, "-")}`}
                key={key}
                onClick={() => onSelectEndpoint(ep)}
                className={`w-full text-left p-2.5 rounded-lg flex flex-col gap-1 transition cursor-pointer text-xs ${
                  isSelected
                    ? "bg-slate-800 border-l-4 border-l-indigo-500 text-white"
                    : "hover:bg-slate-800/50 text-slate-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${getMethodStyle(
                      ep.method
                    )}`}
                  >
                    {ep.method}
                  </span>
                  <span className="font-mono text-[11px] tracking-tight break-all truncate block flex-1">
                    {ep.path}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1 text-[10px]">
                  <span className="text-slate-400 truncate max-w-[170px]">
                    {ep.summary}
                  </span>
                  
                  {/* Indicators */}
                  <div className="flex items-center gap-1.5 ml-2 shrink-0">
                    {ep.securedBy.length > 0 && (
                      <span className="text-slate-500 flex items-center" title={`Protected by: ${ep.securedBy.join(", ")}`}>
                        <Lock className="w-2.5 h-2.5 text-amber-500/80" />
                      </span>
                    )}
                    <span className="bg-brand-bg px-1 py-0.5 text-[9px] text-slate-500 rounded border border-slate-800/80 font-sans uppercase">
                      {getRoleFromPath(ep.path)}
                    </span>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
