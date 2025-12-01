(function(w){
  const Common = (w.Market && w.Market.Common) || { fetchJSON: async (u,opts)=>{ const r = await fetch(u,opts); try{ return await r.json(); }catch(_){ return { ok:false }; } }, getToken: ()=>null };
  async function loadCart(){
    const j = await Common.fetchJSON('/api/market/cart');
    const summary = document.getElementById('summary');
    const totalsEl = document.getElementById('totals');
    summary.innerHTML = '';
    totalsEl.innerHTML = '';
    const items = (j && j.items) || [];
    if(!items.length){ summary.innerHTML = '<em>السلة فارغة</em>'; return; }
    let subtotal = Number(j.subtotal||0);
    items.forEach(it=>{
      const row = document.createElement('div');
      row.className='row';
      row.innerHTML = `<span>${it.sku}</span><span>${it.quantity}x</span><span>${(it.lineTotal||0).toFixed(2)} ${j.currency||'SAR'}</span>`;
      summary.appendChild(row);
    });
    totalsEl.innerHTML = `<div class="row"><strong>المجموع الفرعي</strong><span>${subtotal.toFixed(2)} ${j.currency||'SAR'}</span></div>`;
    // Show note about env-based tax/shipping handled server-side
    const note = document.createElement('div');
    note.style.marginTop = '4px';
    note.innerHTML = '<small>سيتم احتساب الضريبة والشحن عند إنشاء الطلب.</small>';
    totalsEl.appendChild(note);
  }
  async function submitOrder(){
    const msg = document.getElementById('checkout-msg');
    msg.textContent=''; msg.style.color = '#111827';
    const shippingAddress = {
      name: document.getElementById('ship-name').value.trim() || undefined,
      line1: document.getElementById('ship-line1').value.trim(),
      line2: document.getElementById('ship-line2').value.trim() || undefined,
      city: document.getElementById('ship-city').value.trim(),
      state: document.getElementById('ship-state').value.trim() || undefined,
      postalCode: document.getElementById('ship-postal').value.trim() || undefined,
      countryCode: (document.getElementById('ship-country').value || 'SA').trim().toUpperCase(),
      phone: document.getElementById('ship-phone').value.trim() || undefined
    };
    if(!shippingAddress.line1 || !shippingAddress.city){ msg.style.color = '#b91c1c'; msg.textContent = 'الرجاء تعبئة الحقول المطلوبة'; return; }
    const btn = document.getElementById('checkout-submit'); btn.disabled = true;
    const j = await Common.fetchJSON('/api/market/orders', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ currency:'SAR', shippingAddress }) });
    btn.disabled = false;
    if(j && j.ok){
      msg.style.color = '#065f46';
      const id = j.id || '';
      msg.innerHTML = `تم إنشاء الطلب (رقم: <strong>${id}</strong>)`;
      const actions = document.createElement('div');
      actions.style.marginTop = '8px';
      const ordersLink = document.createElement('a'); ordersLink.className='btn'; ordersLink.href = 'my-orders.html'; ordersLink.textContent = 'الذهاب إلى طلباتي';
      const detailsLink = document.createElement('a'); detailsLink.className='btn'; detailsLink.style.marginRight = '8px'; detailsLink.href = `order-details.html?id=${encodeURIComponent(id)}`; detailsLink.textContent = 'عرض تفاصيل الطلب';
      actions.appendChild(detailsLink);
      actions.appendChild(ordersLink);
      msg.appendChild(actions);
      // Optional auto-redirect to details after short delay
      setTimeout(()=>{ try{ window.location.href = `pages/order-details.html?id=${encodeURIComponent(id)}`; }catch(_){ /* ignore */ } }, 2000);
    }
    else { msg.style.color = '#b91c1c'; msg.textContent = (j && j.error) ? `خطأ: ${j.error}` : 'فشل إنشاء الطلب'; }
  }
  function wire(){
    document.getElementById('checkout-submit').addEventListener('click', submitOrder);
  }
  document.addEventListener('DOMContentLoaded', ()=>{ loadCart(); wire(); });
})(window);
