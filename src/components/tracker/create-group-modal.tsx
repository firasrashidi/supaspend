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

interface CreateGroupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGroupCreated: () => void;
}

export function CreateGroupModal({
  open,
  onOpenChange,
  onGroupCreated,
}: CreateGroupModalProps) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  const resetForm = () => {
    setName("");
    setError(null);
    setCreatedCode(null);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Not authenticated");

      // Insert the group — the DB trigger auto-generates the invite code
      // and adds the creator as owner
      const { error: insertError } = await supabase
        .from("groups")
        .insert({ name: name.trim(), created_by: user.id, invite_code: "TEMP" });

      if (insertError) throw insertError;

      // Fetch the newly created group (now visible via RLS since the
      // after-insert trigger added us as a member)
      const { data: newGroup, error: fetchError } = await supabase
        .from("groups")
        .select("invite_code")
        .eq("created_by", user.id)
        .eq("name", name.trim())
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (fetchError) throw fetchError;

      setCreatedCode(newGroup.invite_code);
      onGroupCreated();
    } catch (err) {
      console.error("Failed to create group:", err);
      setError(err instanceof Error ? err.message : "Failed to create group");
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    if (createdCode) {
      navigator.clipboard.writeText(createdCode);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Create a group</DialogTitle>
          <DialogDescription>
            Create a private group and share the invite code with others.
          </DialogDescription>
        </DialogHeader>

        {createdCode ? (
          <div className="space-y-4 py-4">
            <div className="rounded-lg border border-border bg-muted/50 p-6 text-center">
              <p className="mb-2 text-sm text-muted-foreground">
                Your invite code
              </p>
              <p className="font-mono text-3xl font-bold tracking-widest">
                {createdCode}
              </p>
            </div>
            <p className="text-center text-sm text-muted-foreground">
              Share this code with people you want to invite to{" "}
              <span className="font-medium text-foreground">{name}</span>.
            </p>
            <div className="flex gap-2">
              <Button onClick={copyCode} variant="outline" className="flex-1">
                Copy code
              </Button>
              <Button onClick={handleClose} className="flex-1">
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="group-name">Group name</Label>
                <Input
                  id="group-name"
                  placeholder="e.g. Family, Roommates, Travel Fund"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                  required
                  autoFocus
                />
              </div>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
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
              <Button type="submit" disabled={loading || !name.trim()}>
                {loading ? "Creating..." : "Create group"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
