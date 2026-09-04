import { scryptSync, randomBytes, timingSafeEqual } from "crypto";

const SCRYPT_OPTS = { N: 16384, r: 8, p: 1 } as const;
const KEYLEN = 64;

// Stored format: scrypt$<saltHex>$<hashHex>
// (This exact format/params is what the director's initial password was
// seeded with directly in the database — keep them in sync.)

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEYLEN, SCRYPT_OPTS);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[1], "hex");
  const expected = Buffer.from(parts[2], "hex");
  const actual = scryptSync(password, salt, KEYLEN, SCRYPT_OPTS);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export function randomTempPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  return Array.from(randomBytes(12))
    .map((b) => alphabet[b % alphabet.length])
    .join("");
}
