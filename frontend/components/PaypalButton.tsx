"use client";
import { useEffect, useRef, useState } from "react";
import { Loader } from "lucide-react";
import { api } from "@/lib/api";
import { loadPaypal, paypalClientId } from "@/lib/paypal";

// Renders PayPal's own PayPal button.
//
// The frontend drives the checkout UI; the backend creates the order, captures
// it, and verifies it before unlocking. If no client id is configured it falls
// back to a hosted approval redirect.
export default function PaypalButton({
  token,
  amountLabel,
  onSuccess,
  onError,
}: {
  token: string;
  amountLabel: string;
  onSuccess: () => void;
  onError: (message: string) => void;
}) {
  const buttonsRef = useRef<HTMLDivElement>(null);
  const renderedTokenRef = useRef<string | null>(null);
  const successRef = useRef(onSuccess);
  const errorRef = useRef(onError);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checkoutActive, setCheckoutActive] = useState(false);

  useEffect(() => {
    successRef.current = onSuccess;
    errorRef.current = onError;
  });

  // When the checkout opens in a popup, our window regains focus once the
  // buyer closes it — bring the buttons back then.
  useEffect(() => {
    if (!checkoutActive) return;
    const restore = () => setCheckoutActive(false);
    window.addEventListener("focus", restore);
    return () => window.removeEventListener("focus", restore);
  }, [checkoutActive]);

  useEffect(() => {
    if (!paypalClientId()) {
      setFailed(true);
      return;
    }
    let cancelled = false;

    const createOrder = async () => {
      const order = await api.paypalCreate(token);
      if (!order?.order_id) {
        throw new Error("PayPal did not return an order id.");
      }
      return order.order_id as string;
    };
    const approve = async (data: { orderID: string }) => {
      await api.paypalCapture(data.orderID, token);
      successRef.current();
    };
    const fail = (err: unknown) => {
      setCheckoutActive(false);
      errorRef.current(
        err instanceof Error
          ? err.message
          : "PayPal checkout failed. Please try again.",
      );
    };

    const mount = () => {
      const paypal = window.paypal;
      const el = buttonsRef.current;
      if (!paypal || !el || cancelled) return;
      // Guard against React StrictMode's double effect invocation.
      if (renderedTokenRef.current === token) return;
      renderedTokenRef.current = token;
      el.innerHTML = "";

      const config = {
        style: {
          layout: "vertical",
          shape: "pill",
          color: "black",
          label: "paypal",
        },
        createOrder: async () => {
          try {
            return await createOrder();
          } catch (e) {
            fail(e);
            throw e;
          }
        },
        onApprove: (data: { orderID: string }) => {
          void (async () => {
            try {
              await approve(data);
            } catch (e) {
              fail(e);
            }
          })();
        },
        // Hide the button as soon as checkout starts so PayPal's own
        // window is shown on its own.
        onClick: () => {
          setCheckoutActive(true);
        },
        onCancel: () => setCheckoutActive(false),
        onError: fail,
        ...(paypal.FUNDING ? { fundingSource: paypal.FUNDING.PAYPAL } : {}),
      };

      paypal
        .Buttons(config)
        .render(el)
        .catch(() => setFailed(true));
    };

    loadPaypal()
      .then(mount)
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (failed) {
    return (
      <button
        type="button"
        onClick={async () => {
          setBusy(true);
          try {
            const order = await api.paypalCreate(token);
            if (order.mock) {
              await api.paypalCapture(order.order_id as string, token);
              successRef.current();
              return;
            }
            const url: string | undefined = order.approval_url;
            if (!url) throw new Error("PayPal did not return a checkout link.");
            // PayPal must approve the order first; send the buyer there.
            window.location.href = url;
          } catch (e) {
            errorRef.current(
              e instanceof Error
                ? e.message
                : "Could not start PayPal payment.",
            );
          } finally {
            setBusy(false);
          }
        }}
        disabled={busy}
        className="w-full rounded-full border border-neutral-200 bg-white px-7 py-3.5 text-[14px] font-medium text-neutral-900 transition hover:border-neutral-400 disabled:opacity-50"
      >
        {busy ? (
          <Loader className="mx-auto animate-spin" />
        ) : (
          `Pay ${amountLabel} with PayPal`
        )}
      </button>
    );
  }

  return (
    <div>
      <div ref={buttonsRef} hidden={checkoutActive} />
      {checkoutActive && (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-neutral-200 py-6 text-[13px] text-neutral-500">
          <Loader className="h-4 w-4 animate-spin" />
          Complete your payment in the PayPal window…
        </div>
      )}
    </div>
  );
}
