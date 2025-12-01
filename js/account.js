// systems/marketplace/js/account.js
(function(w){
  const Common = (w.Market && w.Market.Common) || { fetchJSON: async (p)=>({}), apiUrl:(p)=>p };
  async function route(){
    try {
      const me = await Common.fetchJSON('/market/auth/me');
      if(!me || me.authenticated !== true){ w.location.href = './my-orders.html'; return; }
      const role = (me.user && me.user.role) || 'customer';
      if(role === 'super-admin'){ w.location.href = './admin-dashboard.html'; return; }
      if(role === 'seller'){ w.location.href = '../seller/seller-dashboard.html'; return; }
      w.location.href = './my-orders.html';
    } catch(_){ w.location.href = './my-orders.html'; }
  }
  function wire(){ const btn = document.getElementById('account-button'); if(btn) btn.addEventListener('click', route); }
  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', wire); } else { wire(); }
})(window);
