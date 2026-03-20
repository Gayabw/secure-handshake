import { getActiveBlockState } from "./autoBlockService.js";

export async function assertNodeNotBlocked({
  user_id,
  user_key_id,
}) {
  const state = await getActiveBlockState({
    user_id,
    user_key_id,
  });

  if (!state.blocked) return;

  const error = new Error("Node is currently blocked by enforcement policy");
  error.statusCode = 403;
  error.code = "NODE_BLOCKED";
  error.details = {
    reason: state.block?.reason ?? "BLOCKED",
    valid_until: state.block?.valid_until ?? null,
    access_list_id: state.block?.access_list_id ?? null,
  };

  throw error;
}