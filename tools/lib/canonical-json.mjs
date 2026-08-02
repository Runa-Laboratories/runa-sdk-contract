import { createHash } from "node:crypto";

export function canonicalJson(value) {
  if (value === null || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "string") return canonicalString(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Canonical JSON forbids non-finite numbers.");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) =>
      `${canonicalString(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  throw new TypeError(`Canonical JSON cannot encode ${typeof value}.`);
}

function canonicalString(value) {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        throw new TypeError("Canonical JSON forbids lone Unicode surrogates.");
      }
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      throw new TypeError("Canonical JSON forbids lone Unicode surrogates.");
    }
  }
  return JSON.stringify(value);
}

export const canonicalBytes = (value) => Buffer.from(canonicalJson(value), "utf8");
export const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
