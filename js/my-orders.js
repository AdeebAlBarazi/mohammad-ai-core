(function(w){
  const Common = (w.Market && w.Market.Common) || { fetchJSON: async (u,opts)=>{ const r = await fetch(u,opts); try{ return await r.json(); }catch(_){ return { ok:false }; } } };
  const Format = (w.Market && w.Market.Format) || null;
  const I18n = (w.Market && w.Market.I18n) || null;
  let page = 1; let limit = 20;
    let total = 0;
    const AR_STATUS = { paid: 'مدفوع', pending: 'قيد الانتظار', failed: 'فشل', processing: 'جاري التنفيذ', completed: 'مكتمل' };
  async function load(){
    const q = document.getElementById('q').value.trim();
    const sort = document.getElementById('sort').value;
    const pay = document.getElementById('pay')?.value || '';
    const ful = document.getElementById('ful')?.value || '';
      const from = document.getElementById('from')?.value || '';
      const to = document.getElementById('to')?.value || '';
      const url = `/api/market/orders?page=${page}&limit=${limit}&sort=${encodeURIComponent(sort)}${q?`&q=${encodeURIComponent(q)}`:''}${pay?`&paymentStatus=${encodeURIComponent(pay)}`:''}${ful?`&fulfillmentStatus=${encodeURIComponent(ful)}`:''}${from?`&from=${encodeURIComponent(from)}`:''}${to?`&to=${encodeURIComponent(to)}`:''}`;
    const j = await Common.fetchJSON(url);
      total = Number(j && j.total || 0);
    const list = document.getElementById('list'); list.innerHTML = '';
    const items = (j && j.items) || [];
    if(!items.length){ list.innerHTML = '<em>لا توجد طلبات</em>'; return; }
    items.forEach(o=>{
      const row = document.createElement('div'); row.className='row';
      const id = (o._id||o.id||''); const on = (o.orderNumber||id);
      const totalRaw = Number(o.total||0);
      const total = Format ? Format.currency(totalRaw) : (function(v){ var lang = (I18n && I18n.getLang) ? I18n.getLang() : 'ar'; var suffix = I18n ? I18n.t('sar', lang) : (o.currency||'SAR'); return String(v.toFixed(2)) + ' ' + suffix; })(totalRaw);
      const p = String(o.paymentStatus||'pending');
      const f = String(o.fulfillmentStatus||'pending');
      const pBadge = `<span class="status-badge status-${p}" title="${AR_STATUS[p]||p}">${AR_STATUS[p]||p}</span>`;
      const fBadge = `<span class="status-badge status-${f}" title="${AR_STATUS[f]||f}">${AR_STATUS[f]||f}</span>`;
      row.innerHTML = `<span>رقم: ${on}</span><span>${total}</span><span>${pBadge} ${fBadge}</span><a class="link" href="order-details.html?id=${encodeURIComponent(id)}">تفاصيل</a>`;
      list.appendChild(row);
    });
  }
  function wire(){
    document.getElementById('apply').addEventListener('click', ()=>{ page = 1; load(); });
    const prev = document.getElementById('prev'); const next = document.getElementById('next');
    if(prev) prev.addEventListener('click', ()=>{ if(page>1){ page -= 1; load(); } });
    if(next) next.addEventListener('click', ()=>{ page += 1; load(); });
  }
    function updatePager(){
      const prev = document.getElementById('prev'); const next = document.getElementById('next');
      if(prev) prev.disabled = page <= 1;
      const maxPage = Math.max(1, Math.ceil(total / limit));
      if(next) next.disabled = page >= maxPage;
    }
  document.addEventListener('DOMContentLoaded', ()=>{ wire(); load(); });
})(window);
