import { isTauri } from "@tauri-apps/api/core";

export function enTauri(): boolean {
  try {
    return isTauri();
  } catch {
    return false;
  }
}
