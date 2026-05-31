import React, { useState } from "react";
import { Key, Shield, Globe, HardDrive, RefreshCw, LogIn, CheckCircle2, AlertCircle } from "lucide-react";
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
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginMsg, setLoginMsg] = useState("");
  const [loginError, setLoginError] = useState("");

  const email = config.credentials?.email || "";
  const password = config.credentials?.password || "";
  const otpCode = config.credentials?.otpCode || "";

  const handleCredentialChange = (key: "email" | "password" | "otpCode", value: string) => {
    onConfigChange({
      ...config,
      credentials: {
        ...(config.credentials || {}),
        [key]: value,
      },
    });
  };

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

  const handleAutoLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginMsg("");
    setLoginError("");
    setIsLoggingIn(true);

    try {
      let endpointRole = currentRole;
      if (endpointRole === "other") {
        endpointRole = "store";
      }
      
      const url = `${config.baseUrl}/api/v1/${endpointRole}/auth/login`;
      
      const payload: any = { email, password };
      if (otpCode.trim()) {
        payload.otpCode = otpCode;
      }

      let data;
      const isStaticOrWebView =
        window.location.protocol === "file:" ||
        window.location.hostname.includes("github.io") ||
        window.location.hostname.includes("vercel.app") ||
        window.location.hostname.includes("github") ||
        window.location.hostname.includes("run.app");

      if (isStaticOrWebView) {
        // Direct request
        const resp = await fetch(url, {
          method: "POST",
          headers: { ...config.headers, "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const text = await resp.text();
        let bodyParsed;
        try { bodyParsed = JSON.parse(text); } catch { bodyParsed = text; }
        data = {
          status: resp.status,
          statusText: resp.statusText,
          body: bodyParsed
        };
      } else {
        const fetchOptions = {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url,
            method: "POST",
            headers: { ...config.headers, "Content-Type": "application/json" },
            body: payload
          })
        };
        const resp = await fetch("/api/proxy-request", fetchOptions);
        data = await resp.json();
      }
      
      if (data.status >= 200 && data.status < 300) {
        let token = "";
        if (data.body?.data?.token) token = data.body.data.token;
        else if (data.body?.token) token = data.body.token;
        else if (data.body?.data?.accessToken) token = data.body.data.accessToken;

        let message = data.body?.message || "Login berhasil! Token otomatis terisi.";
        
        if (token) {
          handleFieldChange("Authorization", `Bearer ${token}`);
          setLoginMsg(message);
        } else if (data.body?.data?.requiresOtp || !otpCode.trim()) {
          setLoginMsg(data.body?.message || "OTP telah dikirim. Masukkan kode OTP untuk melanjutkan.");
        } else {
          setLoginError("Respon berstatus sukses namun struktur token tidak dikenali.");
        }
      } else {
        setLoginError(`Gagal (${data.status}): ${data.body?.message || JSON.stringify(data.body || data.statusText)}`);
      }
    } catch (err: any) {
      setLoginError(`Koneksi Gagal: ${err.message}`);
    } finally {
      setIsLoggingIn(false);
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
    <div className="flex flex-col gap-4">
      <div className="bg-brand-sidebar border border-slate-900 rounded-xl p-4 shadow-xl w-full">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100 tracking-tight">
                Konfigurasi Token Statis
              </h2>
              <p className="text-[10px] sm:text-xs text-slate-400">
                Atur secara manual header & base URL untuk role ini
              </p>
            </div>
          </div>

          <span className={`px-2 py-0.5 text-[10px] sm:text-xs font-mono rounded border ${getRoleBadgeColor(currentRole)} capitalize`}>
            {currentRole}
          </span>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-[11px] sm:text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-slate-500" />
              Base API Target URL (Simulasi)
            </label>
            <input
              id="cfg-base-url"
              type="url"
              value={config.baseUrl}
              onChange={(e) => handleFieldChange("baseUrl", e.target.value)}
              className="w-full bg-brand-input border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono transition"
              placeholder="e.g. https://qianpulsa-coreapi-v1.onrender.com"
            />
          </div>

          <div>
            <label className="block text-[11px] sm:text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-slate-500" />
              Authorization Header (Bearer Token)
            </label>
            <div className="relative">
              <input
                id="cfg-token"
                type="text"
                value={config.headers["Authorization"] || ""}
                onChange={(e) => handleFieldChange("Authorization", e.target.value)}
                className="w-full bg-brand-input border border-slate-800 rounded-lg pl-3 pr-24 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono transition"
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
          </div>

          <div>
            <label className="block text-[11px] sm:text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-slate-500" />
              Client API Key Header (<span className="font-mono">x-app-client-key</span>)
            </label>
            <input
              id="cfg-client-key"
              type="password"
              value={config.headers["x-app-client-key"] || ""}
              onChange={(e) => handleFieldChange("x-app-client-key", e.target.value)}
              className="w-full bg-brand-input border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono transition"
              placeholder="Kunci klien rahasia internal..."
            />
          </div>

          <div>
            <label className="block text-[11px] sm:text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-slate-500" />
              Origin Identity Header (<span className="font-mono">x-app-origin</span>)
            </label>
            <select
              id="cfg-app-origin"
              value={config.headers["x-app-origin"] || currentRole}
              onChange={(e) => handleFieldChange("x-app-origin", e.target.value)}
              className="w-full bg-brand-input border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition cursor-pointer"
            >
              <option value="admin">admin</option>
              <option value="seller">seller</option>
              <option value="store">store</option>
            </select>
          </div>

          <div className="pt-3 border-t border-slate-900 flex justify-between items-center mt-2">
            <span className="text-[10px] text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Tersimpan otomatis ke Local Storage
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

      {!["public", "webhook"].includes(currentRole) && (
        <div className="bg-brand-sidebar border border-slate-900 rounded-xl p-4 shadow-xl w-full">
           <div className="flex items-center gap-3 mb-5">
              <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                <LogIn className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-100 tracking-tight">
                  Auto-Login (Suntik Token Cepat)
                </h2>
                <p className="text-[10px] sm:text-xs text-slate-400 mt-1 max-w-sm">
                  Cobalah login menggunakan kredensial {currentRole}. Kosongkan OTP Code pada upaya pertama untuk memicu kode OTP.
                </p>
              </div>
            </div>
            
            <form onSubmit={handleAutoLogin} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] sm:text-xs font-medium text-slate-400 mb-1.5">Email / No. HP</label>
                  <input
                    type="text"
                    required
                    value={email}
                    onChange={(e) => handleCredentialChange("email", e.target.value)}
                    className="w-full bg-brand-input border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder={`user@${currentRole}.com`}
                  />
                </div>
                <div>
                  <label className="block text-[11px] sm:text-xs font-medium text-slate-400 mb-1.5">Kata Sandi</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => handleCredentialChange("password", e.target.value)}
                    className="w-full bg-brand-input border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="**********"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] sm:text-xs font-medium text-slate-400 mb-1.5">OTP Code (Opsional)</label>
                <input
                  type="text"
                  value={otpCode}
                  onChange={(e) => handleCredentialChange("otpCode", e.target.value)}
                  className="w-full sm:w-1/2 bg-brand-input border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono tracking-widest text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="000000"
                  maxLength={6}
                />
                <p className="text-[10px] text-slate-500 mt-1.5">Kosongkan jika sistem memerlukan permintaan OTP baru saat submit.</p>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="bg-indigo-600 hover:bg-slate-700 text-white font-semibold text-xs py-2 px-6 rounded-lg shadow-md cursor-pointer transition disabled:opacity-50 flex items-center gap-2"
                >
                  {isLoggingIn ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Memproses...
                    </>
                  ) : (
                    <>
                      <Key className="w-3.5 h-3.5" />
                      Coba Login {currentRole}
                    </>
                  )}
                </button>
              </div>

              {loginMsg && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center gap-2 text-xs text-emerald-400 leading-relaxed mt-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  {loginMsg}
                </div>
              )}

              {loginError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg flex items-center gap-2 text-xs text-rose-400 leading-relaxed mt-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="break-all">{loginError}</span>
                </div>
              )}
            </form>
        </div>
      )}

    </div>
  );
}

