(function(){
  const API = (window.MARKET_API_BASE || 'http://localhost:3002/api');
  function qs(sel){ return document.querySelector(sel); }
  function ce(tag, props){ const el = document.createElement(tag); return Object.assign(el, props||{}); }
  function getUserId(){
    // Prefer dev query param, else try token, else guest
    const u = new URLSearchParams(window.location.search).get('userId');
    if(u) return u;
    try {
      const auth = localStorage.getItem('MARKET_AUTH');
      if(auth){ const obj = JSON.parse(auth); if(obj && obj.userId) return obj.userId; }
    } catch(_e){}
    return 'guest';
  }
  async function fetchOrders(page=1, limit=20){
    const userId = getUserId();
    const url = `${API}/market/orders?page=${page}&limit=${limit}&userId=${encodeURIComponent(userId)}`;
    const res = await fetch(url, { headers: { 'Accept':'application/json' } });
    if(!res.ok) throw new Error('Failed to load orders');
    return res.json();
  }
  function renderOrders(data){
    const list = data.items || [];
    const tbody = qs('#orders-tbody');
    tbody.innerHTML = '';
    if(!list.length){
      const tr = ce('tr');
      const td = ce('td'); td.colSpan = 5; td.textContent = 'لا توجد طلبات بعد.';
      tr.appendChild(td); tbody.appendChild(tr); return;
    }
    for(const o of list){
      const tr = ce('tr');
      const date = o.createdAt || o.date || '';
      const total = (o.total != null ? o.total : (o.subtotal||0));
      tr.appendChild(ce('td', { textContent: o.orderNumber || o.id }));
      tr.appendChild(ce('td', { textContent: new Date(date).toLocaleString('ar') }));
      tr.appendChild(ce('td', { textContent: Number(total).toFixed(2) }));
      tr.appendChild(ce('td', { textContent: o.currency || 'SAR' }));
      tr.appendChild(ce('td', { textContent: o.paymentStatus || 'pending' }));
      tbody.appendChild(tr);
    }
    qs('#orders-total').textContent = data.total || list.length || 0;
  }
  async function init(){
    try {
      const data = await fetchOrders(1, 20);
      renderOrders(data);
    } catch(e){
      console.error(e);
      const tbody = qs('#orders-tbody');
      tbody.innerHTML = '';
      const tr = ce('tr'); const td = ce('td'); td.colSpan = 5; td.textContent = 'فشل تحميل الطلبات'; tr.appendChild(td); tbody.appendChild(tr);
    }
  }
  document.addEventListener('DOMContentLoaded', init);
})();
