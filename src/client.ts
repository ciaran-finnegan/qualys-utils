import type {
  QualysConfig,
  ServiceRequest,
  ServiceResponse,
  Tag,
  TagSearchResponse,
  TagCreateResponse,
} from './types.ts';

export class QualysApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(message);
    this.name = 'QualysApiError';
  }
}

export class QualysClient {
  private readonly authHeader: string;

  constructor(private readonly config: QualysConfig) {
    if (!config.baseUrl || !config.username || !config.password) {
      throw new Error(
        `Missing Qualys credentials for "${config.label}". Check .env (BASE_URL, USERNAME, PASSWORD).`,
      );
    }
    this.authHeader = `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`;
  }

  get label(): string {
    return this.config.label;
  }

  get baseUrl(): string {
    return this.config.baseUrl;
  }

  private async request<TResp>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<TResp> {
    const url = `${this.config.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: this.authHeader,
      Accept: 'application/json',
      'X-Requested-With': 'qualys-tag-migrator',
    };
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const res = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await res.text();
    if (!res.ok) {
      throw new QualysApiError(`HTTP ${res.status} from ${path}`, res.status, text.slice(0, 500));
    }

    let parsed: TResp;
    try {
      parsed = JSON.parse(text) as TResp;
    } catch {
      throw new QualysApiError(`Non-JSON response from ${path}`, res.status, text.slice(0, 500));
    }

    const sr = (parsed as { ServiceResponse?: { responseCode?: string; responseErrorDetails?: { errorMessage?: string } } }).ServiceResponse;
    if (sr && sr.responseCode && sr.responseCode !== 'SUCCESS') {
      const detail = sr.responseErrorDetails?.errorMessage ?? '(no detail)';
      throw new QualysApiError(
        `Qualys returned ${sr.responseCode} on ${path}: ${detail}`,
        res.status,
        text.slice(0, 500),
      );
    }

    return parsed;
  }

  // Iterate through every tag on the instance, paged 100 at a time.
  // The API returns `hasMoreRecords` and `lastId`; we use offset paging since
  // it works without filter chaining.
  async *iterateAllTags(pageSize = 100): AsyncGenerator<Tag, void, void> {
    let offset = 1;
    while (true) {
      const reqBody: ServiceRequest<never> = {
        ServiceRequest: {
          preferences: { startFromOffset: offset, limitResults: pageSize },
        },
      };
      const resp = await this.request<TagSearchResponse>(
        'POST',
        '/qps/rest/2.0/search/am/tag',
        reqBody,
      );
      const data = resp.ServiceResponse.data ?? [];
      for (const item of data) yield item.Tag;

      const more = resp.ServiceResponse.hasMoreRecords;
      const hasMore = more === true || more === 'true';
      if (!hasMore || data.length === 0) break;
      offset += data.length;
    }
  }

  async createTag(tag: {
    name: string;
    color?: string | null;
    ruleType?: string | null;
    ruleText?: string | null;
    description?: string | null;
    criticalityScore?: number | null;
    provider?: string | null;
    parentTagId?: number | null;
  }): Promise<Tag> {
    const inner: Record<string, unknown> = { name: tag.name };
    if (tag.color) inner.color = tag.color;
    if (tag.ruleType) inner.ruleType = tag.ruleType;
    if (tag.ruleText) inner.ruleText = tag.ruleText;
    if (tag.description) inner.description = tag.description;
    if (tag.criticalityScore != null) inner.criticalityScore = tag.criticalityScore;
    if (tag.provider) inner.provider = tag.provider;
    if (tag.parentTagId != null) inner.parentTagId = tag.parentTagId;

    const reqBody: ServiceRequest<{ Tag: Record<string, unknown> }> = {
      ServiceRequest: { data: { Tag: inner } },
    };
    const resp = await this.request<TagCreateResponse>(
      'POST',
      '/qps/rest/2.0/create/am/tag',
      reqBody,
    );
    const created = resp.ServiceResponse.data?.[0]?.Tag;
    if (!created || created.id == null) {
      throw new QualysApiError(
        `Create returned SUCCESS but no Tag id (name="${tag.name}")`,
        200,
        JSON.stringify(resp).slice(0, 500),
      );
    }
    return created;
  }

  // Returns the count from /count/am/tag — useful as a sanity check before iterating.
  async countTags(): Promise<number> {
    const resp = await this.request<ServiceResponse<unknown>>(
      'POST',
      '/qps/rest/2.0/count/am/tag',
      { ServiceRequest: {} },
    );
    return resp.ServiceResponse.count ?? 0;
  }
}

export function loadConfigFromEnv(prefix: 'SOURCE' | 'TARGET'): QualysConfig {
  return {
    baseUrl: requireEnv(`${prefix}_QUALYS_BASE_URL`),
    username: requireEnv(`${prefix}_QUALYS_USERNAME`),
    password: requireEnv(`${prefix}_QUALYS_PASSWORD`),
    label: prefix.toLowerCase(),
  };
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}. Copy .env.example to .env and fill it in.`);
  return v;
}
