import nacl from "tweetnacl";
import { encodeBase64, decodeBase64 } from "tweetnacl-util";

// Generate a new keypair (for a first-time join)
export function generateKeyPair() {
    return nacl.sign.keyPair();
}

// Sign a message (e.g. challenge nonce)
export function signMessage(message: Uint8Array, secretKey: Uint8Array) {
    return nacl.sign.detached(message, secretKey);
}

// Decode a base64 challenge from the server
export function decodeChallenge(challenge: string): Uint8Array {
    return decodeBase64(challenge);
}

// Export key as base64 (for sending to server)
export function exportPublicKey(key: Uint8Array): string {
    return encodeBase64(key);
}

// Export signature as base64
export function exportSignature(sig: Uint8Array): string {
    return encodeBase64(sig);
}
