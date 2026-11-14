import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Fusionne des classes Tailwind en résolvant les conflits (convention shadcn/ui). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Copie superficielle sans les clés dont la valeur est `undefined` (paramètres d'URL, filtres). */
export function compact<T extends Record<string, unknown>>(input: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && !(Array.isArray(value) && value.length === 0)) {
      (out as Record<string, unknown>)[key] = value;
    }
  }
  return out;
}
