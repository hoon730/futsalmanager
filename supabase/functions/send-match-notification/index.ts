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
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : '';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = buildCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // 허용되지 않은 origin 차단 (서버-서버 호출은 Origin 헤더 없을 수 있으므로 통과)
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return new Response(
      JSON.stringify({ error: 'Origin not allowed' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { matchId, squadId, title, matchDate, location } = await req.json();

    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com';

    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(
        JSON.stringify({ error: 'VAPID keys not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 해당 동호회의 모든 구독자 조회
    const { data: subs, error } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('squad_id', squadId);

    if (error) throw error;
    if (!subs || subs.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, failed: 0, message: '구독자 없음' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 알림 페이로드 구성
    const dateStr = new Date(matchDate).toLocaleString('ko-KR', {
      month: 'long',
      day: 'numeric',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

    const payload = JSON.stringify({
      title: '⚽ 새 경기가 등록됐어요!',
      body: `${title} · ${dateStr}${location ? ` · ${location}` : ''}`,
      url: '/?tab=schedule',
      matchId,
    });

    // 모든 구독자에게 전송
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

    return new Response(
      JSON.stringify({ sent, failed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
