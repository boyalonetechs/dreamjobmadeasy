export {};

declare global {
  interface PaystackPopInstance {
    newTransaction: (options: Record<string, unknown>) => void;
    resumeTransaction: (
      accessCode: string,
      callbacks?: Record<string, unknown>,
    ) => void;
  }

  interface PaypalRenderable {
    render: (el: HTMLElement | null) => Promise<void>;
  }

  interface Window {
    PaystackPop?: new () => PaystackPopInstance;
    paypal?: {
      Buttons: (cfg: Record<string, unknown>) => PaypalRenderable;
      FUNDING?: {
        PAYPAL: string;
        CARD: string;
        [key: string]: string;
      };
    };
  }
}
