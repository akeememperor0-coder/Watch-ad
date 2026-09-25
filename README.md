# Fep Web Solutions — backend setup

This adds three things to your site, all running on Netlify Functions
(serverless — no separate server to manage) and Netlify Blobs (built-in
storage, no external database signup needed):

1. **Portfolio manager** — add/edit/delete projects from `admin.html`
   instead of hand-editing HTML. The public site loads them live from
   `/api/projects`.
2. **Message storage** — every contact form, feedback form, and agent-chat
   message is saved to `/api/messages` (viewable in `admin.html`), in
   addition to still opening an email like before.
3. **Real payments** — the "Pay to publish" button on the site uses
   Paystack's popup checkout, then verifies the payment server-side via
   `/api/paystack-verify` before treating it as paid.

## Important: this needs a real Netlify deploy, not Netlify Drop

Netlify Drop (the drag-and-drop page) only publishes static files — it
does **not** run the `netlify/functions` folder, so the backend won't
work there. You need either:

- **Netlify CLI**: `npm install -g netlify-cli`, then from this folder
  run `netlify deploy --prod`, or
- **A GitHub repo connected to Netlify**: push this folder to a repo,
  then "Import an existing project" in Netlify and point it at the repo.

Since you already run Mix on Netlify with serverless functions, you've
likely done one of these before — same process here.

## Environment variables to set in Netlify

Go to **Site settings → Environment variables** on Netlify and add:

| Variable | Value |
|---|---|
| `ADMIN_PASSWORD` | Any password you choose — this protects `admin.html` and the write endpoints. |
| `PAYSTACK_SECRET_KEY` | From your Paystack dashboard → Settings → API Keys & Webhooks. Keep this secret — never put it in the HTML. |

Then in `index.html`, find this line near the bottom and replace the
placeholder with your **public** Paystack key (safe to expose client-side):

```js
var PAYSTACK_PUBLIC_KEY = 'pk_test_REPLACE_ME';
```

Use a `pk_test_...` key while testing, switch to your `pk_live_...` key
when you're ready to accept real payments.

## Using the admin dashboard

Once deployed, go to `yoursite.netlify.app/admin.html`, enter the
`ADMIN_PASSWORD` you set, and you can:
- Add a project (name, category, description, live/in-progress, accent color)
- Delete a project
- View every message/lead that's come in through the site

## File overview

```
index.html                          the public site
admin.html                          the private dashboard
netlify.toml                        tells Netlify where functions live
package.json                        the @netlify/blobs dependency
netlify/functions/projects.js       portfolio CRUD API
netlify/functions/messages.js       stores contact/feedback/chat messages
netlify/functions/paystack-verify.js  confirms a payment really succeeded
```

## What's still manual

- Actually publishing a customer's finished site is still something you
  do by hand after payment comes in — this system tells you a payment
  succeeded and saves their customized headline/text, but it doesn't
  auto-deploy a new site for them. That would be a bigger project if you
  want it fully automated later.
- Paystack requires you to complete their business verification before
  you can go live with real charges — the test keys work immediately for
  trying it out.
