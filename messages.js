import { getStore } from "@netlify/blobs";

// Public POST (any visitor can send a message).
// GET (viewing the list) requires the x-admin-password header — that's how the
// admin dashboard reads them.

export default async (req) => {
  const store = getStore("messages");

  if (req.method === "POST") {
    const body = await req.json();
    const list = (await store.get("all", { type: "json" })) || [];
    const entry = {
      id: Date.now().toString(),
      name: body.name || "Anonymous",
      email: body.email || "",
      message: body.message || "",
      source: body.source || "contact",
      receivedAt: new Date().toISOString()
    };
    list.unshift(entry);
    await store.setJSON("all", list);
    return new Response(JSON.stringify({ ok: true }), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (req.method === "GET") {
    const password = req.headers.get("x-admin-password");
    if (!password || password !== process.env.ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }
    const list = (await store.get("all", { type: "json" })) || [];
    return new Response(JSON.stringify(list), {
      headers: { "Content-Type": "application/json" }
    });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config = { path: "/api/messages" };
