import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
const PARAMETERS = { cost: 16_384, blockSize: 8, parallelization: 1, keyLength: 64 } as const;

function derive(password: string, salt: Buffer, keyLength: number, options: { N: number; r: number; p: number; maxmem: number }) {
  return new Promise<Buffer>((resolve, reject) => scryptCallback(password, salt, keyLength, options, (error, value) => error ? reject(error) : resolve(value)));
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derived = await derive(password, salt, PARAMETERS.keyLength, {
    N: PARAMETERS.cost, r: PARAMETERS.blockSize, p: PARAMETERS.parallelization, maxmem: 64 * 1024 * 1024
  });
  return `scrypt$${PARAMETERS.cost}$${PARAMETERS.blockSize}$${PARAMETERS.parallelization}$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

export async function verifyPassword(password: string, encoded: string) {
  const [algorithm, costValue, blockSizeValue, parallelizationValue, saltValue, hashValue] = encoded.split("$");
  if (algorithm !== "scrypt" || !costValue || !blockSizeValue || !parallelizationValue || !saltValue || !hashValue) return false;
  const cost = Number(costValue), blockSize = Number(blockSizeValue), parallelization = Number(parallelizationValue);
  if (cost !== PARAMETERS.cost || blockSize !== PARAMETERS.blockSize || parallelization !== PARAMETERS.parallelization) return false;
  try {
    const expected = Buffer.from(hashValue, "base64url");
    const actual = await derive(password, Buffer.from(saltValue, "base64url"), expected.length, {
      N: cost, r: blockSize, p: parallelization, maxmem: 64 * 1024 * 1024
    });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch { return false; }
}
