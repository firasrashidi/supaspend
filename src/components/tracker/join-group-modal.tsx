"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

interface JoinGroupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGroupJoined: () => void;
}

export function JoinGroupModal({
  open,
  onOpenChange,
  onGroupJoined,
}: JoinGroupModalProps) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const resetForm = () => {
    setCode("");
    setError(null);
    setSuccess(false);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 6) {
      setError("Invite code must be 6 characters");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      const { error: rpcError } = await supabase.rpc("join_group_by_code", {
        code: trimmed,
      });

      if (rpcError) {
        if (rpcError.message.includes("Invalid invite code")) {
          setError("Invalid invite code. Please check and try again.");
        } else {
          throw rpcError;
        }
        return;
      }

      setSuccess(true);
      onGroupJoined();
    } catch (err) {
      console.error("Failed to join group:", err);
      setError(err instanceof Error ? err.message : "Failed to join group");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Join a group</DialogTitle>
          <DialogDescription>
            Enter the 6-character invite code shared with you.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="space-y-4 py-4">
            <div className="rounded-lg border border-border bg-green-50 p-6 text-center dark:bg-green-900/20">
              <p className="text-lg font-medium text-green-700 dark:text-green-400">
                You&apos;re in!
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                You&apos;ve successfully joined the group.
              </p>
            </div>
            <Button onClick={handleClose} className="w-full">
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="invite-code">Invite code</Label>
                <Input
                  id="invite-code"
                  placeholder="e.g. A3BX9K"
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.toUpperCase().slice(0, 6))
                  }
                  disabled={loading}
                  required
                  autoFocus
                  maxLength={6}
                  className="text-center font-mono text-2xl tracking-[0.3em]"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading || code.trim().length !== 6}
              >
                {loading ? "Joining..." : "Join group"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
