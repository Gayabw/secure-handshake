import express from "express";
import { verifyMessage } from "ethers";
import { getMappedIdentity } from "../lib/walletIdentityMap.js";

const router = express.Router();

router.get("/ping", (req, res) => {
  return res.json({
    ok: true,
    message: "demo wallet route working"
  });
});

router.post("/verify-wallet-proof", async (req, res) => {
  try {
    const { address, message, signature } = req.body;

    if (!address || !message || !signature) {
      return res.status(400).json({
        error: "address, message and signature are required"
      });
    }

    const recoveredAddress = verifyMessage(message, signature);

    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
      return res.status(401).json({
        verified: false,
        error: "Signature verification failed"
      });
    }

    const mappedIdentity = getMappedIdentity(address);

    if (!mappedIdentity) {
      return res.status(404).json({
        verified: false,
        error: "Wallet not mapped"
      });
    }

    return res.json({
      verified: true,
      address,
      recovered_address: recoveredAddress,
      mapped_identity: mappedIdentity
    });
  } catch (error) {
    return res.status(500).json({
      error: "Verification failed",
      details: error.message
    });
  }
});

export default router;