import { supabase } from "@/lib/supabase";
import type { PostgrestError } from "@supabase/supabase-js";

type DeliveryReceiptWrite = {
  conversation_id: string;
  message_id: string;
  user_id: string;
  delivered_at?: string;
};

type ReadReceiptWrite = {
  conversation_id: string;
  user_id: string;
  last_read_message_id: string;
  last_read_at: string;
};

const isMissingOnConflictConstraint = (error: PostgrestError): boolean =>
  error.code === "42P10" ||
  /no unique or exclusion constraint matching the ON CONFLICT specification/i.test(
    error.message ?? "",
  );

const isDuplicateKey = (error: PostgrestError): boolean =>
  error.code === "23505" ||
  /duplicate key value violates unique constraint/i.test(error.message ?? "");

// Cache whether the DB supports our preferred ON CONFLICT keys to avoid spamming 400s.
let deliveryReceiptsHaveConstraint: boolean | null = null;
let readReceiptsHaveConstraint: boolean | null = null;

/**
 * Writes a delivery receipt for a given (conversation_id, message_id, user_id).
 *
 * Preferred path uses upsert + onConflict (requires a UNIQUE constraint on those columns).
 * If the DB doesn't have that constraint, falls back to insert to keep the app functional.
 */
export const writeDeliveryReceipt = async (row: DeliveryReceiptWrite): Promise<void> => {
  // Try upsert first if we haven't proven the constraint is missing.
  if (deliveryReceiptsHaveConstraint !== false) {
    const { error } = await supabase
      .from("message_delivery_receipts")
      .upsert(row, { onConflict: "conversation_id,message_id,user_id" });

    if (!error) {
      deliveryReceiptsHaveConstraint = true;
      return;
    }

    if (isMissingOnConflictConstraint(error)) {
      deliveryReceiptsHaveConstraint = false;
      // fallthrough to insert
    } else {
      console.error("[writeDeliveryReceipt] Failed to write delivery receipt", error);
      return;
    }
  }

  const { error: insertError } = await supabase.from("message_delivery_receipts").insert(row);
  if (insertError && !isDuplicateKey(insertError)) {
    console.error("[writeDeliveryReceipt] Failed to insert delivery receipt", insertError);
  }
};

/**
 * Writes / updates a read receipt for a given (conversation_id, user_id).
 *
 * Preferred path uses upsert + onConflict (requires a UNIQUE constraint on those columns).
 * If the DB doesn't have that constraint, falls back to insert. Client-side logic already
 * dedupes by most-recent last_read_at.
 */
export const writeReadReceipt = async (row: ReadReceiptWrite): Promise<void> => {
  if (readReceiptsHaveConstraint !== false) {
    const { error } = await supabase
      .from("message_read_receipts")
      .upsert(row, { onConflict: "conversation_id,user_id" });

    if (!error) {
      readReceiptsHaveConstraint = true;
      return;
    }

    if (isMissingOnConflictConstraint(error)) {
      readReceiptsHaveConstraint = false;
      // fallthrough to insert
    } else {
      console.error("[writeReadReceipt] Failed to write read receipt", error);
      return;
    }
  }

  const { error: insertError } = await supabase.from("message_read_receipts").insert(row);
  if (insertError && !isDuplicateKey(insertError)) {
    console.error("[writeReadReceipt] Failed to insert read receipt", insertError);
  }
};

/**
 * Clears the read receipt for a conversation (best effort).
 *
 * Preferred path: DELETE the receipt row. If DELETE is blocked by RLS,
 * fall back to writing an "epoch" receipt with a NULL message id.
 */
export const clearReadReceipt = async (
  conversationId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; error: PostgrestError }> => {
  const { error: deleteError } = await supabase
    .from("message_read_receipts")
    .delete()
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);

  if (!deleteError) return { ok: true };

  // Fallback: attempt to upsert an epoch read receipt with NULL last_read_message_id.
  const epochRow = {
    conversation_id: conversationId,
    user_id: userId,
    last_read_message_id: null,
    last_read_at: new Date(0).toISOString(),
  } as any;

  const { error: upsertError } = await supabase
    .from("message_read_receipts")
    .upsert(epochRow, { onConflict: "conversation_id,user_id" });

  if (!upsertError) return { ok: true };

  if (isMissingOnConflictConstraint(upsertError)) {
    const { error: insertError } = await supabase.from("message_read_receipts").insert(epochRow);
    if (!insertError || isDuplicateKey(insertError)) return { ok: true };
    return { ok: false, error: insertError };
  }

  return { ok: false, error: upsertError };
};
