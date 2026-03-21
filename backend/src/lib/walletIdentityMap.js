export const walletIdentityMap = Object.freeze({
  "0x90aaf70551bcfaea7482dbaffaa2eaa6bc90609d": {
    user_id: 1,
    user_key_id: 1,
    node_label: "Node A - Initiator",
  },
  "0xc319523c206df745d40544447f6ac2d294699d66": {
    user_id: 2,
    user_key_id: 2,
    node_label: "Node B - Responder",
  },
});

export function getMappedIdentity(address) {
  if (!address || typeof address !== "string") {
    return null;
  }

  return walletIdentityMap[address.toLowerCase()] || null;
}