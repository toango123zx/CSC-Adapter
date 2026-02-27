// src/common/interfaces/api-response.interface.ts
// Chuẩn hóa response cho tất cả REST API

/**
 * Response wrapper chuẩn cho toàn bộ hệ thống.
 * Mọi controller đều nên trả về dạng này.
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}
