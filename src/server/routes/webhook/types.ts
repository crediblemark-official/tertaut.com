/**
 * Strongly-typed context definitions for webhook request handlers in tertaut.com
 */

export interface WebhookContext<TBody = any> {
  request?: Request | any;
  headers?: Record<string, string | undefined> | any;
  body?: TBody;
  set: {
    status?: number | string | any;
    headers?: Record<string, any>;
    [key: string]: any;
  };
  [key: string]: any;
}

export interface WebhookHeaderContext<TBody = any> {
  headers?: Record<string, string | undefined> | any;
  body?: TBody;
  set: {
    status?: number | string | any;
    headers?: Record<string, any>;
    [key: string]: any;
  };
  [key: string]: any;
}

export interface WebhookSimpleContext<TBody = any> {
  body?: TBody;
  set: {
    status?: number | string | any;
    headers?: Record<string, any>;
    [key: string]: any;
  };
  [key: string]: any;
}
