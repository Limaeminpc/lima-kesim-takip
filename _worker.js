export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const headers = { "Content-Type": "application/json; charset=utf-8" };

    if (!env.DB) {
      return new Response(JSON.stringify({ error: "DB bağlaması bulunamadı." }), { status: 500, headers });
    }

    // --- KULLANICILAR (/api/users) ---
    if (url.pathname === "/api/users") {
      if (request.method === "GET") {
        const { results } = await env.DB.prepare("SELECT * FROM users ORDER BY username ASC").all();
        const users = (results || []).map(u => ({
          ...u,
          permissions: u.permissions ? JSON.parse(u.permissions) : {}
        }));
        return new Response(JSON.stringify({ users }), { status: 200, headers });
      }

      if (request.method === "POST" || request.method === "PUT") {
        const u = await request.json();
        const id = u.id || crypto.randomUUID();
        const now = new Date().toISOString();

        await env.DB.prepare(`
          INSERT INTO users (id, username, password, role, group_name, permissions, updated_at)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
          ON CONFLICT(id) DO UPDATE SET
            username = excluded.username,
            password = excluded.password,
            role = excluded.role,
            group_name = excluded.group_name,
            permissions = excluded.permissions,
            updated_at = excluded.updated_at
        `).bind(
          id,
          u.username,
          u.password,
          u.role || "cutting",
          u.group_name || "",
          JSON.stringify(u.permissions || {}),
          now
        ).run();

        return new Response(JSON.stringify({ ok: true, id }), { status: 200, headers });
      }

      if (request.method === "DELETE") {
        const id = url.searchParams.get("id");
        if (!id) return new Response(JSON.stringify({ error: "id gerekli" }), { status: 400, headers });
        await env.DB.prepare("DELETE FROM users WHERE id = ?1").bind(id).run();
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
      }
    }

    // --- ORTAK KESİM & İRSALİYE TAKİP SATIRLARI (/api/items) ---
    if (url.pathname === "/api/items") {
      if (request.method === "GET") {
        const { results } = await env.DB.prepare("SELECT * FROM cutting_items ORDER BY updated_at DESC").all();
        return new Response(JSON.stringify({ items: results || [] }), { status: 200, headers });
      }

      if (request.method === "POST" || request.method === "PUT") {
        const item = await request.json();
        const id = item.id || crypto.randomUUID();
        const now = new Date().toISOString();

        await env.DB.prepare(`
          INSERT INTO cutting_items (id, order_no, part_code, qty, cutting_status, warehouse_status, updated_by, note, updated_at)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
          ON CONFLICT(id) DO UPDATE SET
            order_no = excluded.order_no,
            part_code = excluded.part_code,
            qty = excluded.qty,
            cutting_status = excluded.cutting_status,
            warehouse_status = excluded.warehouse_status,
            updated_by = excluded.updated_by,
            note = excluded.note,
            updated_at = excluded.updated_at
        `).bind(
          id,
          item.order_no || "",
          item.part_code || "",
          Number(item.qty ?? 0),
          item.cutting_status || "Bekliyor",
          item.warehouse_status || "Bekliyor",
          item.updated_by || "",
          item.note || "",
          now
        ).run();

        return new Response(JSON.stringify({ ok: true, id, updated_at: now }), { status: 200, headers });
      }

      if (request.method === "DELETE") {
        const id = url.searchParams.get("id");
        if (!id) return new Response(JSON.stringify({ error: "id gerekli" }), { status: 400, headers });
        await env.DB.prepare("DELETE FROM cutting_items WHERE id = ?1").bind(id).run();
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
      }
    }

    // --- İŞLEM LOGLARI (/api/logs) ---
    if (url.pathname === "/api/logs") {
      if (request.method === "GET") {
        const { results } = await env.DB.prepare("SELECT * FROM logs ORDER BY id DESC LIMIT 100").all();
        return new Response(JSON.stringify({ logs: results || [] }), { status: 200, headers });
      }

      if (request.method === "POST") {
        const log = await request.json();
        const now = new Date().toISOString();
        await env.DB.prepare("INSERT INTO logs (username, action, created_at) VALUES (?1, ?2, ?3)")
          .bind(log.username || "sistem", log.action || "", now)
          .run();
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
      }
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("Not found", { status: 404 });
  }
};