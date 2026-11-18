// tools/agent-entry.mjs → lib/_agentkit.mjs: what the city's agent (lib/_agent.mjs) needs on the server to launch its
// hourly drop from its own wallet — the same launch transactions the page signs (create_v2 + the locked fee split),
// paying out its coins' waiting creator fees, and sending SOL on to THE VAULT.
// Built with HOMEPAD's tools/pump-kit (its node_modules): copy this file there and run
//   esbuild agent-entry.mjs --bundle --minify --format=esm --platform=node --target=node20 --outfile=<dropcity>/lib/_agentkit.mjs (+ the createRequire banner)
import { Connection, PublicKey, Keypair, Transaction, VersionedTransaction, AddressLookupTableAccount, SystemProgram, ComputeBudgetProgram } from "@solana/web3.js";
import { OnlinePumpSdk, PUMP_SDK, feeSharingConfigPda } from "@pump-fun/pump-sdk";
import { launchTxs, distributeTx, splitTx, launchV0, buyTx, feeVaultOf, qOf, sharedAddresses, lutCreateTx, lutOf } from "./entry.mjs";

export async function sharingOf(connection, mint) {
  const a = await connection.getAccountInfo(feeSharingConfigPda(new PublicKey(mint)));
  return a ? PUMP_SDK.decodeSharingConfig(a) : null;
}
export function keypairOf(secret) {
  const s = String(secret || "").trim();
  if (!s) return null;
  if (s.startsWith("[")) return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(s)));
  const A = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let n = 0n; for (const ch of s) { const i = A.indexOf(ch); if (i < 0) throw new Error("bad key"); n = n * 58n + BigInt(i); }
  const out = []; while (n > 0n) { out.unshift(Number(n & 255n)); n >>= 8n; }
  for (const ch of s) { if (ch !== "1") break; out.unshift(0); }
  return Keypair.fromSecretKey(Uint8Array.from(out));
}
export function sendSolTx({ from, to, lamports, blockhash }) {
  const t = new Transaction(); t.feePayer = from; t.recentBlockhash = blockhash;
  t.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50000 }), SystemProgram.transfer({ fromPubkey: from, toPubkey: to, lamports }));
  return t;
}
/// every waiting creator fee of `creator`, in every quote and on the AMM too, collected to the creator (pump.fun
/// refuses to move a curve's creator to a fee-sharing config while any of them holds fees: error 6095) — null if none
export async function sweepTx(connection, creator, blockhash, cuPrice = 100000) {
  const ixs = await new OnlinePumpSdk(connection).collectCoinCreatorFeeAllQuotesInstructions(creator);
  if (!ixs.length) return null;
  const t = new Transaction(); t.feePayer = creator; t.recentBlockhash = blockhash;
  t.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 300000 }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: cuPrice }), ...ixs);
  return t;
}
/// a transaction's simulation without signatures → { err, logs }
export async function simulate(connection, tx) {
  const v = new VersionedTransaction(tx.compileMessage());
  const r = await connection.simulateTransaction(v, { sigVerify: false, replaceRecentBlockhash: true });
  return { err: r.value.err, logs: r.value.logs || [] };
}
export { Connection, PublicKey, Keypair, AddressLookupTableAccount, OnlinePumpSdk, launchTxs, distributeTx, splitTx, launchV0, buyTx, feeVaultOf, qOf, sharedAddresses, lutCreateTx, lutOf, PUMP_SDK, feeSharingConfigPda };
