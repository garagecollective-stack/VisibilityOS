// Declare custom Hono context variables so c.get/c.set are typed
declare module "hono" {
  interface ContextVariableMap {
    userId: string;
    orgId: string;
    planLimitRemaining: number;
  }
}

export {};
