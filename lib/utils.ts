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

export interface ParsedGuest {
  id?: string;
  name?: string;
  gender?: string;
  age?: string;
  arrival_date?: string;
  arrival_time?: string;
  departure_date?: string;
  departure_time?: string;
}

export interface ParsedFoodReservation {
  id?: string;
  date?: string;
  meal_type?: "Breakfast" | "Lunch" | "Dinner";
  head_count?: number | string;
  notes?: string;
}

export function parseGuests(value: string | null | undefined) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as ParsedGuest[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function parseFoodReservations(value: string | null | undefined) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as ParsedFoodReservation[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
