var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(import_express.default.json());
  app.get("/api/proxy-spec", async (req, res) => {
    try {
      const response = await fetch("https://qianpulsa-coreapi-v1.onrender.com/docs/json");
      if (!response.ok) {
        throw new Error(`Failed to fetch spec: ${response.statusText}`);
      }
      const data = await response.json();
      res.json(data);
    } catch (err) {
      console.error("Error fetching spec:", err);
      res.status(500).json({ error: err.message || "Failed to fetch spec" });
    }
  });
  app.post("/api/proxy-request", async (req, res) => {
    const { url, method, headers, body } = req.body;
    if (!url) {
      return res.status(400).json({ error: "Target URL required" });
    }
    const startTime = Date.now();
    try {
      const cleanHeaders = {};
      if (headers && typeof headers === "object") {
        for (const [key, val] of Object.entries(headers)) {
          const lowerKey = key.toLowerCase();
          if (lowerKey !== "host" && lowerKey !== "connection" && lowerKey !== "content-length" && lowerKey !== "accept-encoding") {
            cleanHeaders[key] = String(val);
          }
        }
      }
      if (body && !cleanHeaders["Content-Type"] && !cleanHeaders["content-type"]) {
        cleanHeaders["Content-Type"] = "application/json";
      }
      const fetchOptions = {
        method: method || "GET",
        headers: cleanHeaders
      };
      if (body !== void 0 && body !== null && ["POST", "PUT", "PATCH", "DELETE"].includes(String(method).toUpperCase())) {
        fetchOptions.body = typeof body === "string" ? body : JSON.stringify(body);
      }
      const response = await fetch(url, fetchOptions);
      const duration = Date.now() - startTime;
      let responseBodyText = "";
      try {
        responseBodyText = await response.text();
      } catch (e) {
      }
      let parsedBody = null;
      try {
        parsedBody = JSON.parse(responseBodyText);
      } catch (e) {
        parsedBody = responseBodyText;
      }
      const responseHeaders = {};
      response.headers.forEach((val, key) => {
        responseHeaders[key] = val;
      });
      const responsePayload = {
        status: response.status,
        statusText: response.statusText,
        durationMs: duration,
        headers: responseHeaders,
        body: parsedBody
      };
      res.json(responsePayload);
    } catch (err) {
      const duration = Date.now() - startTime;
      console.error("Proxy request error:", err);
      res.json({
        status: 600,
        statusText: "Connection Error / Timeout",
        durationMs: duration,
        headers: {},
        body: {
          error: err.message || "Unknown error details during request execution.",
          suggestion: "Please check your network connection, verify the target URL is reachable, and make sure that you are using valid credentials."
        }
      });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
