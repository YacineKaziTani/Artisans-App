import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCreateReport } from "@/hooks/useReports";
import type { ReportTargetType } from "@/types";

export function ReportDialog({
  targetType,
  targetId,
  targetLabel,
  open,
  onOpenChange,
}: {
  targetType: ReportTargetType;
  targetId: string;
  targetLabel?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [reason, setReason] = useState("");
  const createReport = useCreateReport();

  const handleClose = (next: boolean) => {
    if (!next) {
      setReason("");
      createReport.reset();
    }
    onOpenChange(next);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    createReport.mutate(
      { targetType, targetId, targetLabel, reason: reason.trim() },
      { onSuccess: () => handleClose(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report {targetLabel ?? targetType}</DialogTitle>
          <DialogDescription>
            Let us know what's wrong — an admin will review this.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {createReport.isError && (
            <div className="p-3 bg-red-100 border border-red-300 rounded-lg text-red-800 text-sm">
              Couldn't submit your report. Please try again.
            </div>
          )}
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="What's the issue?"
            rows={4}
            required
          />
          <Button
            type="submit"
            className="w-full"
            disabled={createReport.isPending || !reason.trim()}
          >
            {createReport.isPending ? "Submitting..." : "Submit Report"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
