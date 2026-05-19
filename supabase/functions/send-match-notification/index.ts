import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webPush from 'npm:web-push@3.6.7';

// 허용 origin 목록 (환경변수로 관리)
// Supabase 함수 환경에 ALLOWED_ORIGINS="https://a.com,https://b.com" 형태로 설정.
// 미설정 시 안전상 빈 목록 — Origin 헤더 검증 실패 처리.
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function buildCorsHeaders(origin: string | null) {
  // ALLOWED_ORIGINS 미설정 → 요청 origin을 그대로 반영 (JWT 인증으로 보안 유지)
  // 설정 → 화이트리스트에 있는 origin만 허용
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

  // ALLOWED_ORIGINS가 설정된 경우에만 origin 검증 (미설정 시 JWT 인증으로 충분)
  if (ALLOWED_ORIGINS.length > 0 && origin && !ALLOWED_ORIGINS.includes(origin)) {
    return jsonResponse({ error: 'Origin not allowed' }, 403, corsHeaders);
  }

  // -------- 1. JWT 검증 --------
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

  // anon 클라이언트로 토큰 검증
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userData?.user) {
    return jsonResponse({ error: 'Unauthorized: invalid token' }, 401, corsHeaders);
  }
  const callerId = userData.user.id;

  try {
    const { matchId, squadId, matchDate, location } = await req.json();

    if (!matchId || !squadId) {
      return jsonResponse({ error: 'matchId, squadId 필수' }, 400, corsHeaders);
    }

    // -------- 2. 호출자가 해당 squad의 운영자(owner/admin)인지 확인 --------
    const { data: membership, error: memErr } = await userClient
      .from('squad_members')
      .select('role')
      .eq('squad_id', squadId)
      .eq('user_id', callerId)
      .maybeSingle();

    if (memErr) {
      return jsonResponse({ error: '권한 확인 실패' }, 500, corsHeaders);
    }
    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      return jsonResponse({ error: '운영자만 알림을 보낼 수 있습니다' }, 403, corsHeaders);
    }

    // -------- 3. VAPID 설정 --------
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com';

    if (!vapidPublicKey || !vapidPrivateKey) {
      return jsonResponse({ error: 'VAPID keys not configured' }, 500, corsHeaders);
    }

    webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    // -------- 4. 푸시 전송 (구독 조회는 service-role로) --------
    const adminClient = createClient(supabaseUrl, serviceKey);

    const { data: subs, error } = await adminClient
      .from('push_subscriptions')
      .select('subscription')
      .eq('squad_id', squadId);

    if (error) throw error;
    if (!subs || subs.length === 0) {
      return jsonResponse({ sent: 0, failed: 0, message: '구독자 없음' }, 200, corsHeaders);
    }

    // 형식: "5월 19일 (화) 오후 2:00"
    const d = new Date(matchDate);
    const month = d.toLocaleString('ko-KR', { month: 'long' });
    const day = d.getDate();
    const weekday = d.toLocaleString('ko-KR', { weekday: 'short' });
    const time = d.toLocaleString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: true });
    const dateStr = `${month} ${day}일 (${weekday}) ${time}`;

    const payload = JSON.stringify({
      title: '풋살 매니저',
      body: `새 경기가 등록되었습니다.\n${dateStr}${location ? ` · ${location}` : ''}`,
      url: '/?tab=schedule',
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
