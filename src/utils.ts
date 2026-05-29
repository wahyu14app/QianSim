import { ApiEndpoint, ApiParameter, ApiRequestBody, ApiProperty } from "./types";

export function getRoleFromPath(path: string): string {
  // Matches e.g. /api/v1/admin/auth -> admin, /api/v1/seller/stores -> seller
  const match = path.match(/^\/api\/v1\/([^/]+)/);
  if (match) {
    return match[1].toLowerCase();
  }
  return "other";
}

export function parseOpenApi(spec: any): ApiEndpoint[] {
  if (!spec || typeof spec !== "object") return [];
  const paths = spec.paths;
  if (!paths || typeof paths !== "object") return [];

  const endpoints: ApiEndpoint[] = [];

  for (const [pathKey, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== "object") continue;

    for (const [methodKey, operationAny] of Object.entries(pathItem)) {
      const operation = operationAny as any;
      if (!operation || typeof operation !== "object") continue;

      const method = methodKey.toUpperCase();
      const summary = operation.summary || `${method} ${pathKey}`;
      const tags = operation.tags || ["Uncategorized"];

      // Detect securities
      const securedBy: string[] = [];
      if (Array.isArray(operation.security)) {
        operation.security.forEach((secObj: any) => {
          if (secObj && typeof secObj === "object") {
            Object.keys(secObj).forEach((key) => {
              if (!securedBy.includes(key)) {
                securedBy.push(key);
              }
            });
          }
        });
      }

      // Also inherit security schemes from global root if any
      const parameters: ApiParameter[] = [];
      if (Array.isArray(operation.parameters)) {
        operation.parameters.forEach((param: any) => {
          if (param && typeof param === "object") {
            parameters.push({
              name: param.name || "",
              in: param.in || "query",
              required: !!param.required,
              type: param.schema?.type || "string",
              default: param.schema?.default !== undefined ? String(param.schema.default) : undefined,
              description: param.description,
              enum: param.schema?.enum,
            });
          }
        });
      }

      // Add common parameters declared at path level (if any)
      const pathLevelParams = (pathItem as any).parameters;
      if (Array.isArray(pathLevelParams)) {
        pathLevelParams.forEach((param: any) => {
          if (param && typeof param === "object") {
            // Only add if not already overridden at operation level
            if (!parameters.some((p) => p.name === param.name && p.in === param.in)) {
              parameters.push({
                name: param.name || "",
                in: param.in || "query",
                required: !!param.required,
                type: param.schema?.type || "string",
                default: param.schema?.default !== undefined ? String(param.schema.default) : undefined,
                description: param.description,
                enum: param.schema?.enum,
              });
            }
          }
        });
      }

      // Handle Request Body
      let requestBody: ApiRequestBody | undefined;
      const content = operation.requestBody?.content;
      if (content && typeof content === "object") {
        const jsonContent = content["application/json"];
        const schema = jsonContent?.schema;
        if (schema && typeof schema === "object") {
          const properties: Record<string, ApiProperty> = {};
          const requiredFields = Array.isArray(schema.required) ? schema.required : [];

          if (schema.properties && typeof schema.properties === "object") {
            for (const [propName, propValAny] of Object.entries(schema.properties)) {
              const propVal = propValAny as any;
              if (propVal && typeof propVal === "object") {
                properties[propName] = {
                  type: propVal.type || "string",
                  required: requiredFields.includes(propName),
                  description: propVal.description,
                  format: propVal.format,
                  pattern: propVal.pattern,
                  minLength: propVal.minLength,
                  minimum: propVal.minimum,
                  nullable: !!propVal.nullable,
                  enum: propVal.enum,
                  items: propVal.items ? {
                    type: propVal.items.type || "string",
                    enum: propVal.items.enum,
                  } : undefined,
                };
              }
            }
          }

          requestBody = {
            required: !!operation.requestBody.required,
            properties,
          };
        }
      }

      endpoints.push({
        path: pathKey,
        method,
        summary,
        tags,
        securedBy,
        parameters,
        requestBody,
      });
    }
  }

  return endpoints;
}

// Generate an elegant, default mock body based on schema properties
export function generateMockBody(properties: Record<string, ApiProperty>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [name, prop] of Object.entries(properties)) {
    if (prop.default !== undefined) {
      result[name] = prop.default;
      continue;
    }

    if (prop.enum && prop.enum.length > 0) {
      result[name] = prop.enum[0];
      continue;
    }

    switch (prop.type) {
      case "string":
        if (prop.format === "email") {
          result[name] = "admin@qianpulsa.com";
        } else if (prop.format === "uri") {
          result[name] = "https://qianpulsa.com/logo.png";
        } else if (prop.format === "date-time") {
          result[name] = new Date().toISOString();
        } else if (name.toLowerCase().includes("password")) {
          result[name] = "password123";
        } else if (name.toLowerCase().includes("phone")) {
          result[name] = "08123456789";
        } else if (name.toLowerCase().includes("otp")) {
          result[name] = "123456";
        } else {
          result[name] = "";
        }
        break;
      case "number":
      case "integer":
        result[name] = prop.minimum !== undefined ? prop.minimum : 0;
        break;
      case "boolean":
        result[name] = true;
        break;
      case "array":
        if (prop.items?.enum) {
          result[name] = [prop.items.enum[0]];
        } else {
          result[name] = [];
        }
        break;
      default:
        result[name] = null;
    }
  }
  return result;
}
