import { getCloudflareContext } from "@opennextjs/cloudflare";
import { diagnoseImage, type VisionEnv } from "@/lib/vision/diagnose";

const MAX_BYTES = 2_000_000;

function readVisionEnv(): VisionEnv {
  const fromProcess: VisionEnv = {
    apiKey: process.env.VISION_API_KEY,
    baseUrl: process.env.VISION_API_BASE_URL,
    model: process.env.VISION_MODEL,
  };
  try {
    const { env } = getCloudflareContext();
    const record = env as typeof env & {
      VISION_API_KEY?: string;
      VISION_API_BASE_URL?: string;
      VISION_MODEL?: string;
    };
    return {
      apiKey: record.VISION_API_KEY || fromProcess.apiKey,
      baseUrl: record.VISION_API_BASE_URL || fromProcess.baseUrl,
      model: record.VISION_MODEL || fromProcess.model,
    };
  } catch {
    return fromProcess;
  }
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
