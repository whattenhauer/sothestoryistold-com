export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.slice(1); // remove leading /
    const method = request.method;

    // CORS headers for your website
    const corsHeaders = {
      "Access-Control-Allow-Origin": "https://sothestoryistold.com",
      "Access-Control-Allow-Methods": "GET, PUT, POST, DELETE, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Expose-Headers": "ETag, Content-Length",
      "Access-Control-Max-Age": "3600",
    };

    // Handle preflight
    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // TODO: Add authentication here (e.g., verify JWT, API key, session cookie)

    try {
      // ADD / MODIFY (upload or replace object)
      if ((method === "PUT" || method === "POST") && path) {
        const contentType = request.headers.get("Content-Type") || "application/octet-stream";
        const body = await request.arrayBuffer();
        const metadata = {
          contentType,
          uploaded: new Date().toISOString(),
        };
        // Extract custom metadata from headers if provided
        const customMeta = request.headers.get("X-Story-Metadata");
        if (customMeta) {
          metadata.customMetadata = JSON.parse(customMeta);
        }
        const obj = await env.MEDIA_BUCKET.put(path, body, metadata);
        return new Response(JSON.stringify({ key: path, etag: obj.etag }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // GET (retrieve media or list objects)
      if (method === "GET") {
        if (path) {
          // Get single object
          const obj = await env.MEDIA_BUCKET.get(path);
          if (obj === null) {
            return new Response("Not found", { status: 404, headers: corsHeaders });
          }
          const headers = new Headers(corsHeaders);
          headers.set("Content-Type", obj.metadata?.contentType || "application/octet-stream");
          headers.set("ETag", obj.etag);
          return new Response(obj.body, { headers });
        } else {
          // List objects (optional: support prefix for browsing)
          const prefix = url.searchParams.get("prefix") || "";
          const listed = await env.MEDIA_BUCKET.list({ prefix, limit: 1000 });
          const items = listed.objects.map(o => ({
            key: o.key,
            size: o.size,
            uploaded: o.uploaded.toISOString(),
            etag: o.etag,
          }));
          return new Response(JSON.stringify({ objects: items }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // MOVE (copy to new key, then delete original)
      if (method === "POST" && path && url.searchParams.get("action") === "move") {
        const destination = url.searchParams.get("to");
        if (!destination) {
          return new Response("Missing 'to' parameter", { status: 400, headers: corsHeaders });
        }
        const obj = await env.MEDIA_BUCKET.get(path);
        if (obj === null) {
          return new Response("Source not found", { status: 404, headers: corsHeaders });
        }
        await env.MEDIA_BUCKET.put(destination, obj.body, {
          contentType: obj.metadata?.contentType,
          customMetadata: obj.metadata?.customMetadata,
        });
        await env.MEDIA_BUCKET.delete(path);
        return new Response(JSON.stringify({ moved: path, to: destination }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ARCHIVE (move to archive/ prefix)
      if (method === "POST" && path && url.searchParams.get("action") === "archive") {
        const archivedKey = `archive/${path}`;
        const obj = await env.MEDIA_BUCKET.get(path);
        if (obj === null) {
          return new Response("Not found", { status: 404, headers: corsHeaders });
        }
        await env.MEDIA_BUCKET.put(archivedKey, obj.body, {
          contentType: obj.metadata?.contentType,
          customMetadata: { ...obj.metadata?.customMetadata, archivedAt: new Date().toISOString() },
        });
        await env.MEDIA_BUCKET.delete(path);
        return new Response(JSON.stringify({ archived: path, to: archivedKey }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // DELETE
      if (method === "DELETE" && path) {
        await env.MEDIA_BUCKET.delete(path);
        return new Response(JSON.stringify({ deleted: path }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  },
};
