import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '5mb',
    },
  },
};

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 前端发送的是 base64 字符串：{ data: "data:image/png;base64,xxxx" }
    const { data: dataUrl } = req.body as { data: string };
    if (!dataUrl) {
      return res.status(400).json({ error: 'No image data provided' });
    }

    // 去掉 data:image/png;base64, 前缀
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64, 'base64');

    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;

    const { error: uploadError } = await supabase.storage
      .from('share-posters')
      .upload(fileName, buffer, {
        contentType: 'image/png',
        upsert: false,
      });

    if (uploadError) {
      console.error('[upload-share-image] upload error:', uploadError);
      return res.status(500).json({ error: 'Upload failed', detail: uploadError.message });
    }

    const { data: urlData } = supabase.storage
      .from('share-posters')
      .getPublicUrl(fileName);

    return res.status(200).json({ imageUrl: urlData.publicUrl });
  } catch (e) {
    console.error('[upload-share-image] error:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
