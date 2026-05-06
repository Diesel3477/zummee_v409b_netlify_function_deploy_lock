const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '').trim();

console.log('UPLOAD ENV CHECK', {
  hasUrl: !!SUPABASE_URL,
  urlPrefix: SUPABASE_URL.slice(0, 30),
  hasKey: !!SERVICE_KEY,
  keyPrefix: SERVICE_KEY.slice(0, 12)
});
const BUCKET = 'board-item-photos';

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify(body)
  };
}

function clean(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clean(value));
}

function safeFileName(name) {
  const cleaned = clean(name || 'photo.jpg')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 90);
  return cleaned || 'photo.jpg';
}

function safeContentType(contentType, fileName) {
  const type = clean(contentType).toLowerCase();
  if (type.startsWith('image/')) return type;
  const ext = safeFileName(fileName).split('.').pop().toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  return 'image/jpeg';
}

exports.handler = async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json(500, { error: 'Missing Supabase service configuration' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (error) {
    return json(400, { error: 'Invalid JSON body' });
  }

  const communityId = clean(body.community_id || body.communityId);
  const userId = clean(body.user_id || body.userId);
  const notificationId = clean(body.notification_id || body.notificationId || body.board_item_id || body.boardItemId);
  const fileName = safeFileName(body.fileName || body.filename || 'photo.jpg');
  const fileBase64 = clean(body.fileBase64 || body.base64 || '');
  const contentType = safeContentType(body.contentType || body.mimeType, fileName);

  if (!isUuid(communityId)) return json(400, { error: 'Missing or invalid community_id' });
  if (!isUuid(userId)) return json(400, { error: 'Missing or invalid user_id' });
  if (!isUuid(notificationId)) return json(400, { error: 'Missing or invalid notification_id' });
  if (!fileBase64) return json(400, { error: 'Missing photo data' });
  if (!contentType.startsWith('image/')) return json(400, { error: 'Only image uploads are supported' });

 const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

  try {
    console.log('STEP 1: before assignment query');
    
    const { data: assignment, error: assignmentError } = await supabase
      .from('community_assignments')
      .select('id')
      .eq('community_id', communityId)
      .eq('employee_id', userId)
      .maybeSingle();
    
console.log('STEP 2: after assignment query', { assignment, assignmentError });
    if (assignmentError) {
      return json(500, { error: assignmentError.message });
    }

    if (!assignment) {
      return json(403, { error: 'Not authorized for this community' });
    }

    const extFromName = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';
    const ext = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extFromName) ? extFromName : (contentType.split('/')[1] || 'jpg');
    const path = `${communityId}/${notificationId}/${Date.now()}-${Math.random().toString(36).substring(2, 10)}.${ext}`;
    const buffer = Buffer.from(fileBase64, 'base64');

    if (!buffer.length) {
      return json(400, { error: 'Photo file was empty' });
    }

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, {
        contentType,
        cacheControl: '31536000',
        upsert: false
      });

    if (uploadError) {
      return json(500, { error: uploadError.message });
    }

    const { data: currentEvent, error: readError } = await supabase
      .from('notification_events')
      .select('id,metadata')
      .eq('id', notificationId)
      .eq('community_id', communityId)
      .maybeSingle();

    if (readError) {
      return json(500, { error: readError.message });
    }

    if (!currentEvent) {
      return json(404, { error: 'Board item notification not found' });
    }

    const metadata = currentEvent.metadata && typeof currentEvent.metadata === 'object' ? currentEvent.metadata : {};
    const photos = Array.isArray(metadata.photos) ? metadata.photos.slice() : [];
    const publicUrlResult = supabase.storage.from(BUCKET).getPublicUrl(path);
    const photo = {
      bucket: BUCKET,
      path,
      url: publicUrlResult && publicUrlResult.data ? publicUrlResult.data.publicUrl : '',
      name: fileName,
      type: contentType,
      size: buffer.length,
      uploaded_at: new Date().toISOString(),
      uploaded_by: userId
    };
    photos.push(photo);

    const nextMetadata = {
      ...metadata,
      photos,
      photo_count: photos.length,
      updated_at: new Date().toISOString(),
      updated_by: userId
    };

    const { error: updateError } = await supabase
      .from('notification_events')
      .update({ metadata: nextMetadata })
      .eq('id', notificationId)
      .eq('community_id', communityId);

    if (updateError) {
      return json(500, { error: updateError.message });
    }

    return json(200, { path, photo, photos, notification_id: notificationId });
 } catch (error) {
  console.error('UPLOAD BOARD PHOTO ERROR:', error);

  return json(500, {
    error: error.message || String(error),
    name: error.name || null,
    stack: error.stack || null
  });
}
};
