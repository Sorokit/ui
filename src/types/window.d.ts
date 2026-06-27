export {};

declare global {
  interface Window {
    freighter: {
      requestAccess: () => Promise<{ error?: string }>;
      getPublicKey: () => Promise<string>;
    };
    xBull: {
      requestPublicKey: () => Promise<string>;
    };
    albedo: {
      publicKey: () => Promise<{ publicKey: string }>;
    };
  }
}
