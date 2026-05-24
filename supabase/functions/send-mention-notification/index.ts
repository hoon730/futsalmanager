import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webPush from 'npm:web-push@3.6.7';

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function buildCorsHeaders(origin: string | null) {
  const allowed =
    ALLOWED_ORIGINS.length === 0
      ? origin ?? '*'
      : origin && ALLOWED_ORIGINS.includes(origin)
        ? origin
        : '';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function jsonResponse(
  body: unknown,
  status: number,
  corsHeaders: Record<string, string>
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = buildCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (ALLOWED_ORIGINS.length > 0 && origin && !ALLOWED_ORIGINS.includes(origin)) {
    return jsonResponse({ error: 'Origin not allowed' }, 403, corsHeaders);
  }

  // 1. JWT 검증
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Unauthorized: missing token' }, 401, corsHeaders);
  }
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return jsonResponse({ error: 'Unauthorized: empty token' }, 401, corsHeaders);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return jsonResponse({ error: 'Server misconfiguration' }, 500, corsHeaders);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userData?.user) {
    return jsonResponse({ error: 'Unauthorized: invalid token' }, 401, corsHeaders);
  }
  const callerId = userData.user.id;

  try {
    const { targetUserIds, matchId, squadId, commenterName } = await req.json();

    if (!matchId || !squadId || !Array.isArray(targetUserIds) || targetUserIds.length === 0) {
      return jsonResponse({ error: 'matchId, squadId, targetUserIds 필수' }, 400, corsHeaders);
    }

    // 2. 호출자가 해당 squad 멤버인지 확인 (admin 불필요, 일반 멤버도 @멘션 가능)
    const { data: membership, error: memErr } = await userClient
      .from('squad_members')
      .select('role')
      .eq('squad_id', squadId)
      .eq('user_id', callerId)
      .maybeSingle();

    if (memErr || !membership) {
      return jsonResponse({ error: '동호회 멤버만 알림을 보낼 수 있습니다' }, 403, corsHeaders);
    }

    // 3. VAPID 설정
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com';

    if (!vapidPublicKey || !vapidPrivateKey) {
      return jsonResponse({ error: 'VAPID keys not configured' }, 500, corsHeaders);
    }

    webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    // 4. 언급된 유저들의 push 구독 조회 (service-role 사용)
    const adminClient = createClient(supabaseUrl, serviceKey);

    const { data: subs, error: subsErr } = await adminClient
      .from('push_subscriptions')
      .select('subscription')
      .eq('squad_id', squadId)
      .in('user_id', targetUserIds);

    if (subsErr) throw subsErr;
    if (!subs || subs.length === 0) {
      return jsonResponse({ sent: 0, failed: 0, message: '구독자 없음' }, 200, corsHeaders);
    }

    const displayName = commenterName || '누군가';
    const payload = JSON.stringify({
      title: `${displayName}님이 댓글에서 언급했습니다`,
      body: '댓글을 확인해보세요',
      url: `/?tab=schedule&match=${encodeURIComponent(matchId)}`,
      matchId,
    });

    const results = await Promise.allSettled(
      subs.map((row) =>
        webPush.sendNotification(
          row.subscription as webPush.PushSubscription,
          payload
        )
      )
    );

    const sent = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    return jsonResponse({ sent, failed }, 200, corsHeaders);
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500, corsHeaders);
  }
});
