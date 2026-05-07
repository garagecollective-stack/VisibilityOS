import { Queue } from "bullmq";
import { Redis } from "ioredis";

export type QueueName =
  | "rank-checks"
  | "audits"
  | "ai-tasks"
  | "reports"
  | "geo-checks";

let connection: Redis | undefined;

export function getRedisConnection(): Redis {
  if (connection) return connection;
  connection = new Redis(process.env["REDIS_URL"] ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null, // Required by BullMQ
  });
  return connection;
}

function makeQueue(name: QueueName): Queue {
  return new Queue(name, {
    connection: getRedisConnection(),
    defaultJobOptions: {
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 500 },
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
    },
  });
}

// Instances are created on first use, not at module load time.
// This prevents crashing the API at startup when Redis is unavailable.
const _instances = new Map<QueueName, Queue>();

function getInstance(name: QueueName): Queue {
  let q = _instances.get(name);
  if (!q) {
    q = makeQueue(name);
    _instances.set(name, q);
  }
  return q;
}

function lazyQueue(name: QueueName): Queue {
  return new Proxy<object>(Object.create(null), {
    get(_target: object, prop: string | symbol): unknown {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const q = getInstance(name) as any;
      const val = q[prop];
      return typeof val === "function" ? (val as (...args: unknown[]) => unknown).bind(q) : val;
    },
  }) as unknown as Queue;
}

export const rankChecksQueue = lazyQueue("rank-checks");
export const auditsQueue = lazyQueue("audits");
export const aiTasksQueue = lazyQueue("ai-tasks");
export const reportsQueue = lazyQueue("reports");
export const geoChecksQueue = lazyQueue("geo-checks");

// ─── Job payload types ────────────────────────────────────────────────────────

export interface RankCheckJobData {
  projectId: string;
  keywordId: string;
  keyword: string;
  locationCode: number;
  device: "desktop" | "mobile";
  domain: string;
}

export interface AuditJobData {
  projectId: string;
  auditRunId: string;
  domain: string;
  maxPages?: number;
}

export interface AITaskJobData {
  type: "content_analysis" | "content_brief" | "issue_classify" | "rank_summary";
  projectId: string;
  payload: Record<string, unknown>;
}

export interface ReportJobData {
  reportId: string;
  projectId: string;
  type: string;
  config: Record<string, unknown>;
}

export interface GeoCheckJobData {
  promptId: string;
  projectId: string;
  promptText: string;
  platforms: string[];
  targetDomain: string;
}
