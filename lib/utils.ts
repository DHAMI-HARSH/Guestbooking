import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseServices(value: string) {
  try {
    return JSON.parse(value) as string[];
  } catch {
    return [];
  }
}
