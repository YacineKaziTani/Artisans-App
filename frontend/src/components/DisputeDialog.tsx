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
import { useCreateDispute } from "@/hooks/useDisputes";
import type { DisputeTargetType } from "@/types";

export function DisputeDialog({
  targetType,
  targetId,
  open,
  onOpenChange,
}: {
  targetType: DisputeTargetType;
  targetId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [reason, setReason] = useState("");
  const createDispute = useCreateDispute();

  const handleClose = (next: boolean) => {
    if (!next) {
      setReason("");
      createDispute.reset();
    }
    onOpenChange(next);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    createDispute.mutate(
      { targetType, targetId, reason: reason.trim() },
      { onSuccess: () => handleClose(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Open a Dispute</DialogTitle>
          <DialogDescription>
            An admin will review this and may issue a refund. This isn't
            instant — describe what went wrong in detail.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {createDispute.isError && (
            <div className="p-3 bg-red-100 border border-red-300 rounded-lg text-red-800 text-sm">
              Couldn't open the dispute. It may already have one open.
            </div>
          )}
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="What went wrong?"
            rows={4}
            required
          />
          <Button
            type="submit"
            className="w-full"
            disabled={createDispute.isPending || !reason.trim()}
          >
            {createDispute.isPending ? "Submitting..." : "Open Dispute"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
