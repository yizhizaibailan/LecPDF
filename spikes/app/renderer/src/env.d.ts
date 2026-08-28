/// <reference types="vite/client" />

export {};

declare global {
  interface Window {
    lecSpike: {
      saveResult(value: unknown): Promise<void>;
    };
  }
}
