
      function byId(id){ return document.getElementById(id); }
      function monthKey(dt){
        if(!dt) return '';
        var d = new Date(dt);
        if(isNaN(d.getTime())) return '';
        return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
      }
      function monthLabel(key){
        if(!key) return 'Unknown';
        var parts = String(key).split('-');
        var y = Number(parts[0] || 0), m = Number(parts[1] || 1);
        var d = new Date(y, Math.max(0, m - 1), 1);
        try{ return d.toLocaleString(undefined, { month:'long', year:'numeric' }); }catch(_e){ return key; }
      }
      function safeNameFromEmail(email){
        var local = String(email || '').trim().split('@')[0] || '';
        if(!local) return 'Unknown Employee';
        return local.replace(/[._-]+/g,' ').replace(/\s+/g,' ').trim().replace(/\b\w/g, function(ch){ return ch.toUpperCase(); });
      }
      function gradeInfo(pct){
        if(pct == null || !isFinite(pct)) return { grade:'—', style:'#dbeafe', text:'#163451' };
        if(pct >= 90) return { grade:'A', style:'#dcfce7', text:'#166534' };
        if(pct >= 80) return { grade:'B', style:'#dbeafe', text:'#1d4ed8' };
        if(pct >= 70) return { grade:'C', style:'#fef3c7', text:'#92400e' };
        if(pct >= 60) return { grade:'D', style:'#fde68a', text:'#92400e' };
        return { grade:'F', style:'#fee2e2', text:'#991b1b' };
      }
      function isDoneStatus(s){
        s = String(s || '').trim().toLowerCase();
        return s === 'completed' || s === 'closed' || s === 'done';
      }
      function isActiveStatus(s){
        s = String(s || '').trim().toLowerCase();
        return ['active','in_progress','assigned_to_vendor','assigned','sent_to_vendor','awaiting_vendor','awaiting_response'].includes(s);
      }
      function toTs(v){
        var t = v ? new Date(v).getTime() : NaN;
        return Number.isFinite(t) ? t : NaN;
      }
      function diffHours(start, end){
        var a = toTs(start), b = toTs(end);
        if(!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
        return (b - a) / 36e5;
      }
      function diffDays(start, end){
        var a = toTs(start), b = toTs(end);
        if(!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
        return (b - a) / 864e5;
      }
      function avg(arr){
        var vals = (arr || []).filter(function(v){ return typeof v === 'number' && isFinite(v); });
        if(!vals.length) return null;
        return vals.reduce(function(sum, v){ return sum + v; }, 0) / vals.length;
      }
      function fmtDays(v){
        if(v == null || !isFinite(v)) return '—';
        return (Math.round(v * 10) / 10).toFixed(1) + 'd';
      }
      function fmtHours(v){
        if(v == null || !isFinite(v)) return '—';
        return (Math.round(v * 10) / 10).toFixed(1) + 'h';
      }
      function fmtDate(v){
        if(!v) return '—';
        var d = new Date(v);
        if(isNaN(d.getTime())) return '—';
        try{ return d.toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' }); }catch(_e){ return String(v).slice(0,10); }
      }
      function residentGradeInfo(completionPct, vendorAvgHours, agingCount){
        var score = 100;
        if(completionPct == null || !isFinite(completionPct)) return { grade:'—', style:'#dbeafe', text:'#163451', score:null };
        score = completionPct;
        if(vendorAvgHours != null && isFinite(vendorAvgHours)){
          if(vendorAvgHours <= 4) score += 5;
          else if(vendorAvgHours <= 24) score += 2;
          else if(vendorAvgHours > 48) score -= 8;
          else if(vendorAvgHours > 24) score -= 4;
        }
        if(agingCount > 0) score -= Math.min(agingCount * 4, 16);
        score = Math.max(0, Math.min(100, Math.round(score)));
        var g = gradeInfo(score);
        g.score = score;
        return g;
      }
      function meanGrade(parts){
        var vals = (parts || []).filter(function(v){ return typeof v === 'number' && isFinite(v); });
        if(!vals.length) return null;
        return Math.round(vals.reduce(function(sum, v){ return sum + v; }, 0) / vals.length);
      }
      function isInspectionOrigin(r){
        var unitNumber = String((r && r.unit_number) || '').trim().toLowerCase();
        var description = String((r && r.description) || '').trim().toLowerCase();
        var subject = String((r && r.subject) || '').trim().toLowerCase();
        if(unitNumber === 'inspection') return true;
        if(description.indexOf('created from community inspection.') === 0) return true;
        if(subject.indexOf('inspection issue - ') === 0 && unitNumber === 'inspection') return true;
        return false;
      }
      function isRealResidentOrigin(r){
        var residentEmail = String((r && r.resident_email) || '').trim().toLowerCase();
        var residentName = String((r && r.resident_name) || '').trim().toLowerCase();
        if(!residentEmail && !residentName) return false;
        if(residentEmail.endsWith('@zummee.local')) return false;
        if(residentName === 'board member request') return false;
        if(isInspectionOrigin(r)) return false;
        return true;
      }

      var insightsCount = null;
      var insightsList = null;
      var insightsFootnote = null;
      var rankingCount = null;
      var rankingList = null;
      var rankingFootnote = null;
      var complianceGrade = null;
      var complianceCompleted = null;
      var complianceAssigned = null;
      var compliancePercent = null;
      var complianceFootnote = null;
      var complianceList = null;

      function renderInsights(items, footnote){
        if(insightsCount) insightsCount.textContent = String((items || []).length);
        if(insightsList){
          if(items && items.length){
            insightsList.innerHTML = items.map(function(item){
              var tone = String((item && item.tone) || 'good').trim();
              var icon = String((item && item.icon) || 'i').trim();
              var text = String((item && item.text) || '').trim();
              return '<div class="insight-item ' + tone + '"><strong style="margin-right:8px;">' + icon + '</strong><span>' + text + '</span></div>';
            }).join('');
          }else{
            insightsList.innerHTML = '<div class="insight-item"><span>No performance signals yet.</span></div>';
          }
        }
        if(insightsFootnote) insightsFootnote.textContent = footnote || 'Signals are built from the current live work-order and resident-service metrics so supervisors can quickly see strengths and attention areas.';
      }

      function renderRanking(rows, selectedEmail, month){
        if(rankingCount) rankingCount.textContent = String((rows || []).length);
        if(rankingList){
          if(rows && rows.length){
            rankingList.innerHTML = rows.map(function(row, idx){
              var isSelected = selectedEmail && row.email === selectedEmail;
              var badge = idx === 0 ? 'Top performer' : ((row.overallScore != null && row.overallScore < 60) ? 'Needs attention' : 'Active');
              var badgeClass = idx === 0 ? 'top' : ((row.overallScore != null && row.overallScore < 60) ? 'attention' : 'active');
              return ''
                + '<div class="ranking-row' + (isSelected ? ' selected' : '') + '">'
                +   '<div class="ranking-pos">#' + (idx + 1) + '</div>'
                +   '<div class="ranking-person">'
                +     '<div class="ranking-name">' + row.name + (isSelected ? ' · Selected' : '') + '</div>'
                +     '<div class="ranking-badge ' + badgeClass + '">' + badge + '</div>'
                +   '</div>'
                +   '<div class="ranking-stat"><div class="ranking-stat-value">' + (row.workOrderPct == null ? '—' : (row.workOrderPct + '%')) + '</div><div class="ranking-stat-label">Work Orders</div></div>'
                +   '<div class="ranking-stat"><div class="ranking-stat-value">' + (row.residentPct == null ? '—' : (row.residentPct + '%')) + '</div><div class="ranking-stat-label">Resident</div></div>'
                +   '<div class="ranking-stat hide-md"><div class="ranking-stat-value">' + (row.compliancePct == null ? '—' : (row.compliancePct + '%')) + '</div><div class="ranking-stat-label">Compliance</div></div>'
                +   '<div class="ranking-stat hide-md"><div class="ranking-stat-value">' + (row.overallGrade || '—') + '</div><div class="ranking-stat-label">Overall</div></div>'
                + '</div>';
            }).join('');
          }else{
            rankingList.innerHTML = '<div class="ranking-empty">' + (month ? 'No employees have reportable work-order data for ' + monthLabel(month) + '.' : 'Choose a month to build the company ranking.') + '</div>';
          }
        }
        if(rankingFootnote){
          rankingFootnote.textContent = month
            ? ('Ranking is based on the same live score inputs used in the selected employee report for ' + monthLabel(month) + '.')
            : 'Ranking is based on the same live score inputs used in the selected employee report so supervisors can compare performance without leaving the page.';
        }
      }

      function renderCompliance(metrics, name, month){
        metrics = metrics || {};
        var completedCount = Number(metrics.completedCount || 0);
        var assignedCount = Number(metrics.assignedCount || 0);
        var pct = (metrics.pct == null || !isFinite(metrics.pct)) ? null : Number(metrics.pct);
        var gi = pct == null ? { grade:'—', style:'#e2e8f0', text:'#17324d' } : gradeInfo(pct);
        if(complianceCompleted) complianceCompleted.textContent = String(completedCount);
        if(complianceAssigned) complianceAssigned.textContent = String(assignedCount);
        if(compliancePercent) compliancePercent.textContent = pct == null ? '—' : (pct + '%');
        if(complianceGrade){
          complianceGrade.textContent = gi.grade;
          complianceGrade.style.background = gi.style;
          complianceGrade.style.color = gi.text;
        }
        if(complianceList){
          var items = Array.isArray(metrics.items) ? metrics.items : [];
          if(items.length){
            complianceList.innerHTML = items.map(function(item){
              var cname = String(item.community_name || item.communityName || 'Community').trim() || 'Community';
              var when = fmtDate(item.completed_at || item.completedAt);
              return '<div class="ranking-row"><div class="ranking-person"><div class="ranking-name">' + cname + '</div><div class="ranking-badge active">Completed</div></div><div class="ranking-stat"><div class="ranking-stat-value">' + when + '</div><div class="ranking-stat-label">Completed On</div></div></div>';
            }).join('');
          } else {
            complianceList.innerHTML = '<div class="ranking-empty">' + (month ? ('No compliance drives were marked complete for ' + monthLabel(month) + '.') : 'Choose a month to load compliance completion activity.') + '</div>';
          }
        }
        if(complianceFootnote){
          if(!month){
            complianceFootnote.textContent = name && name !== 'Choose employee'
              ? ('Choose a month to show completed monthly compliance drives for ' + name + '.')
              : 'Choose an employee and month to show completed monthly compliance drives by community.';
          } else if(metrics.tableMissing){
            complianceFootnote.textContent = 'Compliance tracking table is not set up yet. Run the SQL setup, then Mileage Tracker will write community completion records here.';
          } else if(!assignedCount){
            complianceFootnote.textContent = 'No assigned communities were found for this employee in the active company, so completion coverage cannot be calculated yet.';
          } else {
            complianceFootnote.textContent = 'Compliance coverage for ' + name + ' · ' + monthLabel(month) + '. Completed ' + completedCount + ' of ' + assignedCount + ' assigned communities.';
          }
        }
      }

      async function getSb(){
        try{ if(window.sb && typeof window.sb.from === 'function') return window.sb; }catch(_e){}
        try{ if(typeof window.ensureSupabase === 'function'){ const sb = await window.ensureSupabase(); if(sb) return sb; } }catch(_e){}
        try{
          if(window.supabase && typeof window.supabase.createClient === 'function'){
            return window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
          }
        }catch(_e){}
        return null;
      }

      

async function initShell(){
        var employeeSel = byId('perfEmployeeSelect');
        var monthSel = byId('perfMonthSelect');
        var companyInput = byId('perfCompanyName');
        var statusInput = byId('perfReportStatus');
        var summaryEmployee = byId('perfSummaryEmployee');
        var summaryMonth = byId('perfSummaryMonth');
        var printStatus = byId('perfPrintStatus');
        var workOrdersGrade = byId('metricWorkOrdersGrade');
        var residentGrade = byId('metricResidentGrade');
        var overallGrade = byId('perfOverallGrade');
        var workOrdersFootnote = byId('metricWorkOrdersFootnote');
        var residentFootnote = byId('metricResidentFootnote');
        insightsCount = byId('metricInsightsCount');
        insightsList = byId('metricInsightsList');
        insightsFootnote = byId('metricInsightsFootnote');
        rankingCount = byId('metricRankingCount');
        rankingList = byId('metricRankingList');
        rankingFootnote = byId('metricRankingFootnote');
        if(!employeeSel || !monthSel) return;
        complianceGrade = byId('metricComplianceGrade');
        complianceCompleted = byId('metricComplianceCompleted');
        complianceAssigned = byId('metricComplianceAssigned');
        compliancePercent = byId('metricCompliancePercent');
        complianceFootnote = byId('metricComplianceFootnote');
        complianceList = byId('metricComplianceList');
        if(!employeeSel || !monthSel) return;

        byId('perfPrintBtn')?.addEventListener('click', function(){ window.print(); });
        byId('perfRefreshBtn')?.addEventListener('click', function(){ initShell(); });

        var companyId = '';
        try{ companyId = String(window.__activeCompanyId || localStorage.getItem('activeCompanyId') || '').trim(); }catch(_e){}
        companyInput.value = companyId ? ('Company ID: ' + companyId) : 'No company selected';
        statusInput.value = 'Loading employee performance…';
        if(printStatus) printStatus.textContent = 'Ready';

        var sb = await getSb();
        if(!sb){
          statusInput.value = 'Supabase unavailable';
          return;
        }

        var communityIds = [];
        var communityNamesById = {};
        if(companyId){
          try{
            var commRes = await sb.from('PropertyCommunities').select('id,name').eq('company_id', companyId).limit(5000);
            if(commRes && !commRes.error && Array.isArray(commRes.data)){
              communityIds = commRes.data.map(function(r){ return String(r.id || '').trim(); }).filter(Boolean);
              var communityNamesById = Object.fromEntries(commRes.data.map(function(r){ return [String(r.id || '').trim(), String(r.name || '').trim()]; }));
            }
          }catch(_e){}
        }

        var employees = {};
        try{
          var ud = sb.from('userdirectory').select('auth_user_id, profile_name, profile_email, company_id, approved').eq('approved', true).limit(5000);
          if(companyId) ud = ud.eq('company_id', companyId);
          var udRes = await ud;
          if(udRes && !udRes.error && Array.isArray(udRes.data)){
            udRes.data.forEach(function(r){
              var em = String(r.profile_email || '').trim().toLowerCase();
              if(!em) return;
              employees[em] = {
                email: em,
                user_id: String(r.auth_user_id || '').trim() || null,
                name: String(r.profile_name || '').trim() || safeNameFromEmail(em)
              };
            });
          }
        }catch(_e){}


        var assignmentsByUserId = {};
        try{
          var assignReq = sb.from('CommunityAssignments').select('user_id, community_id').limit(5000);
          if(communityIds.length) assignReq = assignReq.in('community_id', communityIds);
          var assignRes = await assignReq;
          if(assignRes && !assignRes.error && Array.isArray(assignRes.data)){
            assignRes.data.forEach(function(r){
              var uid = String(r.user_id || '').trim();
              var cid = String(r.community_id || '').trim();
              if(!uid || !cid) return;
              if(!assignmentsByUserId[uid]) assignmentsByUserId[uid] = {};
              assignmentsByUserId[uid][cid] = true;
            });
          }
        }catch(_e){}

        async function loadComplianceRows(){
          var attempts = [
            { select:'id, employee_user_id, employee_email, employee_name, company_id, community_id, community_name, completed_at, month_key, created_at', filter:'company' },
            { select:'id, employee_user_id, employee_email, employee_name, community_id, community_name, completed_at, month_key, created_at', filter:'community' },
            { select:'id, employee_user_id, community_id, community_name, completed_at, month_key', filter:'community' },
            { select:'id, employee_user_id, community_id, community_name, completed_at, month_key', filter:'none' }
          ];
          var lastError = null;
          for(var i=0;i<attempts.length;i++){
            try{
              var attempt = attempts[i];
              var rq = sb.from('mileage_compliance_completions').select(attempt.select).limit(5000);
              if(attempt.filter === 'company' && companyId) rq = rq.eq('company_id', companyId);
              else if(attempt.filter === 'community' && communityIds.length) rq = rq.in('community_id', communityIds);
              var rr = await rq;
              if(rr && !rr.error && Array.isArray(rr.data)) return { data: rr.data.slice(), error:null, tableMissing:false };
              lastError = rr && rr.error ? rr.error : lastError;
            }catch(err){ lastError = err || lastError; }
          }
          var msg = String((lastError && (lastError.message || lastError.details || lastError.hint)) || '').toLowerCase();
          var missing = msg.indexOf('mileage_compliance_completions') >= 0 || msg.indexOf('relation') >= 0 || msg.indexOf('does not exist') >= 0;
          if(lastError) console.warn('[employee-performance] mileage_compliance_completions unavailable', lastError);
          return { data: [], error:lastError, tableMissing: missing || !lastError };
        }
        var complianceLoad = await loadComplianceRows();
        var complianceRows = Array.isArray(complianceLoad && complianceLoad.data) ? complianceLoad.data.slice() : [];
        async function loadResidentRows(){
          var selectAttempts = [
            'id, company_id, community_id, status, subject, description, unit_number, priority, submitted_at, updated_at, completed_at, vendor_dispatched_at, vendor_accepted_at, vendor_response_status, employee_user_id, employee_email, employee_name, resident_name, resident_email',
            'id, company_id, community_id, status, subject, priority, submitted_at, updated_at, completed_at, vendor_dispatched_at, vendor_accepted_at, vendor_response_status, employee_user_id, employee_email, employee_name, resident_name, resident_email',
            'id, company_id, community_id, status, subject, description, unit_number, priority, submitted_at, updated_at, completed_at, vendor_dispatched_at, vendor_accepted_at, employee_user_id, employee_email, employee_name, resident_name, resident_email',
            'id, company_id, community_id, status, subject, priority, submitted_at, updated_at, completed_at, vendor_dispatched_at, vendor_accepted_at, employee_user_id, employee_email, employee_name, resident_name, resident_email',
            'id, community_id, status, submitted_at, updated_at, employee_user_id, employee_email, employee_name, resident_name, resident_email'
          ];
          var lastError = null;
          for(var i=0;i<selectAttempts.length;i++){
            try{
              var rq = sb.from('resident_work_orders').select(selectAttempts[i]).limit(5000);
              if(communityIds.length) rq = rq.in('community_id', communityIds);
              var rr = await rq;
              if(rr && !rr.error && Array.isArray(rr.data)){
                return { data: rr.data.slice(), selectUsed: selectAttempts[i], error: null };
              }
              lastError = rr && rr.error ? rr.error : lastError;
            }catch(err){
              lastError = err || lastError;
            }
          }
          return { data: [], selectUsed: '', error: lastError };
        }

        var loadRowsRes = await loadResidentRows();
        var rawRows = Array.isArray(loadRowsRes && loadRowsRes.data) ? loadRowsRes.data.slice() : [];
        if(!rawRows.length && loadRowsRes && loadRowsRes.error){
          console.warn('[employee-performance] resident_work_orders query fallback exhausted', loadRowsRes.error);
        }

        function rowEmail(r){ return String(r.employee_email || '').trim().toLowerCase(); }
        function rowUserId(r){ return String(r.employee_user_id || '').trim(); }
        function normalizeName(v){ return String(v || '').trim().replace(/\s+/g, ' ').toLowerCase(); }
        function makeEmployeeState(seed){
          seed = seed || {};
          return {
            userId: String(seed.userId || seed.user_id || '').trim(),
            email: String(seed.email || '').trim().toLowerCase(),
            name: String(seed.name || '').trim()
          };
        }
        function employeeMatchesRow(employee, r){
          employee = makeEmployeeState(employee);
          if(!employee.userId && !employee.email && !employee.name) return false;
          var uid = rowUserId(r);
          var em = rowEmail(r);
          var nm = normalizeName(r && r.employee_name);
          if(employee.userId && uid) return uid === employee.userId;
          if(employee.email && em) return em === employee.email;
          if(employee.name && nm) return nm === normalizeName(employee.name);
          return false;
        }
        function buildEmployeeStateFromEmail(email){
          var roster = employees[email] || {};
          return makeEmployeeState({ userId: roster.user_id, email: email, name: roster.name || safeNameFromEmail(email) });
        }
        function getSelectedEmployee(){
          if(!employeeSel) return makeEmployeeState();
          var idx = employeeSel.selectedIndex;
          var opt = idx >= 0 ? employeeSel.options[idx] : null;
          if(!opt) return makeEmployeeState();
          return makeEmployeeState({
            userId: opt.dataset.userId || opt.value,
            email: opt.dataset.email || '',
            name: opt.dataset.name || opt.textContent || ''
          });
        }
        var reportState = { employee: makeEmployeeState(), month: '' };

        var rows = rawRows.filter(function(r){
          var status = String(r.status || '').trim().toLowerCase();
          var hasDate = !!(r.submitted_at || r.updated_at);
          var hasOwner = !!rowEmail(r) || !!rowUserId(r);
          return hasDate && hasOwner && status !== 'draft' && status !== 'test';
        });

        // Show company roster employees when they have snapshot-backed work order data by email OR user id.
        // This fixes the dropdown disappearing when rows are tied only by employee_user_id.
        var employeeKeysWithData = {};
        var employeeUserIdsWithData = {};
        rows.forEach(function(r){
          var email = rowEmail(r);
          var uid = rowUserId(r);
          if(email) employeeKeysWithData[email] = true;
          if(uid) employeeUserIdsWithData[uid] = true;
        });

        var employeeList = Object.keys(employees)
          .filter(function(email){
            var uid = employees[email] && employees[email].user_id ? employees[email].user_id : '';
            return !!employeeKeysWithData[email] || (!!uid && !!employeeUserIdsWithData[uid]);
          })
          .sort(function(a,b){ return employees[a].name.localeCompare(employees[b].name); });

        // Safety fallback: if the roster filter still yields nothing, show the company roster so supervisors can at least pick employees.
        if(!employeeList.length){
          employeeList = Object.keys(employees).sort(function(a,b){ return employees[a].name.localeCompare(employees[b].name); });
        }

        var allMonths = Array.from(new Set(rows.map(function(r){
          return monthKey(r.submitted_at || r.updated_at);
        }).filter(Boolean))).sort().reverse();

        function monthsForEmployee(employee){
          employee = makeEmployeeState(employee);
          var scoped = rows.filter(function(r){ return employeeMatchesRow(employee, r); });
          var months = Array.from(new Set(scoped.map(function(r){
            return monthKey(r.submitted_at || r.updated_at);
          }).filter(Boolean))).sort().reverse();
          return months.length ? months : allMonths.slice();
        }

        employeeSel.innerHTML = '<option value="">Choose employee</option>' + employeeList.map(function(email){
          var employee = buildEmployeeStateFromEmail(email);
          var optionValue = employee.userId || employee.email;
          return '<option value="' + optionValue + '" data-email="' + employee.email + '" data-user-id="' + employee.userId + '" data-name="' + employee.name.replace(/"/g, '&quot;') + '">' + employee.name + '</option>';
        }).join('');

        function renderMonthOptions(selectedEmployee, keepValue){
          var months = monthsForEmployee(selectedEmployee);
          monthSel.innerHTML = '<option value="">Choose month</option>' + months.map(function(m){
            return '<option value="' + m + '">' + monthLabel(m) + '</option>';
          }).join('');
          if(keepValue && months.includes(keepValue)) monthSel.value = keepValue;
          else if(months.length) monthSel.value = months[0];
          else monthSel.value = '';
        }

        if(employeeList.length){
          var firstEmployee = buildEmployeeStateFromEmail(employeeList[0]);
          employeeSel.value = firstEmployee.userId || firstEmployee.email;
          reportState.employee = firstEmployee;
        }
        renderMonthOptions(reportState.employee, '');

        statusInput.value = employeeList.length
          ? (rows.length
              ? 'Connected · employee and resident service metrics live'
              : 'Roster loaded · work order metrics unavailable or no matching rows yet')
          : (rows.length
              ? 'Work order data loaded · no matching approved employees found in roster'
              : 'No snapshot-backed work orders found for the active company communities yet');

        function resetMetric(name, month){
          var hasEmployee = !!name && name !== 'Choose employee';
          if(summaryEmployee) summaryEmployee.textContent = hasEmployee ? name : 'Choose employee';
          if(summaryMonth) summaryMonth.textContent = month ? monthLabel(month) : 'Choose a month to build the report.';
          byId('metricWorkOrdersSubmitted').textContent = '0';
          byId('metricWorkOrdersCompleted').textContent = '0';
          byId('metricWorkOrdersPercent').textContent = '—';
          byId('metricResidentSubmitted').textContent = '0';
          byId('metricResidentCompleted').textContent = '0';
          byId('metricResidentPercent').textContent = '—';
          byId('metricResidentAvgCompletion').textContent = '—';
          byId('metricResidentVendorResponse').textContent = '—';
          byId('metricResidentAging').textContent = '0';
          renderCompliance({ completedCount:0, assignedCount:0, pct:null, items:[], tableMissing:false }, hasEmployee ? name : '', month || '');
          if(workOrdersGrade){
            workOrdersGrade.textContent = '—';
            workOrdersGrade.style.background = '#e2e8f0';
            workOrdersGrade.style.color = '#17324d';
          }
          if(residentGrade){
            residentGrade.textContent = '—';
            residentGrade.style.background = '#e2e8f0';
            residentGrade.style.color = '#17324d';
          }
          if(overallGrade){
            overallGrade.textContent = '—';
            overallGrade.style.background = '#dbeafe';
            overallGrade.style.color = '#163451';
          }
          if(workOrdersFootnote){
            workOrdersFootnote.textContent = hasEmployee
              ? ('Choose a month to calculate submitted, completed, completion %, and grade for ' + name + '.')
              : 'Choose an employee and month to calculate submitted, completed, completion %, and grade.';
          }
          if(residentFootnote){
            residentFootnote.textContent = hasEmployee
              ? ('Choose a month to calculate resident service load, completion speed, vendor response timing, and aging risk for ' + name + '.')
              : 'Choose an employee and month to calculate resident service load, completion speed, vendor response timing, and aging risk.';
          }
          renderInsights([], hasEmployee
            ? ('Choose a month to generate performance insights for ' + name + '.')
            : 'Signals are built from the current live work-order and resident-service metrics so supervisors can quickly see strengths and attention areas.', hasEmployee
            ? ('Choose a month to generate performance insights for ' + name + '.')
            : 'Choose a month to generate performance insights.');
          renderRanking([], hasEmployee ? name : '', month || '', hasEmployee
            ? ('Choose a month to build the company ranking and highlight ' + name + '.')
            : 'Choose a month to build the company ranking.');
        }

        function buildEmployeeMonthMetrics(employee, month){
          employee = makeEmployeeState(employee);
          var employeeRowSet = rows.filter(function(r){ return employeeMatchesRow(employee, r); });
          var submitted = 0, completed = 0, sentToVendor = 0, activeNow = 0;

          employeeRowSet.forEach(function(r){
            var status = String(r.status || '').trim().toLowerCase();
            var submittedMonth = monthKey(r.submitted_at || r.updated_at);
            var completedMonth = monthKey(r.completed_at || r.updated_at);
            if(submittedMonth === month){
              submitted += 1;
              if(['sent_to_vendor','awaiting_vendor','assigned','awaiting_response'].includes(status)) sentToVendor += 1;
              if(isActiveStatus(status)) activeNow += 1;
            }
            if(completedMonth === month && isDoneStatus(status)) completed += 1;
          });

          var pct = submitted > 0 ? Math.round((completed / submitted) * 100) : null;
          var g = gradeInfo(pct);

          var residentAttributed = rows.filter(function(r){
            return isRealResidentOrigin(r) && employeeMatchesRow(employee, r);
          });
          var residentCompanyWide = rows.filter(function(r){ return isRealResidentOrigin(r); });
          var residentScopedSource = residentAttributed.length ? residentAttributed : residentCompanyWide;
          var residentScopeLabel = residentAttributed.length ? 'employee-attributed' : 'company-wide fallback';
          var residentMonthRows = residentScopedSource.filter(function(r){ return monthKey(r.submitted_at || r.updated_at) === month; });

          var residentSubmitted = residentMonthRows.length;
          var residentCompleted = 0;
          var residentActive = 0;
          var agingCount = 0;
          var completionDays = [];
          var vendorHours = [];
          var nowTs = Date.now();

          residentMonthRows.forEach(function(r){
            var status = String(r.status || '').trim().toLowerCase();
            var startIso = r.submitted_at || r.updated_at;
            var doneIso = r.completed_at || r.updated_at;
            if(isDoneStatus(status) && monthKey(doneIso) === month){
              residentCompleted += 1;
              var cd = diffDays(startIso, doneIso);
              if(cd != null) completionDays.push(cd);
            }
            if(isActiveStatus(status) && !isDoneStatus(status)){
              residentActive += 1;
              var startTs = toTs(startIso);
              if(Number.isFinite(startTs) && ((nowTs - startTs) / 864e5) > 7) agingCount += 1;
            }
            var vh = diffHours(r.vendor_dispatched_at, r.vendor_accepted_at);
            if(vh != null) vendorHours.push(vh);
          });

          var residentPct = residentSubmitted > 0 ? Math.round((residentCompleted / residentSubmitted) * 100) : null;
          var residentAvgCompletion = avg(completionDays);
          var residentAvgVendor = avg(vendorHours);
          var rg = residentGradeInfo(residentPct, residentAvgVendor, agingCount);
          var employeeUserId = String(employee.userId || '').trim();
          var employeeEmail = String(employee.email || '').trim().toLowerCase();
          var assignedCommunityIds = employeeUserId && assignmentsByUserId[employeeUserId] ? Object.keys(assignmentsByUserId[employeeUserId]) : [];
          var complianceItemsByCommunity = {};
          complianceRows.forEach(function(r){
            var rowMonth = String(r.month_key || monthKey(r.completed_at || r.created_at) || '').trim();
            if(rowMonth !== month) return;
            var uid = String(r.employee_user_id || '').trim();
            var rem = String(r.employee_email || '').trim().toLowerCase();
            if((employeeUserId && uid && uid !== employeeUserId) && rem !== employeeEmail) return;
            if(!(employeeUserId ? (uid === employeeUserId || rem === employeeEmail) : (rem === employeeEmail))) return;
            var cid = String(r.community_id || '').trim();
            if(!cid) return;
            var existing = complianceItemsByCommunity[cid];
            var ts = toTs(r.completed_at || r.created_at);
            if(!existing || ts > toTs(existing.completed_at || existing.created_at)){
              complianceItemsByCommunity[cid] = {
                community_id: cid,
                community_name: String(r.community_name || communityNamesById[cid] || 'Community').trim() || 'Community',
                completed_at: r.completed_at || r.created_at || null
              };
            }
          });
          var complianceItems = Object.keys(complianceItemsByCommunity).map(function(k){ return complianceItemsByCommunity[k]; }).sort(function(a,b){ return toTs(b.completed_at) - toTs(a.completed_at); });
          var completedCommunityIds = Object.keys(complianceItemsByCommunity);
          var missingComplianceNames = assignedCommunityIds.filter(function(cid){ return completedCommunityIds.indexOf(cid) === -1; }).map(function(cid){
            return String(communityNamesById[cid] || 'Community').trim() || 'Community';
          });
          var complianceCompletedCount = complianceItems.length;
          var complianceAssignedCount = assignedCommunityIds.length;
          var compliancePct = complianceAssignedCount > 0 ? Math.round((complianceCompletedCount / complianceAssignedCount) * 100) : null;
          var complianceG = compliancePct == null ? { grade:'—', style:'#e2e8f0', text:'#17324d', score:null } : (function(){ var x = gradeInfo(compliancePct); x.score = compliancePct; return x; })();
          var overallScore = meanGrade([pct, rg.score, compliancePct]);
          var overall = gradeInfo(overallScore);

          return {
            userId: employee.userId || '',
            email: employee.email || '',
            name: employee.name || safeNameFromEmail(employee.email || ''),
            submitted: submitted,
            completed: completed,
            sentToVendor: sentToVendor,
            activeNow: activeNow,
            workOrderPct: pct,
            workOrderGrade: g,
            residentSubmitted: residentSubmitted,
            residentCompleted: residentCompleted,
            residentActive: residentActive,
            agingCount: agingCount,
            residentPct: residentPct,
            residentAvgCompletion: residentAvgCompletion,
            residentAvgVendor: residentAvgVendor,
            residentGrade: rg,
            residentScopeLabel: residentScopeLabel,
            complianceCompletedCount: complianceCompletedCount,
            complianceAssignedCount: complianceAssignedCount,
            compliancePct: compliancePct,
            complianceGrade: complianceG,
            complianceItems: complianceItems,
            missingComplianceNames: missingComplianceNames,
            complianceTableMissing: !!(complianceLoad && complianceLoad.tableMissing),
            overallScore: overallScore,
            overallGrade: overall.grade
          };
        }

        function updatePreview(){
          reportState.employee = getSelectedEmployee();
          var employee = reportState.employee;
          var currentMonth = String(monthSel.value || '').trim();
          renderMonthOptions(employee, currentMonth);
          var month = String(monthSel.value || '').trim();
          reportState.month = month;
          var hasEmployee = !!(employee && (employee.userId || employee.email || employee.name));
          var name = hasEmployee ? (employee.name || safeNameFromEmail(employee.email || '')) : 'Choose employee';

          if(!hasEmployee || !month){
            resetMetric(name, month);
            return;
          }

          var metrics = buildEmployeeMonthMetrics(employee, month);
          var submitted = metrics.submitted;
          var completed = metrics.completed;
          var sentToVendor = metrics.sentToVendor;
          var activeNow = metrics.activeNow;
          var pct = metrics.workOrderPct;
          var g = metrics.workOrderGrade;
          var residentSubmitted = metrics.residentSubmitted;
          var residentCompleted = metrics.residentCompleted;
          var residentActive = metrics.residentActive;
          var agingCount = metrics.agingCount;
          var residentPct = metrics.residentPct;
          var residentAvgCompletion = metrics.residentAvgCompletion;
          var residentAvgVendor = metrics.residentAvgVendor;
          var rg = metrics.residentGrade;
          var residentScopeLabel = metrics.residentScopeLabel;
          var overallScore = metrics.overallScore;
          var overall = gradeInfo(overallScore);
          var complianceCompletedCount = metrics.complianceCompletedCount;
          var complianceAssignedCount = metrics.complianceAssignedCount;
          var compliancePct = metrics.compliancePct;
          var complianceItems = metrics.complianceItems;
          var missingComplianceNames = metrics.missingComplianceNames || [];
          var complianceTableMissing = metrics.complianceTableMissing;

          if(summaryEmployee) summaryEmployee.textContent = name;
          if(summaryMonth) summaryMonth.textContent = monthLabel(month);
          byId('metricWorkOrdersSubmitted').textContent = String(submitted);
          byId('metricWorkOrdersCompleted').textContent = String(completed);
          byId('metricWorkOrdersPercent').textContent = pct == null ? '—' : (pct + '%');
          byId('metricResidentSubmitted').textContent = String(residentSubmitted);
          byId('metricResidentCompleted').textContent = String(residentCompleted);
          byId('metricResidentPercent').textContent = residentPct == null ? '—' : (residentPct + '%');
          byId('metricResidentAvgCompletion').textContent = fmtDays(residentAvgCompletion);
          byId('metricResidentVendorResponse').textContent = fmtHours(residentAvgVendor);
          byId('metricResidentAging').textContent = String(agingCount);

          if(workOrdersGrade){
            workOrdersGrade.textContent = g.grade;
            workOrdersGrade.style.background = g.style;
            workOrdersGrade.style.color = g.text;
          }
          if(residentGrade){
            residentGrade.textContent = rg.grade;
            residentGrade.style.background = rg.style;
            residentGrade.style.color = rg.text;
          }
          if(overallGrade){
            overallGrade.textContent = overallScore == null ? '—' : overall.grade;
            overallGrade.style.background = overallScore == null ? '#dbeafe' : overall.style;
            overallGrade.style.color = overallScore == null ? '#163451' : overall.text;
          }
          if(workOrdersFootnote){
            var snapshotBits = [];
            if(sentToVendor) snapshotBits.push(sentToVendor + ' sent to vendor');
            if(activeNow) snapshotBits.push(activeNow + ' active');
            workOrdersFootnote.textContent =
              'Snapshot-backed work order metric for ' + name + ' · ' + monthLabel(month) + '. ' +
              (submitted === 0
                ? 'No submitted work orders for this month, so no grade is assigned.'
                : ('Grade is based on ' + completed + ' completed out of ' + submitted + ' submitted.')) +
              (snapshotBits.length ? ' Status snapshot: ' + snapshotBits.join(' · ') + '.' : '');
          }
          if(residentFootnote){
            var residentBits = [];
            if(residentActive) residentBits.push(residentActive + ' still active');
            if(agingCount) residentBits.push(agingCount + ' aging past 7 days');
            if(residentAvgVendor != null) residentBits.push('avg vendor acceptance ' + fmtHours(residentAvgVendor));
            residentFootnote.textContent =
              'Resident service metric for ' + name + ' · ' + monthLabel(month) + '. Scope: ' + residentScopeLabel + '. ' +
              (residentSubmitted === 0
                ? 'No resident-origin work orders were found for this month in the current scope.'
                : ('Completed ' + residentCompleted + ' of ' + residentSubmitted + ' resident requests.')) +
              (residentBits.length ? ' Service snapshot: ' + residentBits.join(' · ') + '.' : '');
          }

          renderCompliance({
            completedCount: complianceCompletedCount,
            assignedCount: complianceAssignedCount,
            pct: compliancePct,
            items: complianceItems,
            tableMissing: complianceTableMissing
          }, name, month);

          var insights = [];
          if(pct != null && pct >= 80){
            insights.push({ tone:'good', icon:'✓', text:'Strong completion rate for employee-created work orders this month.' });
          } else if(pct != null && pct < 50){
            insights.push({ tone:'bad', icon:'!', text:'Low completion rate on employee-created work orders this month.' });
          }
          if(submitted >= 5 && activeNow <= 2 && pct != null && pct >= 70){
            insights.push({ tone:'good', icon:'★', text:'Handled a solid work-order load while keeping active carryover relatively low.' });
          }
          if(activeNow > 5){
            insights.push({ tone:'warn', icon:'!', text:'High active workload. Supervisor may want to check capacity or vendor throughput.' });
          }
          if(sentToVendor > 3){
            insights.push({ tone:'warn', icon:'↗', text:'Several items are still sitting in sent-to-vendor status and may need follow-up.' });
          }
          if(agingCount > 0){
            insights.push({ tone:'bad', icon:'!', text:'Resident service has aging work orders past 7 days that need attention.' });
          }
          if(residentSubmitted > 0 && residentPct != null && residentPct < 50){
            insights.push({ tone:'warn', icon:'!', text:'Resident requests are not being completed efficiently yet this month.' });
          }
          if(residentAvgVendor != null && residentAvgVendor <= 12){
            insights.push({ tone:'good', icon:'✓', text:'Vendor acceptance speed is strong on resident-origin work orders.' });
          } else if(residentAvgVendor != null && residentAvgVendor > 24){
            insights.push({ tone:'warn', icon:'⏱', text:'Vendor response time is slow and may be affecting service speed.' });
          }
          if(complianceTableMissing){
            insights.push({ tone:'warn', icon:'i', text:'Compliance completion tracking is not fully wired until the new mileage compliance table is created.' });
          } else if(complianceAssignedCount > 0 && compliancePct != null && compliancePct >= 100){
            insights.push({ tone:'good', icon:'✓', text:'Monthly compliance drives are complete across all assigned communities.' });
          } else if(complianceAssignedCount > 0 && complianceCompletedCount === 0){
            var missingAllText = missingComplianceNames.length ? (' Missing: ' + missingComplianceNames.slice(0,3).join(', ') + (missingComplianceNames.length > 3 ? ', +' + (missingComplianceNames.length - 3) + ' more.' : '.')) : '';
            insights.push({ tone:'warn', icon:'!', text:'No assigned communities have been marked compliance complete yet this month.' + missingAllText });
          } else if(complianceAssignedCount > 0 && compliancePct != null && compliancePct < 100){
            var missingSomeText = missingComplianceNames.length ? (' Missing: ' + missingComplianceNames.slice(0,3).join(', ') + (missingComplianceNames.length > 3 ? ', +' + (missingComplianceNames.length - 3) + ' more.' : '.')) : '';
            insights.push({ tone:'warn', icon:'↗', text:'Compliance drives are only partially complete across assigned communities this month.' + missingSomeText });
          }
          if(!insights.length && submitted === 0 && residentSubmitted === 0){
            insights.push({ tone:'good', icon:'i', text:'No employee-created or resident-origin work orders were recorded for this month.' });
          } else if(!insights.length){
            insights.push({ tone:'good', icon:'i', text:'Performance signals are stable this month with no major risks triggered by current thresholds.' });
          }
          renderInsights(insights, 'Built from work-order completion, active load, sent-to-vendor snapshot, resident completion, vendor response timing, and aging risk for ' + name + ' in ' + monthLabel(month) + '.');

          var rankingRows = employeeList.map(function(employeeEmail){
            return buildEmployeeMonthMetrics(buildEmployeeStateFromEmail(employeeEmail), month);
          }).filter(function(row){
            return row && (row.submitted > 0 || row.residentSubmitted > 0 || row.overallScore != null);
          }).sort(function(a,b){
            var aScore = a.overallScore == null ? -1 : a.overallScore;
            var bScore = b.overallScore == null ? -1 : b.overallScore;
            if(bScore !== aScore) return bScore - aScore;
            if((b.completed || 0) !== (a.completed || 0)) return (b.completed || 0) - (a.completed || 0);
            return (a.name || '').localeCompare(b.name || '');
          });
          renderRanking(rankingRows, employee, month);
          try{ document.title = name + ' - ' + monthLabel(month) + ' - Employee Performance Report'; }catch(_e){}
        }

        employeeSel.addEventListener('change', updatePreview);
        monthSel.addEventListener('change', updatePreview);
        updatePreview();
      }

      document.addEventListener('DOMContentLoaded', initShell);
  