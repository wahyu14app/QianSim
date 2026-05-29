import React, { useState, useEffect } from "react";
import {
  Play,
  Shield,
  Terminal,
  RefreshCw,
  AlertCircle,
  Sparkles,
  Key,
  HelpCircle,
  Database,
  CheckCircle,
  Upload,
  Eye,
  FileText,
  Smartphone,
  HardDrive,
  Menu,
  X,
  Activity,
  FolderOpen
} from "lucide-react";
import {
  ApiEndpoint,
  RoleConfig,
  ResponseLog,
  ResponseCodeLogs,
} from "./types";
import { getRoleFromPath, parseOpenApi } from "./utils";
import RoleConfigurationManager from "./components/RoleConfigurationManager";
import EndpointList from "./components/EndpointList";
import ProxyRequestForm from "./components/ProxyRequestForm";
import ResponseCodeHistory from "./components/ResponseCodeHistory";
import AutoRunnerPanel from "./components/AutoRunnerPanel";
import { getWorkspaceHandle, saveWorkspaceHandle, clearWorkspaceHandle, verifyWorkspacePermission } from "./lib/WorkspaceDB";
import { readWorkspaceConfig, writeWorkspaceConfig, readWorkspaceResponses, writeWorkspaceResponse, clearWorkspaceResponses } from "./lib/WorkspaceIO";

// Update ROLES based on request
export const ROLES = ["admin", "seller", "store", "public", "webhook"];

// Static fallback specs harvested from QianPulsa OpenAPI JSON to ensure instant availability
const FALLBACK_SPEC = {
  paths: {
    "/api/v1/admin/auth/login": {
      post: {
        summary: "Admin Login",
        tags: ["Admin Auth"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string", minLength: 1 },
                  otpCode: { type: "string" },
                },
                required: ["email", "password"],
              },
            },
          },
        },
        responses: { "200": { description: "Default Response" } },
      },
    },
    "/api/v1/admin/auth/me": {
      get: {
        summary: "Dapatkan Profil Admin",
        tags: ["Admin Auth"],
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Default Response" } },
      },
    },
    "/api/v1/admin/catalog/products": {
      get: {
        summary: "Dapatkan Produk Katalog",
        tags: ["Admin Catalog"],
        parameters: [
          {
            name: "skip",
            in: "query",
            schema: { type: "string", default: "0" },
          },
          {
            name: "take",
            in: "query",
            schema: { type: "string", default: "50" },
          },
        ],
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Default Response" } },
      },
      post: {
        summary: "Buat Produk Baru",
        tags: ["Admin Catalog"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  brandId: { type: "string", format: "uuid" },
                  categoryId: { type: "string", format: "uuid" },
                  productCode: { type: "string", minLength: 1 },
                  name: { type: "string", minLength: 1 },
                  basePrice: { type: "number", minimum: 0 },
                  isAvailable: { type: "boolean" },
                },
                required: [
                  "brandId",
                  "categoryId",
                  "productCode",
                  "name",
                  "basePrice",
                ],
              },
            },
          },
        },
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Default Response" } },
      },
    },
    "/api/v1/seller/auth/login": {
      post: {
        summary: "Login Seller",
        tags: ["Seller Auth"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string", minLength: 1 },
                  otpCode: { type: "string" },
                },
                required: ["email", "password"],
              },
            },
          },
        },
        responses: { "200": { description: "Default Response" } },
      },
    },
    "/api/v1/seller/stores": {
      get: {
        summary: "Get My Stores",
        tags: ["Seller Stores"],
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Default Response" } },
      },
      post: {
        summary: "Create Store",
        tags: ["Seller Stores"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string", minLength: 3 },
                  slug: { type: "string", minLength: 3 },
                  domain: { type: "string" },
                },
                required: ["name", "slug"],
              },
            },
          },
        },
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Default Response" } },
      },
    },
    "/api/v1/seller/billing/deposit": {
      post: {
        summary: "Create Deposit Request",
        tags: ["Seller Billing"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  amount: { type: "number", minimum: 10000 },
                },
                required: ["amount"],
              },
            },
          },
        },
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Default Response" } },
      },
    },
    "/api/v1/store/profile": {
      get: {
        summary: "Cek Profil Toko & Saldo",
        tags: ["Store Profile"],
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Default Response" } },
      },
    },
    "/api/v1/store/catalog": {
      get: {
        summary: "Ambil Katalog Produk Toko",
        tags: ["Store Catalog"],
        parameters: [
          {
            name: "skip",
            in: "query",
            schema: { type: "string", default: "0" },
          },
          {
            name: "take",
            in: "query",
            schema: { type: "string", default: "20" },
          },
        ],
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Default Response" } },
      },
    },
    "/api/v1/store/transactions/checkout": {
      post: {
        summary: "Kirim Transaksi Topup (Checkout)",
        tags: ["Store Transactions"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  productCode: { type: "string", minLength: 1 },
                  targetNumber: { type: "string", minLength: 10 },
                  externalId: { type: "string", minLength: 1 },
                },
                required: ["productCode", "targetNumber", "externalId"],
              },
            },
          },
        },
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Default Response" } },
      },
    },
    "/api/v1/store/transactions/{id}": {
      get: {
        summary: "Detail Transaksi Outlet",
        tags: ["Store Transactions"],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "ID transaksi unik",
          },
        ],
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Default Response" } },
      },
    },
  },
};

