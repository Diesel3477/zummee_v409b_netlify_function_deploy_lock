// Netlify Function: get-board-members
// Reads active board members for a community using Supabase service role.

exports.handler = async function(event) {
  try {
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Content-Type": "application/json"
    };

    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    const communityId = event.queryStringParameters && event.queryStringParameters.community_id;
    if (!communityId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing community_id" })
      };
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" })
      };
    }

    const endpoint = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/BoardMembers` +
      `?select=id,community_id,name,position,email,phone,is_active` +
      `&community_id=eq.${encodeURIComponent(communityId)}` +
      `&is_active=eq.true` +
      `&order=position.asc,name.asc`;

    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Accept: "application/json"
      }
    });

    const text = await response.text();

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ error: "BoardMembers query failed", status: response.status, detail: text })
      };
    }

    let members = [];
    try { members = JSON.parse(text); } catch (_e) { members = []; }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ members })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: error && error.message ? error.message : String(error) })
    };
  }
};
