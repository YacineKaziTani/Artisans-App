import { api } from "@/lib/axios";
import type { Service, ServiceAvailability } from "@/types";

export interface CreateServicePayload {
  name: string;
  description?: string;
  price: number;
  duration?: string;
  /** Appointment length in minutes (5–1440); null clears it. */
  durationMinutes?: number | null;
}

export type UpdateServicePayload = Partial<CreateServicePayload> & {
  isAvailable?: boolean;
};

export const serviceApi = {
  listAll: () => api.get<Service[]>("/services").then((r) => r.data),

  /** Free start times on a day (YYYY-MM-DD), for shops with opening hours. */
  availability: (id: string, date: string) =>
    api
      .get<ServiceAvailability>(`/services/${id}/availability`, { params: { date } })
      .then((r) => r.data),

  create: (payload: CreateServicePayload) =>
    api.post<Service>("/services/create", payload).then((r) => r.data),

  update: (id: string, payload: UpdateServicePayload) =>
    api.put<Service>(`/services/${id}`, payload).then((r) => r.data),

  remove: (id: string) => api.delete(`/services/${id}`).then((r) => r.data),
};
