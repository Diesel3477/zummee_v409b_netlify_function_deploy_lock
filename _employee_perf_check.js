
    (function(){
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
      function isRealResidentOrigin(r){
        var residentEmail = String((r && r.resident_email) || '').trim().toLowerCase();
        var residentName = String((r && r.resident_name) || '').trim().toLowerCase();
        if(!residentEmail && !residentName) return false;
        if(residentEmail.endsWith('@zummee.local')) return false;
        if(residentName === 'board member request') return false;
        return true;
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
        if(companyId){
          try{
            var commRes = await sb.from('PropertyCommunities').select('id').eq('company_id', companyId).limit(5000);
            if(commRes && !commRes.error && Array.isArray(commRes.data)){
              communityIds = commRes.data.map(function(r){ return String(r.id || '').trim(); }).filter(Boolean);
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

        var q = sb.from('resident_work_orders').select('id, company_id, community_id, status, subject, priority, submitted_at, created_at, updated_at, completed_at, closed_at, vendor_dispatched_at, vendor_accepted_at, vendor_response_status, employee_user_id, employee_email, employee_name, resident_name, resident_email').limit(5000);
        if(communityIds.length) q = q.in('community_id', communityIds);
        var res = await q;
        if(res && res.error) throw res.error;
        var rawRows = Array.isArray(res && res.data) ? res.data.slice() : [];

        function rowEmail(r){ return String(r.employee_email || '').trim().toLowerCase(); }
        function rowUserId(r){ return String(r.employee_user_id || '').trim(); }

        var rows = rawRows.filter(function(r){
          var status = String(r.status || '').trim().toLowerCase();
          var hasDate = !!(r.submitted_at || r.updated_at);
          var hasOwner = !!rowEmail(r) || !!rowUserId(r);
          return hasDate && hasOwner && status !== 'draft' && status !== 'test';
        });

        // Only show company roster employees who actually have snapshot-backed work order data.
        var employeeKeysWithData = {};
        rows.forEach(function(r){
          var email = rowEmail(r);
          if(email) employeeKeysWithData[email] = true;
        });

        var employeeList = Object.keys(employees)
          .filter(function(email){ return !!employeeKeysWithData[email]; })
          .sort(function(a,b){ return employees[a].name.localeCompare(employees[b].name); });

        var allMonths = Array.from(new Set(rows.map(function(r){
          return monthKey(r.submitted_at || r.updated_at);
        }).filter(Boolean))).sort().reverse();

        function monthsForEmployee(email){
          var scoped = rows.filter(function(r){ return rowEmail(r) === email; });
          var months = Array.from(new Set(scoped.map(function(r){
            return monthKey(r.submitted_at || r.updated_at);
          }).filter(Boolean))).sort().reverse();
          return months.length ? months : allMonths.slice();
        }

        employeeSel.innerHTML = '<option value="">Choose employee</option>' + employeeList.map(function(email){
          return '<option value="' + email + '">' + employees[email].name + '</option>';
        }).join('');

        function renderMonthOptions(selectedEmail, keepValue){
          var months = monthsForEmployee(selectedEmail);
          monthSel.innerHTML = '<option value="">Choose month</option>' + months.map(function(m){
            return '<option value="' + m + '">' + monthLabel(m) + '</option>';
          }).join('');
          if(keepValue && months.includes(keepValue)) monthSel.value = keepValue;
          else if(months.length) monthSel.value = months[0];
          else monthSel.value = '';
        }

        if(employeeList.length) employeeSel.value = employeeList[0];
        renderMonthOptions(employeeSel.value || '', '');

        statusInput.value = employeeList.length
          ? 'Connected · employee and resident service metrics live'
          : 'No snapshot-backed work orders found for the active company communities yet';

        function resetMetric(name, month){
          if(summaryEmployee) summaryEmployee.textContent = name || 'Choose employee';
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
            workOrdersFootnote.textContent = 'Choose an employee and month to calculate submitted, completed, completion %, and grade.';
          }
          if(residentFootnote){
            residentFootnote.textContent = 'Choose an employee and month to calculate resident service load, completion speed, vendor response timing, and aging risk.';
          }
        }

        function updatePreview(){
          var email = String(employeeSel.value || '').trim().toLowerCase();
          var currentMonth = String(monthSel.value || '').trim();
          renderMonthOptions(email, currentMonth);
          var month = String(monthSel.value || '').trim();
          var name = email && employees[email] ? employees[email].name : 'Choose employee';

          if(!email || !month){
            resetMetric(name, month);
            return;
          }

          var employeeScoped = rows.filter(function(r){
            return rowEmail(r) === email || (employees[email] && employees[email].user_id && rowUserId(r) === employees[email].user_id);
          });
          var submitted = 0, completed = 0, sentToVendor = 0, activeNow = 0;

          employeeScoped.forEach(function(r){
            var status = String(r.status || '').trim().toLowerCase();
            var submittedMonth = monthKey(r.submitted_at || r.created_at);
            var completedMonth = monthKey(r.completed_at || r.closed_at || r.updated_at);

            if(submittedMonth === month){
              submitted += 1;
              if(['sent_to_vendor','awaiting_vendor','assigned','awaiting_response'].includes(status)) sentToVendor += 1;
              if(isActiveStatus(status)) activeNow += 1;
            }

            if(completedMonth === month && isDoneStatus(status)){
              completed += 1;
            }
          });

          var pct = submitted > 0 ? Math.round((completed / submitted) * 100) : null;
          var g = gradeInfo(pct);

          var residentAttributed = rows.filter(function(r){
            var matchesEmployee = rowEmail(r) === email || (employees[email] && employees[email].user_id && rowUserId(r) === employees[email].user_id);
            return isRealResidentOrigin(r) && matchesEmployee;
          });
          var residentCompanyWide = rows.filter(function(r){ return isRealResidentOrigin(r); });
          var residentScopedSource = residentAttributed.length ? residentAttributed : residentCompanyWide;
          var residentScopeLabel = residentAttributed.length ? 'employee-attributed' : 'company-wide fallback';
          var residentMonthRows = residentScopedSource.filter(function(r){ return monthKey(r.submitted_at || r.created_at) === month; });

          var residentSubmitted = residentMonthRows.length;
          var residentCompleted = 0;
          var residentActive = 0;
          var agingCount = 0;
          var completionDays = [];
          var vendorHours = [];
          var nowTs = Date.now();

          residentMonthRows.forEach(function(r){
            var status = String(r.status || '').trim().toLowerCase();
            var startIso = r.submitted_at || r.created_at;
            var doneIso = r.completed_at || r.closed_at || r.updated_at;
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
          var overallScore = meanGrade([pct, rg.score]);
          var overall = gradeInfo(overallScore);

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
          try{ document.title = name + ' - ' + monthLabel(month) + ' - Employee Performance Report'; }catch(_e){}
        }

        employeeSel.addEventListener('change', updatePreview);
        monthSel.addEventListener('change', updatePreview);
        updatePreview();
      }

      document.addEventListener('DOMContentLoaded', initShell);
    })();
  