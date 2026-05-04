import React, { useState } from 'react';
import { paymentApi } from '../../api';

function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-razorpay-checkout]');
    if (existing) {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.dataset.razorpayCheckout = 'true';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Could not load Razorpay checkout.'));
    document.body.appendChild(script);
  });
}

/**
 * PaymentModal — Handles Razorpay checkout for:
 *   - VERIFIED_BADGE  (₹99) — shown on own profile
 *   - BOOST_POST      (₹49) — shown on post actions
 *
 * Props:
 *   type      — 'VERIFIED_BADGE' | 'BOOST_POST'
 *   postId    — required only for BOOST_POST
 *   user      — logged-in user object
 *   onSuccess — callback(message) after successful payment
 *   onClose   — callback to close the modal
 */
export default function PaymentModal({ type, postId, user, onSuccess, onClose }) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const isVerified = type === 'VERIFIED_BADGE';
  const price      = isVerified ? '₹99' : '₹49';
  const title      = isVerified ? 'Get Verified Badge ✓' : 'Boost Post 🚀';
  const desc       = isVerified
    ? 'Your profile will show a verified checkmark visible to everyone.'
    : 'Your post will be boosted to the Trending section for 24 hours.';

  const handlePay = async () => {
    setLoading(true);
    setError('');
    try {
      /* Step 1 — Create order on backend */
      const { data: order } = await paymentApi.createOrder({
        type,
        userEmail: user?.email || '',
        ...(postId ? { postId } : {}),
      });

      await loadRazorpay();

      /* Step 2 — Open Razorpay checkout widget */
      const options = {
        key:         order.keyId,
        amount:      order.amount,
        currency:    order.currency,
        order_id:    order.razorpayOrderId,
        name:        'ConnectSphere',
        description: title,
        prefill: {
          name:  user.fullName || user.username,
          email: user.email    || '',
        },
        theme: { color: '#6366f1' },

        handler: async (response) => {
          /* Step 3 — Verify payment signature on backend */
          try {
            const { data: result } = await paymentApi.verifyPayment({
              razorpayOrderId:   response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            onSuccess(result.message);
          } catch (e) {
            setError(e.message || 'Payment verification failed.');
            setLoading(false);
          }
        },

        modal: { ondismiss: () => setLoading(false) },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (resp) => {
        setError(resp.error?.description || 'Payment failed.');
        setLoading(false);
      });
      rzp.open();

    } catch (e) {
      setError(e.message || 'Could not initiate payment.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
        onClick={e => e.stopPropagation()}>

        <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4 text-3xl">
          {isVerified ? '✓' : '🚀'}
        </div>

        <h3 className="font-bold text-slate-800 text-lg text-center mb-1">{title}</h3>
        <p className="text-sm text-slate-500 text-center mb-5">{desc}</p>

        <div className="bg-indigo-50 rounded-xl px-4 py-3 flex items-center justify-between mb-5">
          <span className="text-sm text-slate-600 font-medium">One-time payment</span>
          <span className="text-xl font-bold text-indigo-600">{price}</span>
        </div>

        {error && <p className="text-sm text-red-500 text-center mb-3">{error}</p>}

        <button onClick={handlePay} disabled={loading}
          className="w-full btn-primary py-3 text-sm font-semibold mb-2 disabled:opacity-60">
          {loading ? 'Processing…' : `Pay ${price} with Razorpay`}
        </button>
        <button onClick={onClose} className="w-full btn-outline py-2.5 text-sm">
          Cancel
        </button>
      </div>
    </div>
  );
}
