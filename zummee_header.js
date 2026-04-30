(() => {
  function injectStyles(){
    if (document.getElementById('zummeeHeaderStyles')) return;
    const style = document.createElement('style');
    style.id = 'zummeeHeaderStyles';
    style.textContent = `
  .zummee-header{
    display:flex;justify-content:space-between;align-items:center;gap:18px;
    padding:16px 22px;background:rgba(156,198,230,0.85);
    border-bottom:1px solid rgba(15,47,74,0.18)
  }
  .zummee-header__left{display:flex;align-items:center;gap:16px;min-width:0}
  .zummee-header__logo{display:inline-flex;align-items:center;text-decoration:none;flex:0 0 auto}
  .zummee-header__logo img{height:72px;max-height:72px;width:auto;display:block}

  .zummee-header__titles{display:none}
  .zummee-header__title{
    margin:0;font-size:1.6rem;font-weight:800;color:#0f2f4a;
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis
  }
  .zummee-header__subtitle{
    margin-top:6px;font-size:1rem;font-weight:600;color:#0f2f4a;
    opacity:0.9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis
  }

  .zummee-header__right{display:flex;flex-direction:column;gap:14px;align-items:flex-start;min-width:260px}
  .zummee-header__ctlRow{display:flex;align-items:center;gap:10px;}
  .zummee-header__ctl-label{font-weight:800;color:#0f2f4a;opacity:0.95;font-size:1.35rem}
  #zummeeCommunitySwatch{width:14px;height:14px;border-radius:999px;border:1px solid rgba(15,47,74,0.25);background:#b7d3ea;display:inline-block}
  #zummeeCommunitySelect{padding:14px 18px;border:2px solid rgba(15,47,74,0.25);border-radius:16px;background:rgba(255,255,255,0.96);width:420px;max-width:420px;font-size:1.05rem}
  .zummee-header__hub{
    display:inline-flex;align-items:center;gap:8px;text-decoration:none;padding:12px 16px;border-radius:999px;
    border:3px solid rgba(15,47,74,0.28);background:rgba(255,255,255,0.92);color:#0f2f4a;
    font-weight:900;font-size:1.1rem;box-shadow:0 2px 8px rgba(15,47,74,0.08);align-self:flex-end
  }
  .zummee-header__hub:hover{background:rgba(255,255,255,0.98)}

  /* Minimal/vendor header mode */
.zummee-header.zummee-header--minimal{
  background:#0f3554;
  border-bottom:3px solid #e7edf5;
}
.zummee-header--minimal .zummee-header__logo img{
  height:72px;max-height:72px;width:auto;display:block;
}
.zummee-header--minimal .zummee-header__right{
  min-width:0;
  align-items:flex-end;
  justify-content:center;
  gap:0;
  flex:1 1 auto;
}
.zummee-header--minimal .zummee-header__title{
  font-size:1.85rem;
  text-align:right;
  color:#ffffff;
}
.zummee-header--minimal .zummee-header__subtitle{display:none;}
.zummee-header--minimal .zummee-header__left,
.zummee-header--minimal .zummee-header__right{
  color:#ffffff;
}

.zummee-header--minimal.zummee-header--logo-only{
  justify-content:flex-start;
}
.zummee-header--minimal.zummee-header--logo-only .zummee-header__right{
  display:none !important;
}

@media (max-width: 880px){
    .zummee-header{flex-direction:column;align-items:flex-start}
    .zummee-header__right{width:100%;align-items:stretch}
    #zummeeCommunitySelect{width:100%;max-width:100%}
    .zummee-header__hub{align-self:flex-start}
    .zummee-header__logo img{height:72px;max-height:72px}
    .zummee-header__title{font-size:1.2rem}
    .zummee-header__subtitle{font-size:0.95rem}

    .zummee-header--minimal{
      align-items:center;
      gap:10px;
    }
    .zummee-header--minimal .zummee-header__right{
      width:100%;
      align-items:center;
    }
    .zummee-header--minimal .zummee-header__title{
      font-size:1.25rem;
      text-align:center;
    }
  }
`;
    document.head.appendChild(style);
  }

  function renderHeader(opts={}){
    injectStyles();
    const mountId = opts.mountId || 'zummeeHeaderMount';
    const mount = document.getElementById(mountId);
    if(!mount) return;

    const hubHref = opts.hubHref || "manager_hub.html";
    const logoHref = opts.logoHref || "manager_hub.html";
    const title = opts.title || 'Zummee Property Manager';
    const subtitle = opts.subtitle || 'Your Property Management Personal Assistant';
    const controlLabel = opts.controlLabel || 'Community';
    const minimal = !!opts.minimal;
    const logoSrc = opts.logoSrc || 'zummee_logo_skyline.svg';

    const residentMode = (document.body && document.body.dataset && document.body.dataset.headerMode) === 'resident';

    if(minimal){
      if(residentMode){
        mount.innerHTML = `
          <header class="zummee-header zummee-header--minimal zummee-header--logo-only">
            <div class="zummee-header__left">
              <a class="zummee-header__logo" href="${logoHref}" aria-label="Zummee">
                <img src="${logoSrc}" alt="Zummee Logo" />
              </a>
            </div>
          </header>
        `;
        return;
      }
      mount.innerHTML = `
        <header class="zummee-header zummee-header--minimal">
          <div class="zummee-header__left">
            <a class="zummee-header__logo" href="${logoHref}" aria-label="Zummee">
              <img src="${logoSrc}" alt="Zummee Logo" />
            </a>
          </div>
          <div class="zummee-header__right" aria-label="Page title">
            <h1 class="zummee-header__title">${title}</h1>
          </div>
        </header>
      `;
      return;
    }

    mount.innerHTML = `
      <header class="zummee-header">
        <div class="zummee-header__left">
          <a class="zummee-header__logo" href="${logoHref}" aria-label="Go to Hub">
            <img src="${logoSrc}" alt="Zummee Logo" />
          </a>
        </div>
        <div class="zummee-header__right" aria-label="Page header controls">
          <div class="zummee-header__ctlRow">
            <span class="zummee-header__ctl-label">${controlLabel}</span>
            <span id="zummeeCommunitySwatch" aria-hidden="true"></span>
          </div>
          <select id="zummeeCommunitySelect"></select>
          <a class="zummee-header__hub" href="${hubHref}">← Hub</a>
        </div>
      </header>
    `;

    try{
      const existingId = opts.existingSelectId;
      if(existingId){
        const existing = document.getElementById(existingId);
        const next = document.getElementById('zummeeCommunitySelect');
        if(existing && next && existing !== next){
          next.innerHTML = existing.innerHTML;
          next.value = existing.value;
          existing.style.display = 'none';
        }
      }
    }catch(_e){}
  }

  window.ZUMMEE_renderHeader = renderHeader;
})();
