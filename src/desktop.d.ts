export {};

declare global {
  interface Window {
    mardenDesktop?: {
      onOpenMarkdown: (listener: (file: { name: string; content: string }) => void) => () => void;
    };
  }
}
