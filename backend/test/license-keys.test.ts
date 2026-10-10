import { describe, expect, it } from "vitest";
import { generateLicenseKey, hashLicenseKey } from "../src/usage/licenseKeys";

describe("license key primitives", () => {
  it("generates opaque keys with 256 bits of randomness", () => {
    const first = generateLicenseKey();
    const second = generateLicenseKey();

    expect(first).toMatch(/^vichar_[A-Za-z0-9_-]{43}$/);
    expect(second).toMatch(/^vichar_[A-Za-z0-9_-]{43}$/);
    expect(first).not.toBe(second);
  });

  it("hashes valid keys deterministically without returning the plaintext", async () => {
    const key = generateLicenseKey();
    const hash = await hashLicenseKey(key);

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain(key);
    expect(await hashLicenseKey(key)).toBe(hash);
  });

  it("rejects malformed keys", async () => {
    expect(await hashLicenseKey("")).toBeNull();
    expect(await hashLicenseKey("vichar_short")).toBeNull();
    expect(await hashLicenseKey("VICHAR_" + "a".repeat(43))).toBeNull();
  });
});
