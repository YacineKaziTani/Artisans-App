import { api } from "@/lib/axios";
import type { Service } from "@/types";

export interface CreateServicePayload {
  name: string;
  description?: string;
  price: number;
  duration?: string;
}

export type UpdateServicePayload = Partial<CreateServicePayload> & {
  isAvailable?: boolean;
};

export const serviceApi = {
  listAll: () => api.get<Service[]>("/services").then((r) => r.data),

  create: (payload: CreateServicePayload) =>
    api.post<Service>("/services/create", payload).then((r) => r.data),

  update: (id: string, payload: UpdateServicePayload) =>
    api.put<Service>(`/services/${id}`, payload).then((r) => r.data),

  remove: (id: string) => api.delete(`/services/${id}`).then((r) => r.data),
};
