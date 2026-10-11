import { diagnoseImage, type VisionEnv } from "@/lib/vision/diagnose";
import { readServerEnv } from "@/lib/server-env";

const MAX_BYTES = 2_000_000;

function readVisionEnv(): VisionEnv {
  const env = readServerEnv();
  return {
    apiKey: env.OPENAI_API_KEY,
    baseUrl: env.VISION_API_BASE_URL,
    model: env.VISION_MODEL,
  };
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json(
      { ok: false, error: "invalid_photo" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  const photo = form.get("photo");
  if (!(photo instanceof File) || photo.size === 0 || photo.size > MAX_BYTES) {
    return Response.json(
      { ok: false, error: "invalid_photo" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!photo.type.startsWith("image/")) {
    return Response.json(
      { ok: false, error: "invalid_photo" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  const result = await diagnoseImage({
    bytes: new Uint8Array(await photo.arrayBuffer()),
    mediaType: photo.type,
    env: readVisionEnv(),
  });
  const status = result.ok ? 200 : 503;
  return Response.json(result, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
