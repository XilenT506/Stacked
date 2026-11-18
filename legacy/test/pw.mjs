// Loads Playwright wherever it is installed (a project install, or the machine's global tools via NODE_PATH).
import { createRequire } from 'node:module';
export const { chromium } = createRequire(import.meta.url)('playwright');
