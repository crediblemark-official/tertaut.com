export interface DeviceActivateContext {
  body: Record<string, any>;
  set: { status?: number | string; [key: string]: any };
  request?: Request | any;
}

export interface DeviceVerifyContext {
  body: Record<string, any>;
  set: { status?: number | string; [key: string]: any };
  request?: Request | any;
}

export interface DeviceDeactivateContext {
  body: Record<string, any>;
  set: { status?: number | string; [key: string]: any };
  request?: Request | any;
}

export interface DeviceValidateContext {
  body: Record<string, any>;
  set: { status?: number | string; [key: string]: any };
  request?: Request | any;
}

export interface DeviceUnbindContext {
  body: Record<string, any>;
  set: { status?: number | string; [key: string]: any };
  request?: Request | any;
}

export interface DeviceHeartbeatContext {
  body: Record<string, any>;
  set: { status?: number | string; [key: string]: any };
  request?: Request | any;
}

export interface DeviceListSeatsContext {
  query?: Record<string, any>;
  request?: { headers?: Headers | any } | any;
  set: { status?: number | string; [key: string]: any };
}
