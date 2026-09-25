// Confirms a Paystack payment really succeeded, using your secret key.
// Called by the site after the Paystack popup finishes.

export default async (req) => {
  const url = new URL(req.url);
  const reference = url.searchParams.get("reference");

  if (!reference) {
    return new Response(JSON.stringify({ error: "Missing reference" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const resp = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }
  });
  const data = await resp.json();

  return new Response(JSON.stringify(data), {
    status: resp.status,
    headers: { "Content-Type": "application/json" }
  });
};

export const config = { path: "/api/paystack-verify" };
