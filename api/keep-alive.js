// Vercel Cron이 매일 호출 — Supabase Free 티어의 7일 비활성 자동정지를 방지.
// squads 테이블에 가벼운 SELECT 요청만 보내 "활동 중" 상태를 유지한다.
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  // CRON_SECRET 설정 시 Vercel Cron 외 무단 호출 차단
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    res.status(500).json({ error: "Missing Supabase env vars" });
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { error } = await supabase.from("squads").select("id").limit(1);

  if (error) {
    res.status(500).json({ ok: false, error: error.message });
    return;
  }

  res.status(200).json({ ok: true, timestamp: new Date().toISOString() });
}
