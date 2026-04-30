<script>
/* v2009: Rebuilt Mileage Tracker + auto-default current month. */
(function() {
  const SUPABASE_URL = "https://slcwuuwyrgnmlmxpcaim.supabase.co";
  const SUPABASE_KEY = "sb_publishable_DqOtjzlLWph7-bFjKlFN0w_kSpPI864";

  function getSb() {
    try {
      // Prefer an already-created Supabase *client* (must have sb.auth.getSession)
      if (window.sb && window.sb.auth && typeof window.sb.auth.getSession === "function") return window.sb;
      if (window.supabaseClient && window.supabaseClient.auth && typeof window.supabaseClient.auth.getSession === "function") return window.supabaseClient;

      // Some builds may store the client on window.supabase; however the CDN also exposes the *library* as window.supabase.
      // Only treat window.supabase as a client if it has auth.getSession.
      if (window.supabase && window.supabase.auth && typeof window.supabase.auth.getSession === "function") return window.supabase;
    } catch (e) {}
    return null;
  }

  async function ensureSb() {
    let sb = getSb();
    if (sb) return sb;
    if (!window.supabase || !window.supabase.createClient) {
      // Supabase CDN not loaded yet
      await new Promise(r => setTimeout(r, 50));
      if (!window.supabase || !window.supabase.createClient) throw new Error("Supabase library not loaded");
    }
    // IMPORTANT: Zummee uses a custom storageKey for Supabase auth session.
    // If we do not match it here, this standalone page will always appear "Not signed in"
    // even when the user is logged in elsewhere on the site.
    window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        storageKey: "sb-zummee-auth",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    return window.sb;
  }

  function setBadge(text) {
    const el = document.getElementById("buildBadge");
    if (el) el.textContent = text;
  }

  function el(id) { return document.getElementById(id); }

  // simple page state
  const mzState = {
    authId: null,
    communities: [],
    communityById: {},
  };

  // Default the month picker to the current month (YYYY-MM).
  // Only sets it when empty, so we don't override an existing selection.
  function setDefaultMonth() {
    const picker = el("monthPick");
    if (!picker) return;
    if (picker.value) return;

    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    picker.value = `${y}-${m}`;

    // If other handlers depend on month changes, trigger them.
    try { picker.dispatchEvent(new Event("change")); } catch (_) {}
  }

  function money(n) {
    const x = Number(n || 0);
    return (Number.isFinite(x) ? x : 0).toFixed(1);
  }

  function renderRows(communities) {
    const tbody = el("commBody");
    if (!tbody) return;
    tbody.innerHTML = "";
    for (const c of communities) {
      const tr = document.createElement("tr");

      const tdName = document.createElement("td");
      tdName.style.padding = "10px";
      tdName.textContent = c.name || "(Unnamed)";
      tr.appendChild(tdName);

      const tdMiles = document.createElement("td");
      tdMiles.style.padding = "10px";
      const inp = document.createElement("input");
      inp.type = "number";
      inp.min = "0";
      inp.step = "0.1";
      inp.placeholder = "0";
      inp.id = "mi_" + c.id;
      inp.className = "zummee-mileageInput";
      tdMiles.appendChild(inp);
      tr.appendChild(tdMiles);

      const tdAction = document.createElement("td");
      tdAction.style.padding = "10px";
      tdAction.style.textAlign = "center";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = "+ Add";
      btn.className = "zummee-hubBtn zummee-actionBtn";
      btn.onclick = async () => {
        const miles = Number(inp.value);
        if (!Number.isFinite(miles) || miles <= 0) {
          alert("Enter mileage greater than 0.");
          inp.focus();
          return;
        }
        btn.disabled = true;
        btn.textContent = "Adding...";
        try {
          const sb = await ensureSb();
          const { data: sess } = await sb.auth.getSession();
          const authId = sess?.session?.user?.id;
          if (!authId) throw new Error("Not signed in");

          // Best-effort insert; schema may vary. Adjust if needed.
          const ins = await insertMileageLog(sb, authId, c.id, miles);
          if (ins.error) {
            // If MileageLogs schema differs, at least keep UI functional.
            console.warn("Mileage insert failed:", ins.error);
            alert("Saved UI is working, but DB insert failed: " + ins.error.message);
          } else {
            inp.value = "";
            await loadEntriesForSelectedMonth();
}
        } catch (e) {
          console.error(e);
          alert(e.message || String(e));
        } finally {
          btn.disabled = false;
          btn.textContent = "+ Add";
        }
      };
      tdAction.appendChild(btn);
      tr.appendChild(tdAction);

      const tdMonth = document.createElement("td");
      tdMonth.style.padding = "10px";
      tdMonth.textContent = "";
      tr.appendChild(tdMonth);

      const tdThisMonth = document.createElement("td");
      tdThisMonth.style.padding = "10px";
      tdThisMonth.style.textAlign = "right";
      tdThisMonth.textContent = "";
      tr.appendChild(tdThisMonth);

      tbody.appendChild(tr);
    }
  }

  
  function getSelectedMonth() {
    const picker = el("monthPick");
    if (!picker) return "";
    if (!picker.value) setDefaultMonth();
    return picker.value || "";
  }

  function monthBounds(monthStr) {
    // monthStr is "YYYY-MM"
    const [y, m] = (monthStr || "").split("-").map(Number);
    if (!y || !m) return null;
    const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
    const end = new Date(Date.UTC(y, m, 1, 0, 0, 0));
    return { start, end };
  }

  function pickDateField(sampleRow) {
    if (!sampleRow) return null;
    const candidates = ["log_date", "entry_date", "date", "mileage_date", "created_at"];
    return candidates.find(k => k in sampleRow) || null;
  }

  async function fetchMileageLogsForUser(sb, authId) {
    // Try common user id column names in MileageLogs.
    const userCols = ["user_id", "auth_user_id", "auth_userid", "authUserId"];
    let lastErr = null;

    for (const col of userCols) {
      try {
        const res = await sb.from("MileageLogs").select("*").eq(col, authId).order("created_at", { ascending: false }).limit(500);
        if (!res.error) return res;
        // If it's "column does not exist", try next.
        if (String(res.error.message || "").toLowerCase().includes("does not exist")) {
          lastErr = res.error;
          continue;
        }
        // other errors: stop
        return res;
      } catch (e) {
        lastErr = e;
      }
    }
    return { data: [], error: lastErr || new Error("Could not query MileageLogs for this user") };
  }

  function renderEntriesList(entries) {
    const box = el("entriesList");
    if (!box) return;

    if (!entries || !entries.length) {
      box.className = "muted";
      box.textContent = "No entries yet.";
      return;
    }

    box.className = "";
    const rows = entries.map(e => {
      const cname = (mzState.communityById[e.community_id]?.name) || e.community_name || e.community_id || "(unknown)";
      const miles = Number(e.miles ?? e.mileage ?? e.distance ?? 0) || 0;
      const dt = e._dt ? new Date(e._dt) : null;
      const when = dt ? dt.toLocaleDateString() : "";
      return `<tr>
        <td style="padding:10px">${escapeHtml(cname)}</td>
        <td style="padding:10px;text-align:right">${miles.toFixed(1)}</td>
        <td style="padding:10px">${escapeHtml(when)}</td>
      </tr>`;
    }).join("");

    box.innerHTML = `
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr>
            <th style="text-align:left;padding:10px">Community</th>
            <th style="text-align:right;padding:10px">Miles</th>
            <th style="text-align:left;padding:10px">Date</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[ch]));
  }

  function updateMonthlyTotal(entries) {
    const totalEl = el("monthlyTotal");
    if (!totalEl) return;
    const total = (entries || []).reduce((sum, e) => sum + (Number(e.miles ?? e.mileage ?? e.distance ?? 0) || 0), 0);
    totalEl.textContent = `${total.toFixed(0)} mi`;
  }

  
  async function smartInsert(table, payload) {
    // Retry by removing unknown columns (PostgREST "column ... does not exist")
    let cur = { ...payload };
    for (let i = 0; i < 8; i++) {
      const res = await (await ensureSb()).from(table).insert(cur);
      if (!res.error) return res;

      const msg = String(res.error.message || "");
      const m = msg.match(/column\s+([\w\."]+)\s+does not exist/i) ||
                msg.match(/could not find the ['"]([\w\.]+)['"] column/i);
      if (m) {
        const colRaw = (m[1] || "").replace(/"/g, "");
        const col = colRaw.includes(".") ? colRaw.split(".").pop() : colRaw;pop() : colRaw;
        if (col in cur) {
          delete cur[col];
          continue;
        }
      }
      return res;
    }
    return { data: null, error: { message: "Insert failed after retries" } };
  }

  async function insertMileageLog(sb, authId, communityId, miles) {
    const monthStr = getSelectedMonth();
    const logDate = new Date().toISOString();

    const payloadCandidates = [];

    const userCols = ["user_id", "auth_user_id"];
    const commCols = ["community_id", "property_community_id"];
    const milesCols = ["miles", "mileage", "distance"];
    const dateCols = [null, "log_date", "entry_date", "date", "mileage_date"];
    const monthCols = [null, "month", "log_month", "month_str"];

    for (const u of userCols) {
      for (const c of commCols) {
        for (const m of milesCols) {
          for (const d of dateCols) {
            for (const mo of monthCols) {
              const p = {
                [u]: authId,
                [c]: communityId,
                [m]: miles,
              };
              if (d) p[d] = logDate;
              if (mo) p[mo] = monthStr || null;
              payloadCandidates.push(p);
            }
          }
        }
      }
    }

    // Try payloads until one works (or a non-column error happens)
    let last = null;
    for (const p of payloadCandidates) {
      const res = await sb.from("MileageLogs").insert(p);
      if (!res.error) return res;

      const msg = String(res.error.message || "").toLowerCase();
      if (msg.includes("does not exist") || msg.includes("could not find")) {
        last = res;
        continue;
      }
      return res;
    }

    // Final fallback: try a superset payload and delete unknown cols as needed
    return await smartInsert("MileageLogs", {
      user_id: authId,
      auth_user_id: authId,
      community_id: communityId,
      property_community_id: communityId,
      miles: miles,
      mileage: miles,
      distance: miles,
      log_date: logDate,
      entry_date: logDate,
      date: logDate,
      month: monthStr || null,
      log_month: monthStr || null,
      month_str: monthStr || null,
    });
  }


  async function upsertComplianceCompletionRecord(sb, payload) {
    try {
      const res = await sb.from("mileage_compliance_completions").upsert(payload, {
        onConflict: "employee_user_id,community_id,month_key"
      });
      if (!res.error) return res;
      console.warn("Compliance completion upsert failed:", res.error);
      return res;
    } catch (e) {
      console.warn("Compliance completion table unavailable:", e);
      return { data: null, error: e };
    }
  }

  async function recordComplianceCompletion(sb, authId, community) {
    try {
      const monthStr = getSelectedMonth() || new Date().toISOString().slice(0, 7);
      const payload = {
        employee_user_id: authId,
        employee_email: mzState.userEmail || null,
        employee_name: mzState.userName || mzState.userEmail || null,
        company_id: community?.company_id || window.__activeCompanyId || localStorage.getItem("activeCompanyId") || null,
        community_id: community?.id || null,
        community_name: community?.name || null,
        completed_at: new Date().toISOString(),
        month_key: monthStr,
        source: "mileage_tracker"
      };
      if (!payload.employee_user_id || !payload.community_id || !payload.month_key) {
        return { data: null, error: { message: "Missing compliance payload fields." } };
      }
      return await upsertComplianceCompletionRecord(sb, payload);
    } catch (e) {
      console.warn("recordComplianceCompletion failed:", e);
      return { data: null, error: e };
    }
  }

  async function loadEntriesForSelectedMonth() {
    const authId = mzState.authId;
    const monthStr = getSelectedMonth();
    const bounds = monthBounds(monthStr);

    if (!authId) {
      renderEntriesList([]);
      updateMonthlyTotal([]);
      return;
    }
    if (!bounds) {
      renderEntriesList([]);
      updateMonthlyTotal([]);
      return;
    }

    const sb = await ensureSb();
    const res = await fetchMileageLogsForUser(sb, authId);
    if (res.error) {
      console.warn("MileageLogs query error:", res.error);
      // Still show empty gracefully
      renderEntriesList([]);
      updateMonthlyTotal([]);
      return;
    }

    const data = res.data || [];
    const dateField = pickDateField(data[0]) || "created_at";

    const entries = data
      .map(r => {
        const d = r[dateField];
        const dt = d ? new Date(d) : null;
        return { ...r, _dt: dt ? dt.toISOString() : null };
      })
      .filter(r => {
        if (!r._dt) return false;
        const t = new Date(r._dt).getTime();
        return t >= bounds.start.getTime() && t < bounds.end.getTime();
      })
      .sort((a,b) => (b._dt || "").localeCompare(a._dt || ""));

    renderEntriesList(entries);
    updateMonthlyTotal(entries);
  }

  async function loadCommunitiesForCurrentUser() {
    setBadge("v2009 • Stable community rows + mileage input + Add button (auto month default)");
    const sb = await ensureSb();
    const { data: sess, error: sessErr } = await sb.auth.getSession();
    if (sessErr) throw sessErr;
    const authId = sess?.session?.user?.id;
    mzState.authId = authId || null;
    if (!authId) {
      setBadge("v2009 • Not signed in");
      mzState.communities = [];
      mzState.communityById = {};
      return [];
    }

    // 1) assignments
    const a = await sb.from("CommunityAssignments").select("community_id,user_id").eq("user_id", authId);
    if (a.error) throw a.error;
    const ids = (a.data || []).map(r => r.community_id).filter(Boolean);
    if (!ids.length) return [];

    // 2) communities
    const pc = await sb.from("PropertyCommunities").select("id,name,company").in("id", ids);
    if (pc.error) throw pc.error;

    // sort by name
    const list = (pc.data || []).slice().sort((x,y)=>String(x.name||"").localeCompare(String(y.name||"")));
    mzState.communities = list;
    mzState.communityById = Object.fromEntries(list.map(c => [c.id, c]));
    return list;
  }

  async function refresh() {
    try {
      const communities = await loadCommunitiesForCurrentUser();

      // populate community select (optional)
      const sel = el("zummeeCommunitySelect");
      if (sel) {
        sel.innerHTML = "";
        for (const c of communities) {
          const opt = document.createElement("option");
          opt.value = c.id;
          opt.textContent = c.name;
          sel.appendChild(opt);
        }
      }

      renderRows(communities);
    } catch (e) {
      console.error(e);
      setBadge("v2009 • Error: " + (e.message || String(e)));
    }
  }

  // expose for debugging
  window.renderCommunitiesTable = refresh;
  window.refreshUI = refresh;

  document.addEventListener("DOMContentLoaded", function() {
    // default to current month
    setDefaultMonth();

    // load assigned communities and render rows
    refresh().then(() => loadEntriesForSelectedMonth());
    const mp = el("monthPick");
    if (mp) mp.addEventListener("change", () => loadEntriesForSelectedMonth());
  });
})();
</script>

</body>
</html>
