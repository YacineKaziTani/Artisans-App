import { Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import { Service } from "./service.entities";

//creating new servie
export const createService = async (req: Request, res: Response) => {
  try {
    const { name, description, price, shopId } = req.body;
    const serviceRepo = AppDataSource.getRepository(Service);
    const newService = serviceRepo.create({
      name,
      description,
      price,
      shop: { id: shopId },
    });
    await serviceRepo.save(newService);
  } catch (error) {
    res.status(500).json({ msg: "Error creating service", error });
  }
};
//fetching  serivices
export const getAllServices = async (req: Request, res: Response) => {
  try {
    const serviceRepo = AppDataSource.getRepository(Service);
    const services = await serviceRepo.find({
      relations: ["shop"],
    });
    res.json(services);
  } catch (error) {
    res.status(500).json({ message: "Error fetching services" });
  }
};
