// Buffer for the Solana libraries in the browser (imported first by entry.mjs)
import { Buffer } from "buffer";
if (typeof globalThis.Buffer === "undefined") globalThis.Buffer = Buffer;
