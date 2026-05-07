// Qualys Asset Management & Tagging API v2 — JSON shapes.
// Reference: https://cdn2.qualys.com/docs/qualys-asset-management-tagging-api-v2-user-guide.pdf

export interface QualysConfig {
  baseUrl: string;
  username: string;
  password: string;
  label: string;
}

export interface TagSimple {
  id?: number;
  name: string;
}

export interface Tag {
  id?: number;
  name: string;
  parentTagId?: number | null;
  color?: string | null;
  ruleType?: string | null;
  ruleText?: string | null;
  srcAssetGroupId?: number | null;
  srcBusinessUnitId?: number | null;
  provider?: string | null;
  created?: string;
  modified?: string;
  children?: { list?: Array<{ TagSimple: TagSimple }> } | null;
}

export interface ServiceRequest<T> {
  ServiceRequest: {
    preferences?: {
      startFromOffset?: number;
      limitResults?: number;
      verbose?: boolean;
    };
    filters?: {
      Criteria: Array<{
        field: string;
        operator: string;
        value: string | number;
      }>;
    };
    data?: T;
  };
}

export interface ServiceResponse<T> {
  ServiceResponse: {
    responseCode: string;
    responseErrorDetails?: {
      errorMessage?: string;
      errorResolution?: string;
    };
    count?: number;
    hasMoreRecords?: string | boolean;
    lastId?: number;
    data?: T[];
  };
}

export type TagSearchResponse = ServiceResponse<{ Tag: Tag }>;
export type TagCreateResponse = ServiceResponse<{ Tag: Tag }>;

// Shape written to the export JSON file.
export interface ExportedTag {
  sourceId: number;
  name: string;
  color: string | null;
  ruleType: string | null;
  ruleText: string | null;
  parentSourceId: number | null;
}

export interface ExportFile {
  exportedAt: string;
  sourceBaseUrl: string;
  count: number;
  tags: ExportedTag[];
}
