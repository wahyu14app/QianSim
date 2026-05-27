export interface ApiParameter {
  name: string;
  in: "query" | "path" | "header";
  required: boolean;
  type: string;
  default?: string;
  description?: string;
  enum?: string[];
}

export interface ApiProperty {
  type: string;
  required?: boolean;
  description?: string;
  format?: string;
  pattern?: string;
  minLength?: number;
  minimum?: number;
  nullable?: boolean;
  enum?: string[];
  default?: any;
  items?: {
    type: string;
    enum?: string[];
  };
}

export interface ApiRequestBody {
  required: boolean;
  properties: Record<string, ApiProperty>;
}

export interface ApiEndpoint {
  path: string;
  method: string;
  summary: string;
  tags: string[];
  securedBy: string[]; // e.g. ["bearerAuth", "clientKey", "appOrigin"]
  parameters: ApiParameter[];
  requestBody?: ApiRequestBody;
}

export interface SavedParameterValue {
  in: "query" | "path" | "header" | "body";
  name: string; // Or field path for nested body params
  value: any;
}

export interface RoleConfig {
  role: string; // "admin" | "seller" | "other" (etc)
  baseUrl: string;
  headers: Record<string, string>; // e.g. Authorization, x-app-client-key
  savedValues: Record<string, Record<string, any>>; // Maps key: "method:path" to key-value parameters/body fields
}

export interface ResponseLog {
  endpointKey: string; // "method:path"
  status: number;
  statusText: string;
  durationMs: number;
  timestamp: string;
  headers: Record<string, string>;
  body: any;
  requestSent: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body: any;
  };
}

// Map of [endpointKey]: Record<statusCode, ResponseLog>
export type ResponseCodeLogs = Record<string, Record<number, ResponseLog>>;
