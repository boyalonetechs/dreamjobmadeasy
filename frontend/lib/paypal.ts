const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "";

export function paypalClientId() {
  return PAYPAL_CLIENT_ID;
}

let loader: Promise<void> | null = null;

// Injects the PayPal JS SDK once, enabling the buttons component. Safe to
// call from multiple components.
export function loadPaypal(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.paypal?.Buttons) return Promise.resolve();
  if (!PAYPAL_CLIENT_ID) {
    return Promise.reject(new Error("PayPal is not configured."));
  }
  if (loader) return loader;

  loader = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      "script[data-paypal-sdk]",
    );
    const done = () => {
      if (window.paypal?.Buttons) resolve();
      else reject(new Error("PayPal SDK failed to load."));
    };
    if (existing) {
      existing.addEventListener("load", done);
      existing.addEventListener("error", () =>
        reject(new Error("PayPal SDK failed to load.")),
      );
      if (window.paypal?.Buttons) resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&currency=USD&intent=capture&components=buttons`;
    script.async = true;
    script.dataset.paypalSdk = "1";
    script.onload = done;
    script.onerror = () => reject(new Error("PayPal SDK failed to load."));
    document.body.appendChild(script);
  });
  return loader;
}
