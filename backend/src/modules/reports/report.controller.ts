import { Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import { Report, ReportStatus, ReportTargetType } from "./report.entities";
import { User } from "../users/entities/user.entities";
import { Shop } from "../shop/shop.entities";
import { Product } from "../products/product.entities";
import { Service } from "../services/service.entities";
import { Review } from "../reviews/review.entities";
import {
  pageResult,
  parsePagination,
  queryString,
} from "../../middleware/validate.middleware";

// Request bodies are validated by the zod schemas in report.schemas.ts.

const reportRepo = AppDataSource.getRepository(Report);

const LABEL_MAX = 120;

function truncate(text: string, max = LABEL_MAX) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * Looks the reported item up and builds the label admins see. This used to
 * be whatever text the reporter sent, so a report could misdescribe its
 * target; it also confirms the target exists.
 */
async function describeTarget(
  type: ReportTargetType,
  id: string,
): Promise<string | null> {
  switch (type) {
    case ReportTargetType.SHOP: {
      const shop = await AppDataSource.getRepository(Shop).findOne({ where: { id } });
      return shop ? truncate(shop.shopName) : null;
    }
    case ReportTargetType.PRODUCT: {
      const product = await AppDataSource.getRepository(Product).findOne({
        where: { id },
        relations: ["shop"],
      });
      return product
        ? truncate(`${product.title} (${product.shop.shopName})`)
        : null;
    }
    case ReportTargetType.SERVICE: {
      const service = await AppDataSource.getRepository(Service).findOne({
        where: { id },
        relations: ["shop"],
      });
      return service
        ? truncate(`${service.name} (${service.shop.shopName})`)
        : null;
    }
    case ReportTargetType.REVIEW: {
      const review = await AppDataSource.getRepository(Review).findOne({
        where: { id },
        relations: ["shop"],
      });
      if (!review) return null;
      const excerpt = review.comment ? ` — “${review.comment}”` : "";
      return truncate(`${review.rating}★ review of ${review.shop.shopName}${excerpt}`);
    }
    default:
      return null;
  }
}

export const createReport = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { targetType, targetId, reason } = req.body as {
      targetType: ReportTargetType;
      targetId: string;
      reason: string;
    };

    const targetLabel = await describeTarget(targetType, targetId);
    if (targetLabel === null) {
      return res
        .status(404)
        .json({ message: "That item no longer exists" });
    }

    const alreadyOpen = await reportRepo.exists({
      where: {
        targetType,
        targetId,
        reporter: { id: userId },
        status: ReportStatus.PENDING,
      },
    });
    if (alreadyOpen) {
      return res.status(409).json({
        message: "You've already reported this — an admin will review it soon",
      });
    }

    const saved = await reportRepo.save(
      reportRepo.create({
        targetType,
        targetId,
        targetLabel,
        reason,
        reporter: { id: userId } as User,
      }),
    );
    return res.status(201).json(saved);
  } catch (error) {
    console.error("createReport failed:", error);
    return res.status(500).json({ message: "Error submitting report" });
  }
};

export const getMyReports = async (req: Request, res: Response) => {
  try {
    const reports = await reportRepo.find({
      where: { reporter: { id: req.user!.id } },
      order: { createdAt: "DESC" },
    });
    return res.json(reports);
  } catch (error) {
    console.error("getMyReports failed:", error);
    return res.status(500).json({ message: "Error fetching reports" });
  }
};

export const getAllReportsAdmin = async (req: Request, res: Response) => {
  try {
    const status = queryString(req.query.status) as ReportStatus | undefined;
    const where =
      status && Object.values(ReportStatus).includes(status) ? { status } : {};
    const { page, take, skip } = parsePagination(req.query, {
      defaultLimit: 25,
      maxLimit: 100,
    });
    const [reports, total] = await reportRepo.findAndCount({
      where,
      relations: ["reporter"],
      order: { createdAt: "DESC", id: "ASC" },
      skip,
      take,
    });
    return res.json(pageResult(reports, total, page, take));
  } catch (error) {
    console.error("getAllReportsAdmin failed:", error);
    return res.status(500).json({ message: "Error fetching reports" });
  }
};

export const resolveReport = async (req: Request, res: Response) => {
  try {
    const { status, adminNote } = req.body as {
      status: ReportStatus;
      adminNote?: string;
    };

    const report = await reportRepo.findOne({
      where: { id: String(req.params.id) },
    });
    if (!report) return res.status(404).json({ message: "Report not found" });

    report.status = status;
    if (adminNote !== undefined) report.adminNote = adminNote;

    const saved = await reportRepo.save(report);
    return res.json(saved);
  } catch (error) {
    console.error("resolveReport failed:", error);
    return res.status(500).json({ message: "Error resolving report" });
  }
};
