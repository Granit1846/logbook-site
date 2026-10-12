import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BUCKET = "logbook-files";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Service-role operations must never be reachable with the public anon key.
    const token = req.headers.get("Authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!token) return new Response(JSON.stringify({ error: "Требуется вход" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    const { data: auth, error: authError } = await supabase.auth.getUser(token);
    if (authError || !auth.user) return new Response(JSON.stringify({ error: "Сессия недействительна" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    const adminEmail = Deno.env.get("LOGBOOK_ADMIN_EMAIL") ?? "jeriko1846@yandex.ru";
    if (!auth.user.email_confirmed_at || auth.user.email?.toLowerCase() !== adminEmail.toLowerCase()) {
      return new Response(JSON.stringify({ error: "Доступ запрещён" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/logbook-files-api\/?/, "");

    // POST /upload — upload a sync or backup file
    if (path === "upload" && req.method === "POST") {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const fileType = (formData.get("file_type") as string) || "backup";
      const description = (formData.get("description") as string) || null;
      const deviceId = (formData.get("device_id") as string) || null;

      if (!file) {
        return new Response(JSON.stringify({ error: "Файл не предоставлен" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (fileType !== "sync" && fileType !== "backup") {
        return new Response(
          JSON.stringify({ error: "Неверный тип файла" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const timestamp = Date.now();
      const storagePath = `${fileType}/${timestamp}-${file.name}`;

      const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, file, { upsert: false });

      if (uploadErr) throw uploadErr;

      const { data, error: insertErr } = await supabase
        .from("file_records")
        .insert({
          file_name: file.name,
          storage_path: storagePath,
          file_type: fileType,
          file_size: file.size,
          mime_type: file.type || "application/octet-stream",
          description,
          device_id: deviceId,
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      return new Response(JSON.stringify({ success: true, record: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET /download?path=<storage_path> — download a file
    if (path === "download" && req.method === "GET") {
      const storagePath = url.searchParams.get("path");
      if (!storagePath) {
        return new Response(
          JSON.stringify({ error: "Путь не указан" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data, error: dlErr } = await supabase.storage
        .from(BUCKET)
        .download(storagePath);

      if (dlErr) throw dlErr;

      return new Response(data, {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename="${storagePath.split("/").pop()}"`,
        },
      });
    }

    // GET /list?type=<sync|backup> — list files
    if (path === "list" && req.method === "GET") {
      const type = url.searchParams.get("type");
      let query = supabase.from("file_records").select("*").order("created_at", { ascending: false });
      if (type === "sync" || type === "backup") {
        query = query.eq("file_type", type);
      }

      const { data, error: listErr } = await query;
      if (listErr) throw listErr;

      return new Response(JSON.stringify({ records: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE /delete?id=<record_id>&path=<storage_path> — delete a file
    if (path === "delete" && req.method === "DELETE") {
      const id = url.searchParams.get("id");
      const storagePath = url.searchParams.get("path");
      if (!id || !storagePath) {
        return new Response(
          JSON.stringify({ error: "Не указан id или path" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { error: storageErr } = await supabase.storage
        .from(BUCKET)
        .remove([storagePath]);
      if (storageErr) throw storageErr;

      const { error: dbErr } = await supabase
        .from("file_records")
        .delete()
        .eq("id", id);
      if (dbErr) throw dbErr;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Неизвестный маршрут" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Внутренняя ошибка" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
