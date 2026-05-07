import { google } from "googleapis";
import type { GoogleOAuthTokens, GA4Row } from "./types.js";

export class AnalyticsClient {
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

  private get ga4() {
    return google.analyticsdata({ version: "v1beta", auth: this.auth });
  }

  async getOrganicTraffic(
    propertyId: string,
    startDate: string,
    endDate: string
  ): Promise<GA4Row[]> {
    const res = await this.ga4.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "date" }],
        metrics: [
          { name: "sessions" },
          { name: "totalUsers" },
          { name: "bounceRate" },
          { name: "averageSessionDuration" },
        ],
        dimensionFilter: {
          filter: {
            fieldName: "sessionDefaultChannelGroup",
            stringFilter: { value: "Organic Search", matchType: "EXACT" },
          },
        },
        orderBys: [{ dimension: { dimensionName: "date" }, desc: false }],
      },
    });
    return (res.data.rows ?? []) as GA4Row[];
  }

  async getTopLandingPages(
    propertyId: string,
    startDate: string,
    endDate: string,
    limit: number = 25
  ): Promise<GA4Row[]> {
    const res = await this.ga4.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "landingPagePlusQueryString" }],
        metrics: [
          { name: "sessions" },
          { name: "totalUsers" },
          { name: "conversions" },
          { name: "bounceRate" },
        ],
        dimensionFilter: {
          filter: {
            fieldName: "sessionDefaultChannelGroup",
            stringFilter: { value: "Organic Search", matchType: "EXACT" },
          },
        },
        limit: String(limit),
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      },
    });
    return (res.data.rows ?? []) as GA4Row[];
  }
}
