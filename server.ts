import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Parse JSON payloads
  app.use(express.json());

  // API Route to fetch QianPulsa Swagger/OpenAPI spec securely
  app.get("/api/proxy-spec", async (req, res) => {
    try {
      const response = await fetch("https://qianpulsa-coreapi-v1.onrender.com/docs/json");
      if (!response.ok) {
        throw new Error(`Failed to fetch spec: ${response.statusText}`);
      }
      const data = await response.json();
      res.json(data);
    } catch (err: any) {
      console.error("Error fetching spec:", err);
      res.status(500).json({ error: err.message || "Failed to fetch spec" });
    }
  });

  // API Route for proxying real API requests
  app.post("/api/proxy-request", async (req, res) => {
    const { url, method, headers, body } = req.body;

    if (!url) {
      return res.status(400).json({ error: "Target URL required" });
    }

    const startTime = Date.now();
    try {
      // Clean headers to prevent proxy contamination
      const cleanHeaders: Record<string, string> = {};
      if (headers && typeof headers === "object") {
        for (const [key, val] of Object.entries(headers)) {
          const lowerKey = key.toLowerCase();
          if (
            lowerKey !== "host" &&
            lowerKey !== "connection" &&
            lowerKey !== "content-length" &&
            lowerKey !== "accept-encoding"
          ) {
            cleanHeaders[key] = String(val);
          }
        }
      }

      // Ensure content-type for payload requests
      if (body && !cleanHeaders["Content-Type"] && !cleanHeaders["content-type"]) {
        cleanHeaders["Content-Type"] = "application/json";
      }

      const fetchOptions: RequestInit = {
        method: method || "GET",
        headers: cleanHeaders,
      };

      if (body !== undefined && body !== null && ["POST", "PUT", "PATCH", "DELETE"].includes(String(method).toUpperCase())) {
        fetchOptions.body = typeof body === "string" ? body : JSON.stringify(body);
      }

      const response = await fetch(url, fetchOptions);
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

      const responsePayload = {
        status: response.status,
        statusText: response.statusText,
        durationMs: duration,
        headers: responseHeaders,
        body: parsedBody,
      };

      res.json(responsePayload);
    } catch (err: any) {
      const duration = Date.now() - startTime;
      console.error("Proxy request error:", err);
      res.json({
        status: 600,
        statusText: "Connection Error / Timeout",
        durationMs: duration,
        headers: {},
        body: {
          error: err.message || "Unknown error details during request execution.",
          suggestion: "Please check your network connection, verify the target URL is reachable, and make sure that you are using valid credentials.",
        },
      });
    }
  });

  // Handle Vite middleware in Dev vs Static files in Prod
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