const DEFAULT_JWT_ADMIN = "Bearer admin-dummy-token";
const DEFAULT_JWT_SELLER = "Bearer seller-dummy-token";

export default function App() {
  const [endpoints, setEndpoints] = useState<ApiEndpoint[]>([]);
  const [selectedEndpoint, setSelectedEndpoint] = useState<ApiEndpoint | null>(
    null,
  );
  const [isLoadingSpec, setIsLoadingSpec] = useState(true);
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  const [specError, setSpecError] = useState<string | null>(null);

  // Filter Active Role
  const [activeRoleFilter, setActiveRoleFilter] = useState<string>("all");

  // Active Role Configuration Profile loaded from LocalStorage or Default
  const [roleConfigs, setRoleConfigs] = useState<Record<string, RoleConfig>>(
    {},
  );

  // Captured HTTP response snapshot logs stored as: [endpointKey]: { [statusCode]: ResponseLog }
  const [responseHistory, setResponseHistory] = useState<ResponseCodeLogs>({});

  // Simulate execution button loader state
  const [isExecutingRequest, setIsExecutingRequest] = useState(false);

  // Sidebar Open State (for Mobile Navigation overlay)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Workspace integration states
  const [workspace, setWorkspace] = useState<FileSystemDirectoryHandle | null>(null);
  const [initMode, setInitMode] = useState<"loading" | "setup" | "resume" | "ready">("loading");

  // Tabbed layout state for workspace right panel: sandbox (forms + history), config (credentials manager), runner (mass serial test)
  const [workspaceTab, setWorkspaceTab] = useState<
    "sandbox" | "config" | "runner" | "metrics"
  >("metrics");
  const [configTabRole, setConfigTabRole] = useState<
    "admin" | "seller" | "store" | "public" | "webhook"
  >("admin");

  useEffect(() => {
    (async () => {
      try {
        const stored = await getWorkspaceHandle();
        if (stored) {
          setWorkspace(stored);
          setInitMode("resume");
        } else {
          setInitMode("setup");
        }
      } catch (err) {
        setInitMode("setup");
      }
    })();
  }, []);

  const connectNewWorkspace = async () => {
    try {
      // @ts-ignore
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      await saveWorkspaceHandle(handle);
      setWorkspace(handle);
      await loadWorkspaceData(handle);
    } catch (e) {
      console.log("User cancelled folder picker");
    }
  };

  const resumeWorkspace = async () => {
    if (!workspace) return;
    try {
      if (await verifyWorkspacePermission(workspace)) {
        await loadWorkspaceData(workspace);
      } else {
        alert("Gagal mengaktifkan folder. Silakan pilih folder ulang.");
        setInitMode("setup");
      }
    } catch (e) {
      alert("Gagal mengaktifkan folder. Silakan pilih folder ulang.");
      setInitMode("setup");
    }
  };

  const disconnectWorkspace = async () => {
    if (window.confirm("Hapus sesi workspace saat ini? Anda harus memilih folder lagi nanti.")) {
      await clearWorkspaceHandle();
      window.location.reload();
    }
  };

  const loadWorkspaceData = async (handle: FileSystemDirectoryHandle) => {
    setInitMode("loading");
    
    // Default config init
    const initialConfigs: Record<string, RoleConfig> = {};
    ROLES.forEach((role) => {
      initialConfigs[role] = createDefaultRoleConfig(role);
    });

    try {
      const customConfig = await readWorkspaceConfig(handle);
      if (customConfig?.roleConfigs) {
        Object.keys(customConfig.roleConfigs).forEach(role => {
          initialConfigs[role] = customConfig.roleConfigs[role];
        });
      }
      
      const customResps = await readWorkspaceResponses(handle);
      setResponseHistory(customResps);
      
      const savedFilter = customConfig?.inputsStore?.["qian_active_role_filter"];
      if (savedFilter) {
        setActiveRoleFilter(savedFilter);
      }
    } catch (err) {
      console.error("Failed to load workspace data", err);
    }
    
    setRoleConfigs(initialConfigs);
    await fetchApiSpecification();
    setInitMode("ready");
  };

  const createDefaultRoleConfig = (role: string): RoleConfig => {
    return {
      role,
      baseUrl: "https://qianpulsa-coreapi-v1.onrender.com",
      headers: {
        Authorization:
          role === "admin"
            ? DEFAULT_JWT_ADMIN
            : role === "seller"
              ? DEFAULT_JWT_SELLER
              : role === "store"
                ? "Bearer store-dummy-token"
                : "",
        "x-app-client-key": "",
        "x-app-origin":
          role === "admin"
            ? "admin"
            : role === "seller"
              ? "seller"
              : role === "store"
                ? "store"
                : "other",
      },
      savedValues: {},
    };
  };

  const fetchApiSpecification = async () => {
    setIsLoadingSpec(true);
    setSpecError(null);
    try {
      let data;
      try {
        // Try direct remote fetch first (great for WebViews and standard CORS-enabled clients)
        const directResp = await fetch(
          "https://qianpulsa-coreapi-v1.onrender.com/docs/json",
        );
        if (!directResp.ok) throw new Error("Status " + directResp.status);
        data = await directResp.json();
      } catch (directErr) {
        console.warn(
          "Direct remote spec fetch failed, trying local proxy `/api/proxy-spec`...",
          directErr,
        );
        const resp = await fetch("/api/proxy-spec");
        if (!resp.ok) {
          throw new Error(`Proxy error: ${resp.statusText}`);
        }
        data = await resp.json();
      }

      const parsedEp = parseOpenApi(data);
      if (parsedEp.length === 0) {
        throw new Error("Parsed zero endpoints from JSON.");
      }
      setEndpoints(parsedEp);
      setIsUsingFallback(false);
      // Select first endpoint
      if (parsedEp.length > 0) {
        setSelectedEndpoint(parsedEp[0]);
      }
    } catch (err: any) {
      console.warn(
        "Failed to fetch server spec, activating offline fallback...",
        err,
      );
      const parsedEp = parseOpenApi(FALLBACK_SPEC);
      setEndpoints(parsedEp);
      setIsUsingFallback(true);
      setSpecError(err.message || "Failed to contact proxy.");
      if (parsedEp.length > 0) {
        setSelectedEndpoint(parsedEp[0]);
      }
    } finally {
      setIsLoadingSpec(false);
    }
  };

  const handleRoleConfigChange = async (updated: RoleConfig) => {
    const nextConfigs = { ...roleConfigs, [updated.role]: updated };
    setRoleConfigs(nextConfigs);
    
    if (workspace) {
      await writeWorkspaceConfig(workspace, {
        roleConfigs: nextConfigs,
        inputsStore: { qian_active_role_filter: activeRoleFilter }
      });
    }
  };

  const handleResetRoleConfig = (role: string) => {
    if (
      window.confirm(
        `Apakah Anda yakin ingin menyetel ulang konfigurasi untuk role ${role}?`,
      )
    ) {
      const fresh = createDefaultRoleConfig(role);
      handleRoleConfigChange(fresh);
    }
  };

  const currentRoleForSelected = selectedEndpoint
    ? getRoleFromPath(selectedEndpoint.path)
    : "other";

  const currentConfig =
    roleConfigs[currentRoleForSelected] || createDefaultRoleConfig("other");

  // Sync role filter change with tab selection helper
  const handleRoleFilterChange = async (role: string) => {
    setActiveRoleFilter(role);
    if (workspace) {
      await writeWorkspaceConfig(workspace, {
        roleConfigs,
        inputsStore: { qian_active_role_filter: role }
      });
    }
  };

  // Perform Simulated Proxy Request
  const handleExecuteRequest = async (reqData: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body: any;
  }) => {
    setIsExecutingRequest(true);
    const endpointKey = selectedEndpoint
      ? `${selectedEndpoint.method}:${selectedEndpoint.path}`
      : "custom";

    try {
      let responsePayload;

      // Check if we are running in a static web view, github pages, or fallback mode
      const isStaticOrWebView =
        isUsingFallback ||
        window.location.protocol === "file:" ||
        window.location.hostname.includes("github.io") ||
        window.location.hostname.includes("vercel.app") ||
        window.location.hostname.includes("github");

      if (isStaticOrWebView) {
        // Direct browser/webview client-side fetch (perfect for Android WebView where CORS is bypassed or API allows CORS)
        const startTime = Date.now();
        const fetchOptions: RequestInit = {
          method: reqData.method,
          headers: reqData.headers,
        };

        if (
          reqData.body &&
          ["POST", "PUT", "PATCH", "DELETE"].includes(
            reqData.method.toUpperCase(),
          )
        ) {
          fetchOptions.body =
            typeof reqData.body === "string"
              ? reqData.body
              : JSON.stringify(reqData.body);
        }

        try {
          const response = await fetch(reqData.url, fetchOptions);
          const duration = Date.now() - startTime;

          let responseBodyText = "";
          try {
            responseBodyText = await response.text();
          } catch (e) {
            // ignore
          }

          let parsedBody: any = null;
          try {
            parsedBody = JSON.parse(responseBodyText);
          } catch (e) {
            parsedBody = responseBodyText;
          }

          const responseHeaders: Record<string, string> = {};
          response.headers.forEach((val, key) => {
            responseHeaders[key] = val;
          });

          responsePayload = {
            status: response.status,
            statusText: response.statusText,
            durationMs: duration,
            headers: responseHeaders,
            body: parsedBody,
          };
        } catch (fetchErr: any) {
          // If direct call fails (e.g. CORS block on local browser tests), try to delegate to server api proxy as fallback just in case
          console.warn(
            "Direct fetch failed, trying express proxy fallback...",
            fetchErr,
          );
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
        // Standard Express backend proxy path
        const resp = await fetch("/api/proxy-request", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: reqData.url,
            method: reqData.method,
            headers: reqData.headers,
            body: reqData.body,
          }),
        });

        responsePayload = await resp.json();
      }

      // Construct Response Log Object
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
          body: reqData.body,
        },
      };

      // Merge and save to localStorage (overwrite code log newer)
      const nextHistory = { ...responseHistory };
      if (!nextHistory[endpointKey]) {
        nextHistory[endpointKey] = {};
      }
      nextHistory[endpointKey][responsePayload.status] = logRecord;

      setResponseHistory(nextHistory);
      if (workspace && selectedEndpoint) {
        await writeWorkspaceResponse(
          workspace, 
          getRoleFromPath(selectedEndpoint.path), 
          endpointKey, 
          logRecord
        );
      }

      // Auto-extract token and save to credentials if requested
      if (
        responsePayload.status >= 200 &&
        responsePayload.status < 300 &&
        responsePayload.body
      ) {
        // simple recursive token finder
        const extractToken = (obj: any): string | null => {
          if (!obj || typeof obj !== "object") return null;
          if (typeof obj.token === "string") return obj.token;
          if (typeof obj.accessToken === "string") return obj.accessToken;
          if (obj.data && typeof obj.data === "object") {
            if (typeof obj.data.token === "string") return obj.data.token;
            if (typeof obj.data.accessToken === "string")
              return obj.data.accessToken;
          }
          return null;
        };
        const tokenFound = extractToken(responsePayload.body);
        if (tokenFound) {
          const activeRole = selectedEndpoint
            ? getRoleFromPath(selectedEndpoint.path)
            : "other";
          if (activeRole !== "other") {
            const currentRoleCfg =
              roleConfigs[activeRole] || createDefaultRoleConfig(activeRole);
            const updatedCfg = {
              ...currentRoleCfg,
              headers: {
                ...currentRoleCfg.headers,
                Authorization: `Bearer ${tokenFound}`,
              },
            };
            const nextRoles = { ...roleConfigs, [activeRole]: updatedCfg };
            setRoleConfigs(nextRoles);
            
            if (workspace) {
              await writeWorkspaceConfig(workspace, {
                roleConfigs: nextRoles,
                inputsStore: { qian_active_role_filter: activeRoleFilter }
              });
            }
          }
        }
      }
    } catch (err: any) {
      console.error("Fetch executor failed in application", err);
      // Handle fallback error mapping
      const errorRecord: ResponseLog = {
        endpointKey,
        status: 600,
        statusText: "Application Connection Failed",
        durationMs: 0,
        timestamp: new Date().toISOString(),
        headers: {},
        body: {
          error: "Sistem gagal mengirimkan permintaan simulasi.",
          details: err.message,
        },
        requestSent: {
          url: reqData.url,
          method: reqData.method,
          headers: reqData.headers,
          body: reqData.body,
        },
      };

      const nextHistory = { ...responseHistory };
      if (!nextHistory[endpointKey]) {
        nextHistory[endpointKey] = {};
      }
      nextHistory[endpointKey][600] = errorRecord;
      setResponseHistory(nextHistory);
      
      if (workspace && selectedEndpoint) {
        await writeWorkspaceResponse(
          workspace, 
          getRoleFromPath(selectedEndpoint.path), 
          endpointKey, 
          errorRecord
        );
      }
    } finally {
      setIsExecutingRequest(false);
    }
  };

  const handleClearLogsForEndpoint = async () => {
    if (!selectedEndpoint) return;
    const endpointKey = `${selectedEndpoint.method}:${selectedEndpoint.path}`;
    if (
      window.confirm(
        "Apakah Anda yakin ingin menghapus arsip respon untuk endpoint ini?",
      )
    ) {
      const nextHistory = { ...responseHistory };
      delete nextHistory[endpointKey];
      setResponseHistory(nextHistory);
      
      if (workspace) {
        await clearWorkspaceResponses(
          workspace,
          getRoleFromPath(selectedEndpoint.path),
          endpointKey
        );
      }
    }
  };

  if (initMode !== "ready") {
    return (
      <div className="min-h-screen bg-brand-bg text-slate-300 flex flex-col font-sans">
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          {initMode === "setup" && (
            <div className="max-w-md w-full bg-brand-sidebar border border-slate-900 rounded-2xl p-8 shadow-2xl">
              <FolderOpen className="w-16 h-16 text-indigo-500 mx-auto mb-6" />
              <h1 className="text-2xl font-bold text-white mb-2">QianPulsa Tester</h1>
              <p className="text-sm text-slate-400 mb-8 leading-relaxed">
                Hubungkan folder lokal perangkat Anda untuk mulai menyimpan data log konfigurasi secara permanen dan aman.
              </p>
              <button
                onClick={connectNewWorkspace}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-6 rounded-xl transition shadow-lg shadow-indigo-600/20"
              >
                Pilih Folder Workspace
              </button>
            </div>
          )}
          {initMode === "resume" && (
            <div className="max-w-md w-full bg-brand-sidebar border border-slate-900 rounded-2xl p-8 shadow-2xl">
              <FolderOpen className="w-16 h-16 text-indigo-500 mx-auto mb-6" />
              <h1 className="text-2xl font-bold text-white mb-2">Selamat Datang Kembali</h1>
              <p className="text-sm text-slate-400 mb-8 leading-relaxed">
                Aplikasi mengingat workspace terakhir. Klik untuk mengaktifkan kembali akses.
              </p>
              <button
                onClick={resumeWorkspace}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-6 rounded-xl transition shadow-lg shadow-indigo-600/20 mb-4"
              >
                Aktifkan Workspace
              </button>
              <button
                onClick={connectNewWorkspace}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
              >
                Gunakan Folder Lain
              </button>
            </div>
          )}
          {initMode === "loading" && (
            <div className="flex flex-col items-center justify-center p-12">
              <RefreshCw className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
              <p className="text-sm font-semibold text-slate-300 animate-pulse">Menghubungkan ke folder...</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const activeLogsForSelected = selectedEndpoint
    ? responseHistory[`${selectedEndpoint.method}:${selectedEndpoint.path}`] ||
      {}
    : {};

  return (
    <div className="min-h-screen bg-brand-bg text-slate-300 flex flex-col font-sans">
      {/* Dynamic Visual Gradient Background */}
      <div className="absolute top-0 left-0 w-full h-[300px] bg-gradient-to-b from-indigo-900/10 via-brand-bg/2 to-transparent -z-10 pointer-events-none"></div>

      {/* Primary Top Header Navigation */}
      <header className="border-b border-slate-800 bg-brand-header/80 backdrop-blur-md sticky top-0 z-40 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Sidebar toggle button for small screens */}
            <button
              id="btn-toggle-sidebar"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="lg:hidden p-2 bg-brand-sidebar hover:bg-indigo-600 hover:text-white border border-slate-800 rounded-xl text-slate-300 transition shrink-0 cursor-pointer flex items-center justify-center"
              title="Lihat Daftar API & Metrik"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="bg-indigo-600 p-2.5 rounded-xl shadow-lg shadow-indigo-500/10 flex items-center justify-center">
              <Terminal className="w-5 h-5 text-indigo-100" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                QianSim <span className="text-indigo-400">v1</span>
                <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 text-[9px] font-sans rounded-full uppercase font-medium tracking-wider">
                  API Simulator
                </span>
              </h1>
              <p className="text-xs text-slate-400 flex items-center gap-1">
                Testing real-time terintegrasi • Panel Admin & Seller Panel
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {isUsingFallback && (
              <span className="bg-amber-500/10 text-amber-400 border border-amber-500/25 px-2.5 py-1 text-[11px] rounded-lg flex items-center gap-1.5 font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                Mode Offline fallback Aktif
              </span>
            )}

            {!isUsingFallback && endpoints.length > 0 && (
              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-2.5 py-1 text-[11px] rounded-lg flex items-center gap-1.5 font-medium">
                <CheckCircle className="w-3.5 h-3.5" />
                Dihubungkan ke Core Server
              </span>
            )}

            <button
              id="btn-reload-spec"
              onClick={fetchApiSpecification}
              disabled={isLoadingSpec}
              className="p-2 bg-brand-sidebar hover:bg-brand-header border border-slate-800 rounded-lg text-slate-300 transition shrink-0 cursor-pointer disabled:opacity-50"
              title="Muat Ulang Swagger Spec"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isLoadingSpec ? "animate-spin" : ""}`}
              />
            </button>
            <button
              id="btn-disconnect"
              onClick={disconnectWorkspace}
              className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer"
              title="Keluar dari Workspace"
            >
              Keluar Workspace
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Layout Wrapper */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {isLoadingSpec && endpoints.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-500">
            <div className="relative mb-4">
              <div className="w-12 h-12 rounded-full border border-indigo-500/20 animate-ping absolute -inset-0.5"></div>
              <div className="w-12 h-12 rounded-full border-t-2 border-indigo-500 animate-spin"></div>
            </div>
            <h3 className="text-sm font-semibold text-slate-300">
              Menghubungkan ke Core API Dokumentasi...
            </h3>
            <p className="text-xs text-slate-500 mt-1.5 max-w-xs text-center leading-relaxed">
              Sedang mengambil struktur API dan parameter dari render online.
              Ini mungkin memerlukan beberapa detik bila instance render sedang
              tertidur.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start relative">
            {/* Left Column: Responsive Sticky Drawer Navigation */}
            {isSidebarOpen && (
              <div
                id="sidebar-backdrop"
                className="lg:hidden fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 transition-opacity duration-300"
                onClick={() => setIsSidebarOpen(false)}
              />
            )}

            <div
              id="sidebar-panel"
              className={`
                fixed lg:sticky inset-y-0 lg:inset-auto left-0 lg:left-auto lg:top-[100px] lg:h-[calc(100vh-140px)]
                w-[300px] sm:w-[360px] lg:w-full lg:col-span-3
                bg-brand-sidebar lg:bg-transparent border-r border-slate-900 lg:border-none p-5 lg:p-0
                z-50 lg:z-0
                transform ${isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
                transition-transform duration-300 ease-in-out flex flex-col gap-4 overflow-hidden
              `}
            >
              {/* Drawer Header for small viewports */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 lg:hidden shrink-0">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Navigasi Simulator
                  </span>
                </div>
                <button
                  id="btn-close-sidebar"
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              {/* Live Detected List */}
              <div className="flex-1 min-h-0 bg-brand-sidebar border border-slate-800 rounded-xl overflow-hidden shadow-xl h-full flex flex-col">
                <EndpointList
                  endpoints={endpoints}
                  selectedEndpoint={selectedEndpoint}
                  responseHistory={responseHistory}
                  onSelectEndpoint={(ep) => {
                    setSelectedEndpoint(ep);
                    setWorkspaceTab("sandbox"); // Auto-switch to sandbox on endpoint activation
                    setIsSidebarOpen(false); // auto-close drawer on mobile when tap endpoint
                  }}
                  activeRoleFilter={activeRoleFilter}
                  setActiveRoleFilter={handleRoleFilterChange}
                />
              </div>
            </div>

            {/* Right Column: Interaction Sandbox Forms & Responses Log History */}
            <div className="lg:col-span-9 flex flex-col gap-6">
              {/* Clean Minimalist Tab Bar */}
              <div className="flex overflow-x-auto whitespace-nowrap scrollbar-none bg-brand-sidebar border border-slate-900 p-1 rounded-xl select-none shrink-0 font-sans shadow-sm gap-1">
                <button
                  id="tab-view-metrics"
                  onClick={() => setWorkspaceTab("metrics")}
                  className={`py-2.5 px-4 rounded-lg text-xs font-bold transition flex flex-1 items-center justify-center gap-2 cursor-pointer ${
                    workspaceTab === "metrics"
                      ? "bg-indigo-600 text-white shadow"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>Metrik Sistem</span>
                </button>

                <button
                  id="tab-view-config"
                  onClick={() => setWorkspaceTab("config")}
                  className={`py-2.5 px-4 rounded-lg text-xs font-bold transition flex flex-1 items-center justify-center gap-2 cursor-pointer ${
                    workspaceTab === "config"
                      ? "bg-indigo-600 text-white shadow"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>Token & Credentials</span>
                </button>

                <button
                  id="tab-view-sandbox"
                  onClick={() => setWorkspaceTab("sandbox")}
                  className={`py-2.5 px-4 rounded-lg text-xs font-bold transition flex flex-1 items-center justify-center gap-2 cursor-pointer ${
                    workspaceTab === "sandbox"
                      ? "bg-indigo-600 text-white shadow"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Play
                    className={`w-3.5 h-3.5 ${workspaceTab === "sandbox" ? "fill-current" : ""}`}
                  />
                  <span>Simulator Kirim</span>
                </button>

                <button
                  id="tab-view-runner"
                  onClick={() => setWorkspaceTab("runner")}
                  className={`py-2.5 px-4 rounded-lg text-xs font-bold transition flex flex-1 items-center justify-center gap-2 cursor-pointer ${
                    workspaceTab === "runner"
                      ? "bg-indigo-600 text-white shadow"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Auto-Runner Board</span>
                </button>
              </div>

              {/* Tab views conditional components */}
              {workspaceTab === "metrics" && (
                <div className="space-y-6">
                  {/* Metrik Sistem Segment */}
                  <div className="bg-brand-sidebar border border-slate-800 rounded-xl p-6 shadow-xl">
                    <div className="flex gap-2 items-center mb-4 text-sm">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"></span>
                      <span className="text-slate-200 font-semibold uppercase tracking-wider">
                        Metrik Sistem & Penyimpanan
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                      <div className="bg-brand-bg p-4 rounded-lg border border-slate-800">
                        <span className="text-xs text-slate-500 block mb-1">
                          Total Rute API
                        </span>
                        <span className="text-2xl font-bold text-slate-200">
                          {endpoints.length}
                        </span>
                      </div>
                      <div className="bg-brand-bg p-4 rounded-lg border border-slate-800">
                        <span className="text-xs text-slate-500 block mb-1">
                          Total Response Direkam
                        </span>
                        <span className="text-2xl font-bold text-emerald-400">
                          {Object.values(responseHistory).reduce(
                            (acc: number, codesObj) =>
                              acc + Object.keys(codesObj).length,
                            0,
                          )}
                        </span>
                      </div>
                      <div className="bg-brand-bg p-4 rounded-lg border border-slate-800">
                        <span className="text-xs text-slate-500 block mb-1">
                          Total Endpoint Teruji
                        </span>
                        <span className="text-2xl font-bold text-indigo-400">
                          {Object.keys(responseHistory).length}
                        </span>
                      </div>
                      <div className="bg-brand-bg p-4 rounded-lg border border-slate-800">
                        <span className="text-xs text-slate-500 block mb-1">
                          Sisa Target
                        </span>
                        <span className="text-2xl font-bold text-amber-500">
                          {endpoints.length -
                            Object.keys(responseHistory).length}
                        </span>
                      </div>
                    </div>

                    <div className="mt-8 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-lg flex flex-col sm:flex-row gap-4 items-center justify-between">
                      <div>
                        <h4 className="text-sm font-semibold text-indigo-300 mb-2">
                          Penyimpanan Lokal Aktif (Workspace)
                        </h4>
                        <p className="text-xs text-slate-400 max-w-2xl">
                          Seluruh data konfigurasi role, logs repons otomatis, dan cache input Anda akan tersimpan di dalam folder <strong>{workspace?.name}</strong>. Anda tidak perlu repot menyalin JSON secara manual. Sistem bertindak seperti IDE lokal.
                        </p>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                        <button
                          onClick={disconnectWorkspace}
                          className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-semibold py-2 px-4 rounded transition"
                        >
                          Keluar Workspace
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {workspaceTab === "sandbox" && (
                <div className="space-y-6">
                  {selectedEndpoint ? (
                    <>
                      {/* Dynamic Instruction Card per Role detected */}
                      <div className="flex gap-4 p-4 bg-brand-sidebar border border-slate-900 rounded-xl">
                        <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg shrink-0 h-10 w-10 flex items-center justify-center">
                          <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-widest">
                            Konfigurasi Aktif: Role "
                            {currentRoleForSelected === "admin"
                              ? "Admin"
                              : currentRoleForSelected === "seller"
                                ? "Seller"
                                : currentRoleForSelected === "store"
                                  ? "Store"
                                  : "Store/Webhook"}
                            "
                          </h4>
                          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                            Endpoint ini berawal dengan path{" "}
                            <span className="font-mono bg-brand-bg px-1 py-0.5 rounded text-amber-300">
                              /api/v1/{currentRoleForSelected}
                            </span>
                            . Menggunakan konfigurasi independen tersimpan di
                            bawah ini. Harap masukan Token untuk mencoba
                            simulasi otorisasi nyata.
                          </p>
                        </div>
                      </div>

                      {/* Sandbox forms */}
                      <ProxyRequestForm
                        endpoint={selectedEndpoint}
                        roleConfig={currentConfig}
                        onExecute={handleExecuteRequest}
                        isLoading={isExecutingRequest}
                      />

                      {/* Code Log Snapshots segment */}
                      <div className="pt-2">
                        <ResponseCodeHistory
                          logsForEndpoint={activeLogsForSelected}
                          onClearLogs={handleClearLogsForEndpoint}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="min-h-[350px] flex flex-col items-center justify-center text-center p-8 bg-brand-sidebar border border-slate-900 rounded-xl">
                      <HelpCircle className="w-10 h-10 text-slate-650 mb-2 animate-pulse" />
                      <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                        Harap Pilih Rute API
                      </h3>
                      <p className="text-xs text-slate-500 mt-1.5 max-w-xs">
                        Pilih salah satu metode & rute rujukan API di daftar
                        sebelah kiri untuk memunculkan panel simulasi nyata.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {workspaceTab === "config" && (
                <div className="space-y-6">
                  <div className="p-4 bg-brand-sidebar border border-slate-900 rounded-xl">
                    <h3 className="text-sm font-semibold text-white mb-2">
                      Pilih Role Autentikasi
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed mb-4">
                      Atur URL dasar (Base URL) dan Header default (misalnya
                      authorization Token Bearer) untuk masing-masing role.
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      {ROLES.map((role) => (
                        <button
                          key={role}
                          onClick={() => setConfigTabRole(role as any)}
                          className={`capitalize px-4 py-2 rounded-lg text-xs font-semibold transition ${
                            configTabRole === role
                              ? "bg-indigo-600 text-white shadow"
                              : "bg-slate-800 text-slate-400 hover:text-white"
                          }`}
                        >
                          {role}
                        </button>
                      ))}
                    </div>
                  </div>
                  <RoleConfigurationManager
                    currentRole={configTabRole}
                    config={roleConfigs[configTabRole] || createDefaultRoleConfig(configTabRole)}
                    onConfigChange={handleRoleConfigChange}
                    onReset={() => handleResetRoleConfig(configTabRole)}
                  />
                </div>
              )}

              <div className={workspaceTab === "runner" ? "block" : "hidden"}>
                <AutoRunnerPanel
                  endpoints={endpoints}
                  roleConfigs={roleConfigs}
                  responseHistory={responseHistory}
                  onUpdateHistory={async (updatedHistory) => {
                    setResponseHistory(updatedHistory);
                    // Workspace saves individual objects as they complete in the proxy runner. We don't overwrite all here for safety.
                  }}
                  onSaveResponse={async (role: string, endpointKey: string, log: ResponseLog) => {
                    if (workspace) {
                      await writeWorkspaceResponse(workspace, role, endpointKey, log);
                    }
                  }}
                  isUsingFallback={isUsingFallback}
                  onSelectEndpoint={(ep) => setSelectedEndpoint(ep)}
                  onStartBulkRun={() => setWorkspaceTab("sandbox")}
                />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Human, Literal Footer */}
      <footer className="border-t border-slate-800 mt-12 py-6 text-center text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span>QianPulsa Core API v1.0 • Simulator Penguji</span>
          <span className="text-slate-500 font-sans">
            Menyimpan data konfigurasi & log respon status dienkripsi lokal pada
            browser Anda.
          </span>
        </div>
      </footer>
    </div>
  );
}
