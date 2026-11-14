import 'server-only';
import { cookies } from 'next/headers';
import { parsePrefs, type Prefs } from './prefs';

export async function readPrefs(): Promise<Prefs> {
  const store = await cookies();
  return parsePrefs((name) => store.get(name)?.value);
}
