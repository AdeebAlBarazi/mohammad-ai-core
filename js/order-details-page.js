// order-details-page.js
const API_BASE = '/api/market';

function getToken(){ return (window.getAxiomToken && window.getAxiomToken()) || ''; }
function qs(name){ const u=new URL(window.location.href); return u.searchParams.get(name); }
function formatDate(dt){ try { const lang = (window.Market && window.Market.I18n && window.Market.I18n.getLang && window.Market.I18n.getLang()) || 'ar'; const locale = (lang==='en'?'en-US':'ar-SA'); return new Date(dt).toLocaleString(locale); } catch(e){ return dt; } }
function formatCurrency(v){ try { if (window.Market && window.Market.Format && typeof window.Market.Format.currency==='function') return window.Market.Format.currency(v); } catch(_){} return typeof v === 'number' ? v.toFixed(2) + ' ' + ((window.Market && window.Market.I18n && window.Market.I18n.t && window.Market.I18n.t('sar')) || 'SAR') : v; }
function translateStatus(s){
  switch(s){
    case 'paid': return 'مدفوع';
    case 'failed': return 'فشل';
    case 'pending': return 'قيد الانتظار';
    case 'completed': return 'مكتمل';
    case 'processing': return 'جاري التنفيذ';
    default: return s;
  }
}

function groupByVendor(items){
  const map = new Map();
  for(const it of (items||[])){
    const v = it.vendorCode || it.vendor || (it.product && (it.product.vendorCode || it.product.vendor)) || 'غير معروف';
    const arr = map.get(v) || []; arr.push(it); map.set(v, arr);
  }
  const out = [];
  for(const [vendor, arr] of map.entries()){
    const subtotal = arr.reduce((s,x)=> s + Number(x.price || x.unitPrice || 0) * Number(x.quantity || 1), 0);
    out.push({ vendor, items: arr, subtotal });
  }
  return out;
}

async function fetchOrder(){
  const id = qs('id');
  if(!id){ document.getElementById('msg').textContent = 'المعرف مفقود'; return; }
  const token = getToken();
  if(!token){ document.getElementById('msg').textContent = 'الرجاء إدخال التوكن'; return; }
  try{
    const r = await fetch(`${API_BASE}/orders/${encodeURIComponent(id)}`, { headers: { 'Authorization': 'Bearer ' + token }});
    if(!r.ok) throw new Error('HTTP '+r.status);
    const d = await r.json();
    render(d.order || d);
  } catch(e){ document.getElementById('msg').textContent = 'تعذر تحميل الطلب: ' + e.message; }
}

function render(order){
  const title = document.getElementById('od-title');
  const meta = document.getElementById('od-meta');
  const st = document.getElementById('od-status');
  const itemsBox = document.getElementById('od-items');
  const vendorsBox = document.getElementById('od-vendors');

  title.textContent = 'تفاصيل الطلب #' + (order._id || order.id || '—');
  meta.textContent = `تاريخ الإنشاء: ${formatDate(order.createdAt || order.date)} | الإجمالي: ${formatCurrency(order.totalAmount || order.total || 0)} | العمولة: ${formatCurrency(order.commissionAmount || 0)}`;

  const pay = order.paymentStatus || 'pending';
  const ful = order.fulfillmentStatus || 'pending';
  const payClass = pay === 'paid' ? 'status-paid' : (pay === 'failed' ? 'status-failed' : 'status-pending');
  const fulClass = ful === 'completed' ? 'status-paid' : (ful === 'failed' ? 'status-failed' : 'status-pending');
  st.innerHTML = `الدفع: <span class="status-badge ${payClass}">${translateStatus(pay)}</span> &nbsp; التنفيذ: <span class="status-badge ${fulClass}">${translateStatus(ful)}</span>`;

  const items = (order.items || []).map(it => `
    <div style="border-bottom:1px solid #eee;padding:8px 0;">
      <div><strong>${(it.product && (it.product.name || it.product.title)) || it.sku || 'منتج'}</strong></div>
      <div style="font-size:12px;color:#555;">SKU: ${(it.sku || '—')} | بائع: ${(it.vendorCode || (it.product && it.product.vendorCode) || '—')}</div>
      <div style="font-size:12px;color:#555;">الكمية: ${it.quantity || 1} × السعر: ${formatCurrency(it.price || it.unitPrice || 0)}</div>
    </div>
  `).join('');
  itemsBox.innerHTML = items || '<div>لا توجد عناصر</div>';

  const groups = groupByVendor(order.items);
  vendorsBox.innerHTML = groups.map(g=>{
    return `<div class="vendor-card">
      <div style="font-weight:600;">${g.vendor}</div>
      <div style="font-size:12px;color:#555;">${g.items.length} عنصر</div>
      <div style="margin-top:6px;">الإجمالي الفرعي: <strong>${formatCurrency(g.subtotal)}</strong></div>
    </div>`;
  }).join('');

  // Hook dev webhook panel
  wireWebhook(order);
}

function wireWebhook(order){
  const sel = document.getElementById('od-webhook-status');
  const btn = document.getElementById('od-webhook-send');
  const msg = document.getElementById('od-webhook-msg');
  if(!btn) return;
  btn.addEventListener('click', async ()=>{
    msg.textContent = '...';
    try{
      const r = await fetch('/api/payments/webhook', {
        method:'POST', headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ orderId: order._id || order.id, paymentStatus: sel.value })
      });
      const j = await r.json();
      if(!r.ok || j.ok === false) throw new Error(j.error || ('HTTP '+r.status));
      msg.textContent = 'تم التحديث. تحديث الصفحة...';
      setTimeout(()=> window.location.reload(), 600);
    } catch(e){ msg.textContent = 'خطأ: ' + e.message; }
  });
}

function init(){
  window.addEventListener('axiom-token-updated', ()=> fetchOrder());
  fetchOrder();
}

document.addEventListener('DOMContentLoaded', init);
