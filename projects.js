import { getStore } from "@netlify/blobs";

// Public GET (anyone can see the portfolio).
// POST / PUT / DELETE require the x-admin-password header to match ADMIN_PASSWORD.

export default async (req) => {
  const store = getStore("projects");
  const method = req.method;

  if (method === "GET") {
    const list = (await store.get("all", { type: "json" })) || [];
    return new Response(JSON.stringify(list), {
      headers: { "Content-Type": "application/json" }
    });
  }

  const password = req.headers.get("x-admin-password");
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  const list = (await store.get("all", { type: "json" })) || [];

  if (method === "POST") {
    const project = await req.json();
    project.id = Date.now().toString();
    list.push(project);
    await store.setJSON("all", list);
    return new Response(JSON.stringify(project), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (method === "PUT") {
    const updated = await req.json();
    const idx = list.findIndex((p) => p.id === updated.id);
    if (idx === -1) {
      return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
    }
    list[idx] = updated;
    await store.setJSON("all", list);
    return new Response(JSON.stringify(updated), {
      headers: { "Content-Type": "application/json" }
    });
  }

  if (method === "DELETE") {
    const { id } = await req.json();
    const filtered = list.filter((p) => p.id !== id);
    await store.setJSON("all", filtered);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config = { path: "/api/projects" };
