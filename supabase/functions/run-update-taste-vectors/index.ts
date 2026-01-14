import { serve } from 'https://deno.land/std@0.201.0/http/server.ts';
// Edge function to call media_update_taste_vectors_v1 with service role
Deno.serve(async (req: Request) => {
  try {
    const body = await req.json();
    const { session_id, media_item_id, event_type, dwell_ms, rating_0_10, in_watchlist } = body;
    const url = `${Deno.env.get('SUPABASE_URL')}/rest/v1/rpc/media_update_taste_vectors_v1`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''}`
      },
      body: JSON.stringify({
        p_session_id: session_id,
        p_media_item_id: media_item_id,
        p_event_type: event_type,
        p_dwell_ms: dwell_ms,
        p_rating_0_10: rating_0_10,
        p_in_watchlist: in_watchlist
      })
    });

    const text = await res.text();
    return new Response(text, { status: res.status, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});