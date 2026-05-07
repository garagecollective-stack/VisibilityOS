import { google } from "googleapis";
import type { GoogleOAuthTokens, GSCSearchAnalyticsRow, GSCTopPage } from "./types.js";

export class SearchConsoleClient {
  private readonly auth;

  constructor(tokens: GoogleOAuthTokens) {
    this.auth = new google.auth.OAuth2(
      process.env["GOOGLE_CLIENT_ID"],
      process.env["GOOGLE_CLIENT_SECRET"]
    );
    this.auth.setCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date,
    });
  }

  private get sc() {
    return google.searchconsole({ version: "v1", auth: this.auth });
  }

  async getTopKeywords(
    siteUrl: string,
    startDate: string,
    endDate: string,
    limit: number = 1000
  ): Promise<GSCSearchAnalyticsRow[]> {
    const res = await this.sc.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ["query"],
        rowLimit: limit,
      },
    });
    const rows = res.data.rows ?? [];
    return rows.map((row) => ({
      keys: row.keys ?? [],
      clicks: row.clicks ?? 0,
      impressions: row.impressions ?? 0,
      ctr: row.ctr ?? 0,
      position: row.position ?? 0,
    }));
  }

  async getTopPages(
    siteUrl: string,
    startDate: string,
    endDate: string,
    limit: number = 500
  ): Promise<GSCTopPage[]> {
    const res = await this.sc.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ["page"],
        rowLimit: limit,
      },
    });

    return (res.data.rows ?? []).map((row) => ({
      page: row.keys?.[0] ?? "",
      clicks: row.clicks ?? 0,
      impressions: row.impressions ?? 0,
      ctr: row.ctr ?? 0,
      position: row.position ?? 0,
    }));
  }

  async getKeywordsByPage(
    siteUrl: string,
    page: string,
    startDate: string,
    endDate: string
  ): Promise<GSCSearchAnalyticsRow[]> {
    const res = await this.sc.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ["query"],
        dimensionFilterGroups: [
          {
            filters: [
              { dimension: "page", operator: "equals", expression: page },
            ],
          },
        ],
        rowLimit: 500,
      },
    });

    return (res.data.rows ?? []).map((row) => ({
      keys: row.keys ?? [],
      clicks: row.clicks ?? 0,
      impressions: row.impressions ?? 0,
      ctr: row.ctr ?? 0,
      position: row.position ?? 0,
    }));
  }

  async listProperties(): Promise<string[]> {
    const res = await this.sc.sites.list();
    return (res.data.siteEntry ?? []).map((s) => s.siteUrl ?? "").filter(Boolean);
  }
}
