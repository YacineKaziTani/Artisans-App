import { Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import { Service } from "./service.entities";
import { Shop } from "../shop/shop.entities";
import { UserRole } from "../users/entities/user.entities";

const serviceRepo = AppDataSource.getRepository(Service);
const shopRepo = AppDataSource.getRepository(Shop);

async function getOwnShop(userId: string) {
  return shopRepo.findOne({ where: { owner: { id: userId } } });
}

// Fetch all services (public)
export const getAllServices = async (req: Request, res: Response) => {
  try {
    const services = await serviceRepo.find({
      relations: ["shop"],
    });
    res.json(services);
  } catch (error) {
    res.status(500).json({ message: "Error fetching services", error });
  }
};

// Create a service under the logged-in artisan's own shop
export const createService = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { name, description, price, duration } = req.body;

    if (!name || price === undefined) {
      return res
        .status(400)
        .json({ message: "name and price are required" });
    }

    const shop = await getOwnShop(userId);
    if (!shop) {
      return res
        .status(404)
        .json({ message: "You don't have a shop yet" });
    }

    const service = serviceRepo.create({
      name,
      description,
      price,
      duration,
      shop,
    });
    const saved = await serviceRepo.save(service);

    return res.status(201).json(saved);
  } catch (error) {
    res.status(500).json({ message: "Error creating service", error });
  }
};

// Update a service owned by the logged-in artisan
export const updateService = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const id = String(req.params.id);
    const { name, description, price, duration, isAvailable } = req.body;

    const service = await serviceRepo.findOne({
      where: { id },
      relations: ["shop", "shop.owner"],
    });
    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }
    if (service.shop.owner.id !== userId && req.user!.role !== UserRole.SUPER_ADMIN) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (name !== undefined) service.name = name;
    if (description !== undefined) service.description = description;
    if (price !== undefined) service.price = price;
    if (duration !== undefined) service.duration = duration;
    if (isAvailable !== undefined) service.isAvailable = isAvailable;

    const saved = await serviceRepo.save(service);
    return res.json(saved);
  } catch (error) {
    res.status(500).json({ message: "Error updating service", error });
  }
};

// Delete a service owned by the logged-in artisan
export const deleteService = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const id = String(req.params.id);

    const service = await serviceRepo.findOne({
      where: { id },
      relations: ["shop", "shop.owner"],
    });
    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }
    if (service.shop.owner.id !== userId && req.user!.role !== UserRole.SUPER_ADMIN) {
      return res.status(403).json({ message: "Forbidden" });
    }

    await serviceRepo.remove(service);
    return res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: "Error deleting service", error });
  }
};
