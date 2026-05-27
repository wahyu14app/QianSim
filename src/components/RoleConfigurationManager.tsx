import React from "react";
import { Key, Shield, Globe, HardDrive, RefreshCw } from "lucide-react";
import { RoleConfig } from "../types";

interface RoleConfigurationManagerProps {
  currentRole: string;
  config: RoleConfig;
  onConfigChange: (updated: RoleConfig) => void;
  onReset: () => void;
}

export default function RoleConfigurationManager({
  currentRole,
  config,
  onConfigChange,
  onReset,
}: RoleConfigurationManagerProps) {
  const handleFieldChange = (key: keyof typeof config.headers | "baseUrl", value: string) => {
    if (key === "baseUrl") {
      onConfigChange({
        ...config,
        baseUrl: value,
      });
    } else {
      onConfigChange({
        ...config,
        headers: {
          ...config.headers,
          [key]: value,
        },
      });
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-rose-500/10 text-rose-400 border-rose-500/20";
      case "seller":
        return "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
      case "store":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      default:
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    }
  };

  return (
    <div className="bg-brand-sidebar border border-slate-800 rounded-xl p-4 sm:p-6 shadow-xl backdrop-blur-sm self-start w-full">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-100 tracking-tight">
              Konfigurasi Role
            </h2>
            <p className="text-xs text-slate-400">
              Setiap role memiliki konfigurasi & token berbeda secara terpisah
            </p>
          </div>
        </div>

        <span className={`px-2.5 py-0.5 text-xs font-mono rounded-full border ${getRoleBadgeColor(currentRole)} capitalize`}>
          {currentRole}
        </span>
      </div>

      <div className="space-y-4">
        {/* Base URL */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-slate-500" />
            Base API Target URL (Simulasi)
          </label>
          <input
            id="cfg-base-url"
            type="url"
            value={config.baseUrl}
            onChange={(e) => handleFieldChange("baseUrl", e.target.value)}
            className="w-full bg-brand-input border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono transition"
            placeholder="e.g. https://qianpulsa-coreapi-v1.onrender.com"
          />
        </div>

        {/* Authorization Bearer JWT */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-slate-500" />
            Authorization Header (Bearer Token)
          </label>
          <div className="relative">
            <input
              id="cfg-token"
              type="text"
              value={config.headers["Authorization"] || ""}
              onChange={(e) => handleFieldChange("Authorization", e.target.value)}
              className="w-full bg-brand-input border border-slate-700 rounded-lg pl-3 pr-24 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono transition"
              placeholder="eyJhbGciOiJIUzI1NiIsIn..."
            />
            {config.headers["Authorization"] && !config.headers["Authorization"].startsWith("Bearer ") && (
              <button
                type="button"
                onClick={() => {
                  const val = config.headers["Authorization"];
                  if (val && !val.startsWith("Bearer ")) {
                    handleFieldChange("Authorization", `Bearer ${val}`);
                  }
                }}
                className="absolute right-2 top-1.5 text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 px-1.5 py-0.5 rounded cursor-pointer transition font-sans"
              >
                Fix Bearer
              </button>
            )}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            Token akan otomatis dikirimkan ke rute terproteksi rujukan role ini.
          </p>
        </div>

        {/* x-app-client-key */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-slate-500" />
            Client API Key Header (<span className="font-mono">x-app-client-key</span>)
          </label>
          <input
            id="cfg-client-key"
            type="password"
            value={config.headers["x-app-client-key"] || ""}
            onChange={(e) => handleFieldChange("x-app-client-key", e.target.value)}
            className="w-full bg-brand-input border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono transition"
            placeholder="Kunci klien rahasia internal..."
          />
        </div>

        {/* x-app-origin */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-slate-500" />
            Origin Identity Header (<span className="font-mono">x-app-origin</span>)
          </label>
          <select
            id="cfg-app-origin"
            value={config.headers["x-app-origin"] || currentRole}
            onChange={(e) => handleFieldChange("x-app-origin", e.target.value)}
            className="w-full bg-brand-input border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition cursor-pointer"
          >
            <option value="admin">admin</option>
            <option value="seller">seller</option>
            <option value="store">store</option>
            <option value="customer">customer</option>
          </select>
        </div>

        <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
          <span className="text-[10px] text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Tersimpan otomatis ke LocalStorage
          </span>
          <button
            id="btn-reset-config"
            type="button"
            onClick={onReset}
            className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1 hover:underline cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            Reset Ulang
          </button>
        </div>
      </div>
    </div>
  );
}
