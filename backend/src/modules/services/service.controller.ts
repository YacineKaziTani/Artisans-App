import { Request, Response } from "express";
import { IsNull } from "typeorm";
import { AppDataSource } from "../../data-source";
import { Service } from "./service.entities";
import { Shop } from "../shop/shop.entities";
import { Booking } from "../booking/booking.entities";
import { UserRole } from "../users/entities/user.entities";

// Request bodies are validated by the zod schemas in service.schemas.ts.

const serviceRepo = AppDataSource.getRepository(Service);
const shopRepo = AppDataSource.getRepository(Shop);
const bookingRepo = AppDataSource.getRepository(Booking);

async function findManageableService(id: string, req: Request) {
  const service = await serviceRepo.findOne({
    where: { id, archivedAt: IsNull() },
    relations: ["shop", "shop.owner"],
  });
  if (!service) return { service: null, allowed: false };
  const allowed =
    service.shop.owner.id === req.user!.id ||
    req.user!.role === UserRole.SUPER_ADMIN;
  return { service, allowed };
}

export const getAllServices = async (req: Request, res: Response) => {
  try {
    const services = await serviceRepo.find({
      where: { archivedAt: IsNull() },
      relations: ["shop"],
      order: { createdAt: "DESC" },
    });
    res.json(services);
  } catch (error) {
    console.error("getAllServices failed:", error);
    res.status(500).json({ message: "Error fetching services" });
  }
};

export const createService = async (req: Request, res: Response) => {
  try {
    const { name, description, price, duration, durationMinutes, capacity } = req.body;

    const shop = await shopRepo.findOne({
      where: { owner: { id: req.user!.id } },
    });
    if (!shop) {
      return res.status(404).json({ message: "You don't have a shop yet" });
    }

    const saved = await serviceRepo.save(
      serviceRepo.create({
        name,
        description,
        price,
        duration: duration || undefined,
        durationMinutes: durationMinutes ?? null,
        capacity: capacity ?? 1,
        shop,
      }),
    );
    return res.status(201).json(saved);
  } catch (error) {
    console.error("createService failed:", error);
    res.status(500).json({ message: "Error creating service" });
  }
};

export const updateService = async (req: Request, res: Response) => {
  try {
    const { service, allowed } = await findManageableService(
      String(req.params.id),
      req,
    );
    if (!service) return res.status(404).json({ message: "Service not found" });
    if (!allowed) return res.status(403).json({ message: "Forbidden" });

    const { name, description, price, duration, durationMinutes, capacity, isAvailable } =
      req.body;
    if (name !== undefined) service.name = name;
    if (description !== undefined) service.description = description;
    if (price !== undefined) service.price = price;
    if (duration !== undefined) service.duration = duration;
    if (durationMinutes !== undefined) service.durationMinutes = durationMinutes;
    if (capacity !== undefined) service.capacity = capacity;
    if (isAvailable !== undefined) service.isAvailable = isAvailable;

    const saved = await serviceRepo.save(service);
    return res.json(saved);
  } catch (error) {
    console.error("updateService failed:", error);
    res.status(500).json({ message: "Error updating service" });
  }
};

/**
 * A service with bookings is archived rather than deleted: bookings
 * reference it, so a hard delete failed with a foreign-key error, and
 * clients' booking history should keep showing what they booked.
 */
export const deleteService = async (req: Request, res: Response) => {
  try {
    const { service, allowed } = await findManageableService(
      String(req.params.id),
      req,
    );
    if (!service) return res.status(404).json({ message: "Service not found" });
    if (!allowed) return res.status(403).json({ message: "Forbidden" });

    const hasBookings = await bookingRepo.exists({
      where: { service: { id: service.id } },
    });
    if (hasBookings) {
      await serviceRepo.update(service.id, { archivedAt: new Date() });
    } else {
      await serviceRepo.remove(service);
    }
    return res.status(204).send();
  } catch (error) {
    console.error("deleteService failed:", error);
    res.status(500).json({ message: "Error deleting service" });
  }
};
