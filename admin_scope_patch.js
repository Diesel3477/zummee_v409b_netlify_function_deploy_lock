
// === Admin All Companies Scope Patch (Zummee 2.19) ===

(function(){
  function getRoleSafe(){
    return window.currentUserRole || localStorage.getItem("userRole") || null;
  }

  window.initializeCompanyScope = function(){
    const role = getRoleSafe();
    const currentScope = localStorage.getItem("activeCompanyScope");

    if (role === "Admin") {
      if (!currentScope) {
        localStorage.setItem("activeCompanyScope", "ALL");
      }
    } else {
      localStorage.setItem("activeCompanyScope", "COMPANY");
    }
  };

  window.applyCompanyScopeFilter = function(query, activeCompanyId){
    const scope = localStorage.getItem("activeCompanyScope");
    if (scope !== "ALL" && activeCompanyId) {
      return query.eq("company_id", activeCompanyId);
    }
    return query;
  };

  window.setCompanyScope = function(scope){
    localStorage.setItem("activeCompanyScope", scope);
    if (window.refreshEmployees) window.refreshEmployees();
    if (window.refreshCompanyCommunities) window.refreshCompanyCommunities();
  };
})();
