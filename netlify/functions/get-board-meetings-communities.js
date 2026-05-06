// Netlify Function: get-board-meetings-communities
exports.handler = async function(event) {
  const headers = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"Content-Type", "Access-Control-Allow-Methods":"GET, OPTIONS", "Content-Type":"application/json" };
  if (event.httpMethod === "OPTIONS") return { statusCode:200, headers, body:JSON.stringify({ ok:true }) };
  try {
    const supabaseUrl = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) return { statusCode:500, headers, body:JSON.stringify({ error:"Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }) };
    const qs = event.queryStringParameters || {};
    const userId = String(qs.user_id || "").trim();
    const selectedId = String(qs.selected_community_id || qs.community_id || "").trim();
    async function rest(path){
      const res=await fetch(`${supabaseUrl}/rest/v1/${path}`, { headers:{ apikey:serviceRoleKey, Authorization:`Bearer ${serviceRoleKey}`, Accept:"application/json" } });
      const text=await res.text(); let json=null; try{ json=JSON.parse(text); }catch(_e){}
      return { ok:res.ok, status:res.status, text, json };
    }
    function add(map,id,name){ id=String(id||'').trim(); name=String(name||'').trim(); if(!id) return; if(!map.has(id) || (name && map.get(id)==='Selected community')) map.set(id, name || 'Selected community'); }
    const map=new Map(); if(selectedId) add(map, selectedId, 'Selected community');
    if(selectedId){
      const direct=[
        `PropertyCommunities?select=id,name&id=eq.${encodeURIComponent(selectedId)}&limit=1`,
        `Communities?select=id,name&id=eq.${encodeURIComponent(selectedId)}&limit=1`,
        `communities?select=id,name&id=eq.${encodeURIComponent(selectedId)}&limit=1`,
        `community_assignments?select=community_id,community_name&community_id=eq.${encodeURIComponent(selectedId)}&limit=1`,
        `CommunityAssignments?select=community_id,community_name&community_id=eq.${encodeURIComponent(selectedId)}&limit=1`
      ];
      for(const q of direct){ const r=await rest(q); if(r.ok && Array.isArray(r.json) && r.json.length){ const row=r.json[0]; add(map, row.id || row.community_id || selectedId, row.name || row.community_name || 'Selected community'); break; } }
    }
    if(userId){
      const assignment=[
        `community_assignments?select=community_id,community_name&auth_user_id=eq.${encodeURIComponent(userId)}&limit=200`,
        `community_assignments?select=community_id,community_name&user_id=eq.${encodeURIComponent(userId)}&limit=200`,
        `CommunityAssignments?select=community_id,community_name&user_id=eq.${encodeURIComponent(userId)}&limit=200`,
        `CommunityAssignments?select=community_id,community_name&auth_user_id=eq.${encodeURIComponent(userId)}&limit=200`
      ];
      for(const q of assignment){ const r=await rest(q); if(r.ok && Array.isArray(r.json) && r.json.length){ r.json.forEach(row=>add(map,row.community_id,row.community_name)); break; } }
    }
    const ids=Array.from(map.keys());
    if(ids.length){
      const inList=ids.map(encodeURIComponent).join(',');
      const tables=[`PropertyCommunities?select=id,name&id=in.(${inList})&order=name.asc`,`Communities?select=id,name&id=in.(${inList})&order=name.asc`,`communities?select=id,name&id=in.(${inList})&order=name.asc`];
      for(const q of tables){ const r=await rest(q); if(r.ok && Array.isArray(r.json) && r.json.length){ r.json.forEach(row=>add(map,row.id,row.name)); break; } }
    }
    const communities=Array.from(map.entries()).map(([id,name])=>({ id, name:name || 'Selected community' })).sort((a,b)=>a.name.localeCompare(b.name));
    return { statusCode:200, headers, body:JSON.stringify({ communities }) };
  } catch(error) { return { statusCode:500, headers, body:JSON.stringify({ error:error && error.message ? error.message : String(error) }) }; }
};
