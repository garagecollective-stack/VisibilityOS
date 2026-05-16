export interface BacklinkListItem {
  sourceUrl: string;
  targetUrl: string;
  anchor: string;
  domainRank: number;
  date: string;
}

export interface OverviewData {
  totalBacklinks: number;
  referringDomains: number;
  domainRank: number;
  newBacklinks30d: number;
  lostBacklinks30d: number;
  totalBacklinksDelta: number;
  referringDomainsDelta: number;
  newBacklinksList: BacklinkListItem[];
  lostBacklinksList: BacklinkListItem[];
  isSampleData: boolean;
}

export interface HistoryPoint {
  month: string;
  totalBacklinks: number;
  referringDomains: number;
}

export interface HistoryData {
  points: HistoryPoint[];
  isSampleData: boolean;
}

export interface AnchorItem {
  anchor: string;
  percentage: number;
  count: number;
}

export interface AnchorsData {
  items: AnchorItem[];
  isSampleData: boolean;
}

export interface ReferringDomain {
  domain: string;
  domainRank: number;
  backlinks: number;
  firstSeen: string;
  lastSeen: string;
  follow: boolean;
  status: "active" | "lost";
}

export interface ReferringDomainsData {
  domains: ReferringDomain[];
  isSampleData: boolean;
}

export interface BacklinkRow {
  id: string;
  sourceUrl: string;
  sourceDomain: string;
  targetUrl: string;
  anchor: string;
  domainRank: number;
  firstSeen: string;
  dofollow: boolean;
  status: "active" | "lost" | "new";
}

export interface BacklinksData {
  backlinks: BacklinkRow[];
  total: number;
  page: number;
  limit: number;
  isSampleData: boolean;
}
