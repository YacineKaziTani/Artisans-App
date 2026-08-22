import { Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import { Report, ReportStatus, ReportTargetType } from "./report.entities";
import { User } from "../users/entities/user.entities";

const reportRepo = AppDataSource.getRepository(Report);

export const createReport = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { targetType, targetId, targetLabel, reason } = req.body;

    if (!Object.values(ReportTargetType).includes(targetType)) {
      return res.status(400).json({ message: "Invalid targetType" });
    }
    if (!targetId || !reason?.trim()) {
      return res
        .status(400)
        .json({ message: "targetId and reason are required" });
    }

    const report = reportRepo.create({
      targetType,
      targetId,
      targetLabel,
      reason: reason.trim(),
      reporter: { id: userId } as User,
    });
    const saved = await reportRepo.save(report);

    return res.status(201).json(saved);
  } catch (error) {
    return res.status(500).json({ message: "Error submitting report", error });
  }
};

export const getMyReports = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const reports = await reportRepo.find({
      where: { reporter: { id: userId } },
      order: { createdAt: "DESC" },
    });
    return res.json(reports);
  } catch (error) {
    return res.status(500).json({ message: "Error fetching reports", error });
  }
};

export const getAllReportsAdmin = async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const where = status ? { status: status as ReportStatus } : {};
    const reports = await reportRepo.find({
      where,
      relations: ["reporter"],
      order: { createdAt: "DESC" },
    });
    return res.json(reports);
  } catch (error) {
    return res.status(500).json({ message: "Error fetching reports", error });
  }
};

export const resolveReport = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { status, adminNote } = req.body;

    if (!Object.values(ReportStatus).includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const report = await reportRepo.findOne({ where: { id } });
    if (!report) return res.status(404).json({ message: "Report not found" });

    report.status = status;
    if (adminNote !== undefined) report.adminNote = adminNote;

    const saved = await reportRepo.save(report);
    return res.json(saved);
  } catch (error) {
    return res.status(500).json({ message: "Error resolving report", error });
  }
};
