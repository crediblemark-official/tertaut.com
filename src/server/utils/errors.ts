
export function apiError(set: any, statusCode: number, message: string) {
  set.status = statusCode;
  return { success: false, error: message };
}

export function successResponse(data?: any, message?: string) {
  return { success: true, data, message };
}
