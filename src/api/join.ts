import axios from "axios";
import {
    exportPublicKey,
    signMessage,
    exportSignature,
    decodeChallenge,
} from "../utils/crypto";
import nacl from "tweetnacl";

export async function joinServer(
    serverUrl: string,
    username: string,
    nickname: string,
    inviteCode: string,
    keypair: nacl.SignKeyPair,
): Promise<{
    success: boolean;
    userId?: string;
    error?: string;
    serverInfo?: {
        name?: string;
        description?: string;
        allow_invite?: boolean;
        max_users?: number;
        icon?: string;
    };
}> {
    try {
        // Step 1: Send public key, username, nickname, and invite code
        const joinRes = await axios.post(`${serverUrl}/join`, {
            username,
            nickname,
            public_key: exportPublicKey(keypair.publicKey),
            invite_code: inviteCode,
        });

        const challengeBase64 = joinRes.data.challenge;
        const serverMetadata = joinRes.data.server;
        const challenge = decodeChallenge(challengeBase64);

        // Step 2: Sign challenge
        const signature = signMessage(challenge, keypair.secretKey);

        // Step 3: Send signature
        const authRes = await axios.post(`${serverUrl}/auth`, {
            username,
            signature: exportSignature(signature),
        });

        return {
            success: true,
            userId: authRes.data.user_id,
            serverInfo: {
                name: serverMetadata?.name,
                description: serverMetadata?.description,
                allow_invite: serverMetadata?.allow_invite,
                max_users: serverMetadata?.max_users,
                icon: serverMetadata?.icon,
            },
        };
    } catch (err: unknown) {
        return {
            success: false,
            error:
                err instanceof Error
                    ? err.message
                    : "An unknown error occurred",
        };
    }
}
