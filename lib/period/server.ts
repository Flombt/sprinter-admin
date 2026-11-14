import 'server-only';
import { createLoader } from 'nuqs/server';
import { periodParsers } from './parsers';

export const loadPeriodParams = createLoader(periodParsers);
