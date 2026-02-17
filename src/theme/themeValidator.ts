import type { ThemePack } from "./themeTypes";

type ValidationResult = {
  ok: boolean;
  errors: string[];
};

function isObject(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null;
}

function requireKeys(parent: Record<string, unknown>, keys: string[], prefix: string, errors: string[]): void {
  for (const key of keys) {
    if (!(key in parent)) {
      errors.push(`missing ${prefix}.${key}`);
    }
  }
}

export function validateThemePack(theme: ThemePack): ValidationResult {
  const errors: string[] = [];
  const root = theme as unknown;

  if (!isObject(root)) {
    return { ok: false, errors: ["theme must be an object"] };
  }

  if (!("id" in root)) {
    errors.push("missing id");
  }

  const sections = ["palette", "typography", "motion", "fx", "audioMix"] as const;
  for (const section of sections) {
    const value = root[section];
    if (!isObject(value)) {
      errors.push(`missing ${section}`);
      continue;
    }

    switch (section) {
      case "palette":
        requireKeys(value, ["background", "surface", "primary", "accent", "text"], section, errors);
        break;
      case "typography":
        requireKeys(value, ["display", "body", "mono"], section, errors);
        break;
      case "motion":
        requireKeys(value, ["speedMultiplier", "easing"], section, errors);
        break;
      case "fx":
        requireKeys(value, ["glow", "grain", "scanlines"], section, errors);
        break;
      case "audioMix":
        requireKeys(value, ["music", "sfx", "voice"], section, errors);
        break;
      default:
        break;
    }
  }

  return { ok: errors.length === 0, errors };
}
