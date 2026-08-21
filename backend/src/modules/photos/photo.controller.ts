import { Request, Response } from "express";
import { v2 as cloudinary } from "cloudinary";
import { AppDataSource } from "../../data-source";
import { Photo } from "./photo.entities";
import { Shop } from "../shop/shop.entities";

const photoRepo = AppDataSource.getRepository(Photo);
const shopRepo = AppDataSource.getRepository(Shop);

// Multer's Cloudinary storage attaches a public_id to req.file at runtime
// under the `filename` field — same shape as disk storage, just optional here.
interface CloudinaryFile extends Omit<Express.Multer.File, "filename"> {
  filename?: string;
}

// Upload an image to Cloudinary and attach it to the logged-in artisan's shop.
export const uploadPhoto = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const file = req.file as CloudinaryFile | undefined;
    if (!file?.path) {
      return res.status(400).json({ message: "No image file provided" });
    }

    const shop = await shopRepo.findOne({ where: { owner: { id: userId } } });
    if (!shop) {
      return res.status(404).json({ message: "You don't have a shop yet" });
    }

    const photo = photoRepo.create({
      url: file.path,
      publicId: file.filename,
      caption: req.body.caption,
      shop,
    });
    const saved = await photoRepo.save(photo);

    return res.status(201).json(saved);
  } catch (error) {
    return res.status(500).json({ message: "Failed to upload photo", error });
  }
};

// Photos on the logged-in artisan's own shop
export const getMyPhotos = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const shop = await shopRepo.findOne({ where: { owner: { id: userId } } });
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    const photos = await photoRepo.find({
      where: { shop: { id: shop.id } },
      order: { createdAt: "DESC" },
    });
    return res.json(photos);
  } catch (error) {
    return res.status(500).json({ message: "Error fetching photos", error });
  }
};

// Delete a photo owned by the logged-in artisan (also removes it from Cloudinary)
export const deletePhoto = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const id = String(req.params.id);

    const photo = await photoRepo.findOne({
      where: { id },
      relations: ["shop", "shop.owner"],
    });
    if (!photo) return res.status(404).json({ message: "Photo not found" });
    if (photo.shop.owner.id !== userId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (photo.publicId) {
      try {
        await cloudinary.uploader.destroy(photo.publicId);
      } catch {
        // Non-fatal — still remove the DB record even if Cloudinary cleanup fails
      }
    }

    await photoRepo.remove(photo);
    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ message: "Error deleting photo", error });
  }
};
