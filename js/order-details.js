(function(w){
  const Common = (w.Market && w.Market.Common) || { fetchJSON: async (u,opts)=>{ const r = await fetch(u,opts); try{ return await r.json(); }catch(_){ return { ok:false }; } } };
  function getParam(name){ const u = new URL(window.location.href); return u.searchParams.get(name); }
  async function load(){
    const id = getParam('id');
    const j = await Common.fetchJSON(`/api/market/orders/${encodeURIComponent(id)}`);
    const basic = document.getElementById('basic'); const itemsEl = document.getElementById('items');
    basic.innerHTML = ''; itemsEl.innerHTML='';
    if(!j || !j.ok || !j.item){ basic.innerHTML = '<em>لم يتم العثور على الطلب</em>'; return; }
    const o = j.item;
    const total = Number(o.total||0).toFixed(2);
    const shipping = Number(o.shipping||0).toFixed(2);
    const tax = Number(o.tax||0).toFixed(2);
    const currency = o.currency||'SAR';
    const AR_STATUS = { paid: 'مدفوع', pending: 'قيد الانتظار', failed: 'فشل', processing: 'جاري التنفيذ', completed: 'مكتمل' };
    const rows = [
      `<div class="row"><span>رقم الطلب</span><strong>${o.orderNumber||o._id||''}</strong></div>`,
        `<div class="row"><span>الحالة المالية</span><span class="status-badge status-${String(o.paymentStatus||'pending')}" title="${AR_STATUS[String(o.paymentStatus||'pending')]||String(o.paymentStatus||'pending')}">${AR_STATUS[String(o.paymentStatus||'pending')]||String(o.paymentStatus||'pending')}</span></div>`,
        `<div class="row"><span>حالة التنفيذ</span><span class="status-badge status-${String(o.fulfillmentStatus||'pending')}" title="${AR_STATUS[String(o.fulfillmentStatus||'pending')]||String(o.fulfillmentStatus||'pending')}">${AR_STATUS[String(o.fulfillmentStatus||'pending')]||String(o.fulfillmentStatus||'pending')}</span></div>`,
      (o.shippingAddress ? `<div class=\"row\"><span>عنوان الشحن</span><span>${[o.shippingAddress.name,o.shippingAddress.line1,o.shippingAddress.line2,o.shippingAddress.city,o.shippingAddress.state,o.shippingAddress.postalCode,o.shippingAddress.countryCode].filter(Boolean).join('، ')}</span></div>` : ''),
      `<div class="row"><span>الضريبة</span><span>${tax} ${currency}</span></div>`,
      `<div class="row"><span>الشحن</span><span>${shipping} ${currency}</span></div>`,
      `<div class="row"><span>الإجمالي</span><strong>${total} ${currency}</strong></div>`
    ];
    basic.innerHTML = rows.join('');
    const items = Array.isArray(o.items) ? o.items : [];
    if(!items.length){ itemsEl.innerHTML = '<em>لا توجد عناصر</em>'; return; }
    const list = document.createElement('div');
    items.forEach(it=>{
      const lineTotal = Number((it.quantity||1) * (it.unitPrice||0)).toFixed(2);
      const row = document.createElement('div'); row.className='row';
      row.innerHTML = `<span>${it.sku||''}</span><span>${it.quantity||1}x</span><span>${lineTotal} ${currency}</span>`;
      list.appendChild(row);
    });
    itemsEl.appendChild(list);
    // Payment stub button (dev/staging) when pending
    if(String(o.paymentStatus||'') === 'pending'){
      const payBtn = document.createElement('button');
      payBtn.textContent = 'دفع الآن (وهمي)';
      payBtn.className = 'btn btn-primary';
      payBtn.style.marginTop = '12px';
      payBtn.addEventListener('click', async ()=>{
        payBtn.disabled = true;
        try {
          // Create intent if not exists
          const intentRes = await Common.fetchJSON('/api/market/payments/intents', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ orderId: o._id || o.id }) });
          if(!intentRes || !intentRes.ok){ alert('فشل إنشاء نية الدفع'); payBtn.disabled=false; return; }
          const confirmRes = await Common.fetchJSON(`/api/market/payments/${intentRes.intent.id}/confirm`, { method:'POST' });
          if(confirmRes && confirmRes.ok){ alert('تم الدفع بنجاح'); location.reload(); } else { alert('فشل تأكيد الدفع'); payBtn.disabled=false; }
        } catch(_){ alert('خطأ أثناء الدفع'); payBtn.disabled=false; }
      });
      itemsEl.appendChild(payBtn);
    }
  }
  document.addEventListener('DOMContentLoaded', load);
})(window);
