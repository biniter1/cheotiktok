import { mockBackend } from './mock';
import { realBackend } from './real';

export const isMock = import.meta.env.VITE_MOCK === '1';
export const backend = isMock ? mockBackend : realBackend;
