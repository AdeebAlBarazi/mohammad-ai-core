// Clean rebuilt script.js
// ===============================
// Core Initialization
// ===============================
const CONTACT_EMAIL = 'a@monarchhub.io';

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initLanguageSwitcher();
  loadCMS();
  initIntersectionAnimations();
  initCertificatesSlider();
  initHeroTyping();
  initContactForm();
  initDownloadCV();
  initMeetingModal();
});

// Navigation
function initNavigation(){
  const hamburger=document.querySelector('.hamburger');
  const navMenu=document.querySelector('.nav-menu');
  hamburger?.addEventListener('click',()=>{hamburger.classList.toggle('active');navMenu?.classList.toggle('active');});
  const links=document.querySelectorAll('.nav-link');
  links.forEach(l=>l.addEventListener('click',e=>{const id=l.getAttribute('href');if(id&&id.startsWith('#')){e.preventDefault();document.querySelector(id)?.scrollIntoView({behavior:'smooth'});}hamburger?.classList.remove('active');navMenu?.classList.remove('active');links.forEach(x=>x.classList.remove('active'));l.classList.add('active');}));
  window.addEventListener('scroll',()=>{const pos=window.scrollY+200;document.querySelectorAll('section[id]').forEach(sec=>{const top=sec.offsetTop,h=sec.offsetHeight;if(pos>=top&&pos<top+h){const id=sec.id;links.forEach(x=>x.classList.remove('active'));document.querySelector(`.nav-link[href="#${id}"]`)?.classList.add('active');}});});
}

// Language
function initLanguageSwitcher(){
  const toggle=document.getElementById('lang-toggle');
  const html=document.documentElement;let lang='ar';
  if(!toggle)return;
  const apply=()=>{html.setAttribute('lang',lang);html.setAttribute('dir',lang==='ar'?'rtl':'ltr');toggle.querySelector('span').textContent=lang==='ar'?'EN':'العربية';updateContentByDataAttributes(lang);if(window.CMS_CONTENT)applyCMS(lang,window.CMS_CONTENT);};
  toggle.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();lang=lang==='ar'?'en':'ar';apply();});
  apply();
}

function updateContentByDataAttributes(lang){
  document.querySelectorAll(`[data-${lang}]`).forEach(el=>{const val=el.getAttribute(`data-${lang}`);if(!val)return; if(el.tagName==='LI'||/<span|<strong/i.test(val))el.innerHTML=val; else el.textContent=val;});
  document.querySelectorAll(`[data-${lang}-placeholder]`).forEach(el=>{const ph=el.getAttribute(`data-${lang}-placeholder`);if(ph)el.placeholder=ph;});
  const tEl=document.querySelector('title');if(tEl){const t=tEl.getAttribute(`data-${lang}`);if(t){tEl.textContent=t;document.title=t;}}
}

// CMS
function loadCMS(){
  // Primary source: root content.json (single source of truth)
  fetch('content.json',{cache:'no-store'})
    .then(r=>r.ok?r.json():null)
    .then(data=>{
      if(data){
        window.CMS_CONTENT=data;
        const lang=document.documentElement.getAttribute('lang')||'ar';
        applyCMS(lang,data);
        maybeReInitProjects();
        return;
      }
      // Fallback to legacy path if root missing
      return fetch('assets/data/content.json',{cache:'no-store'}).then(rr=>rr.ok?rr.json():null).then(fallback=>{
        if(!fallback) return;
        console.warn('[CMS] Using fallback assets/data/content.json');
        window.CMS_CONTENT=fallback;
        const lang=document.documentElement.getAttribute('lang')||'ar';
        applyCMS(lang,fallback);
        maybeReInitProjects();
      });
    })
    .catch(e=>console.error('CMS load failed:', e));
}
function maybeReInitProjects(){
  if(typeof window.initProjects!=='function') return;
  const grid=document.getElementById('projects-grid');
  if(!grid) return;
  if(!grid.children.length || grid.querySelector('.no-projects') || grid.querySelector('.projects-status')){
    try{ window.initProjects(); }catch(e){ console.warn('Re-init projects after CMS error', e); }
  }
}
function applyCMS(lang,data){try{applyHeroVideo(data.video||{});applyCertificates(data,lang);const prefersReduced=(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);document.querySelectorAll('[data-cms-key]').forEach(el=>{const key=el.getAttribute('data-cms-key');if(!key)return;let val=resolveCMSPath(data,key);if(val&&typeof val==='object'&&(val.ar||val.en))val=val[lang]??val.ar??val.en; // fallback if empty
  if((key==='hero.title'||key==='hero.subtitle') && (!val||!String(val).trim())){const fallback=el.getAttribute(`data-${lang}`)||el.getAttribute('data-ar')||el.getAttribute('data-en'); if(fallback) val=fallback;}
  if(val==null) return; if(key==='hero.subtitle'){if(prefersReduced){el.textContent=val;}else{el.textContent='';window.dispatchEvent(new CustomEvent('cms:heroSubtitle',{detail:{text:val}}));}} else {if(el.getAttribute('data-cms-html')==='true')el.innerHTML=val; else el.textContent=val;}});}catch(e){}}
function resolveCMSPath(obj,path){return path.split('.').reduce((c,s)=>c&&s in c?c[s]:null,obj);}

// Hero Video
function applyHeroVideo(cfg){const wrapper=document.getElementById('hero-video-wrapper');const video=document.getElementById('hero-video');const source=document.getElementById('hero-video-source');const hero=document.querySelector('.hero');const btn=document.getElementById('hero-video-toggle');if(!wrapper||!video||!source)return;const url=cfg.url||'';if(!url){wrapper.style.display='none';btn&&(btn.style.display='none');hero?.classList.remove('hero-has-video');return;}wrapper.style.display='';if(cfg.background){wrapper.classList.add('bg');hero?.classList.add('hero-has-video');}else{wrapper.classList.remove('bg');hero?.classList.remove('hero-has-video');}const yt=url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);if(yt){video.style.display='none';let iframe=document.getElementById('hero-video-iframe');const vid=yt[1];const embed=`https://www.youtube.com/embed/${vid}?autoplay=1&mute=1&loop=1&playlist=${vid}&controls=0&rel=0&modestbranding=1`;if(!iframe){iframe=document.createElement('iframe');iframe.id='hero-video-iframe';iframe.allow='autoplay; fullscreen';iframe.title='Hero Video';wrapper.appendChild(iframe);}iframe.src=embed;iframe.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:-2;border:0;';setupHeroVideoToggle({mode:'youtube',iframe,embedUrl:embed});return;}video.style.display='block';if(cfg.poster)video.setAttribute('poster',cfg.poster);else video.removeAttribute('poster');video.muted=cfg.muted!==false;video.loop=cfg.loop!==false;video.autoplay=cfg.autoplay!==false&&!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);if(!source.getAttribute('src')){source.src=url;video.load();}if(video.autoplay){const p=video.play();p&&p.catch(()=>{});}setupHeroVideoToggle({mode:'video',videoEl:video});}
function setupHeroVideoToggle(ctx){const btn=document.getElementById('hero-video-toggle');if(!btn)return;btn.style.display='';btn.classList.remove('paused');btn.textContent='إيقاف الخلفية';if(ctx.mode==='youtube'){let paused=false;const {iframe,embedUrl}=ctx;btn.onclick=()=>{paused=!paused;if(paused){iframe.src='about:blank';btn.textContent='تشغيل الخلفية';btn.classList.add('paused');}else{iframe.src=embedUrl;btn.textContent='إيقاف الخلفية';btn.classList.remove('paused');}};}else{let paused=false;const v=ctx.videoEl;btn.onclick=()=>{paused=!paused;if(paused){v.pause();btn.textContent='تشغيل الخلفية';btn.classList.add('paused');}else{const p=v.play();p&&p.catch(()=>{});btn.textContent='إيقاف الخلفية';btn.classList.remove('paused');}};}}

// Certificates
function applyCertificates(data,lang){
  const track=document.querySelector('.certificates-track');
  if(!track)return;
  const list=Array.isArray(data.certificates)?data.certificates:[];
  if(!list.length){track.innerHTML='';return;}
  const cards=list.map(c=>{
    const title=(c.title&&(c.title[lang]||c.title.ar))||'';
    const sub=(c.subtitle&&(c.subtitle[lang]||c.subtitle.ar))||'';
    const year=c.year||'';
    const icon=c.icon||'certificate';
    const img=c.imageUrl||'';
    return `<div class="certificate-card"><div class="certificate-image"><img src="${img}" alt="${title}" style="display:none" onload="this.style.display='block'; this.nextElementSibling.style.opacity='0';" onerror="this.style.display='none'; this.nextElementSibling.style.opacity='1';"><div class="certificate-overlay"><i class="fas fa-${icon}"></i></div></div><div class="certificate-info"><h3>${title}</h3><p>${sub}</p><span class="certificate-year">${year}</span></div></div>`;
  });
  // Duplicate full set for seamless marquee (avoid visual gap at reset)
  track.innerHTML = cards.join('') + cards.join('');
}
function initCertificatesSlider(){
  const sliderEl = document.querySelector('.certificates-slider');
  if(!sliderEl) return;
  
  // Initialize Swiper for certificates
  new Swiper('.certificates-slider', {
    effect: 'coverflow',
    grabCursor: true,
    centeredSlides: true,
    slidesPerView: 'auto',
    coverflowEffect: {
      rotate: 30,
      stretch: 0,
      depth: 150,
      modifier: 1,
      slideShadows: false,
    },
    loop: true,
    autoplay: {
      delay: 3000,
      disableOnInteraction: false,
    },
    speed: 800,
    keyboard: {
      enabled: true,
    },
    mousewheel: {
      enabled: true,
    },
  });
}

// Intersection animations
function initIntersectionAnimations(){const style=document.createElement('style');style.textContent='.animate-in{animation:slideInUp .6s ease-out forwards}@keyframes slideInUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}.competency-card,.education-card,.timeline-item,.strength-card{opacity:0;transform:translateY(30px);transition:.6s}';document.head.appendChild(style);const obs=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting)e.target.classList.add('animate-in');}),{threshold:.1,rootMargin:'0px 0px -50px'});document.querySelectorAll('section,.competency-card,.education-card,.timeline-item,.strength-card,.certificate-card').forEach(el=>obs.observe(el));}

// Hero typing
function initHeroTyping(){
  const el=document.querySelector('.hero-subtitle');
  if(!el)return;
  let timer=null;
  const prefersReduced=(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  
  function typeText(text){
    if(!text)return;
    
    if(prefersReduced){
      el.textContent=text;
      el.classList.add('typing-complete');
      return;
    }
    
    if(timer)clearTimeout(timer);
    el.textContent='';
    el.classList.remove('typing-complete');
    
    let i=0;
    function step(){
      if(i<text.length){
        el.textContent+=text.charAt(i++);
        timer=setTimeout(step, 60); // Faster typing speed (60ms)
      } else {
        // Add complete class after 2 seconds to hide cursor
        setTimeout(() => {
          el.classList.add('typing-complete');
        }, 2000);
      }
    }
    
    // Start typing after small delay
    setTimeout(() => step(), 300);
  }
  
  // Listen for CMS updates
  window.addEventListener('cms:heroSubtitle',e=>{
    const t=e.detail&&e.detail.text;
    typeText(t);
  });
  
  // Auto-start with current content if available
  const initialText = el.textContent.trim();
  if(initialText) {
    typeText(initialText);
  }
}

// Contact form
function initContactForm(){const form=document.querySelector('.contact-form form');if(!form)return;const emailDisplay=document.getElementById('contact-email-display');if(emailDisplay){emailDisplay.querySelector('a').href=`mailto:${CONTACT_EMAIL}`;emailDisplay.querySelector('a').textContent=CONTACT_EMAIL;}form.addEventListener('submit',e=>{e.preventDefault();const name=form.querySelector('input[name="name"]').value.trim();const email=form.querySelector('input[name="email"]').value.trim();const phone=form.querySelector('input[name="phone"]')?.value.trim()||'';const subject=form.querySelector('input[name="subject"]').value.trim();const message=form.querySelector('textarea[name="message"]').value.trim();if(!name||!email||!subject||!message){showNotification('خطأ في الإدخال','الرجاء تعبئة الحقول الإلزامية','error');return;}const emailRegex=/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;if(!emailRegex.test(email)){showNotification('بريد غير صالح','يرجى إدخال بريد إلكتروني صحيح','error');return;}if(phone && !/^[0-9+\-\s]{6,20}$/.test(phone)){showNotification('رقم هاتف غير صالح','تنسيق مسموح: أرقام + مسافات + + -','error');return;}if(subject.length<3){showNotification('موضوع قصير','يرجى توضيح الموضوع أكثر','warning');return;}if(message.length<10){showNotification('رسالة قصيرة','يجب أن تحتوي الرسالة على 10 أحرف على الأقل','warning');return;}const body=`طلب تواصل جديد:%0D%0Aالاسم: ${name}%0D%0Aالبريد للرد: ${email}%0D%0Aالهاتف: ${phone||'—'}%0D%0Aالموضوع: ${subject}%0D%0A%0D%0Aالرسالة:%0D%0A${message}`;window.location.href=`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${body}`;showNotification('تم تجهيز البريد','تم فتح تطبيق البريد مع تعبئة البيانات.','success');setTimeout(()=>form.reset(),1200);});}

// Notifications
function showNotification(title,message,type='info'){const n=document.createElement('div');n.className=`notification notification-${type}`;n.innerHTML=`<div class="notification-header"><strong>${title}</strong><button class="notification-close" aria-label="إغلاق">&times;</button></div><div class="notification-body">${message}</div>`;if(!document.querySelector('#notification-styles')){const s=document.createElement('style');s.id='notification-styles';s.textContent='.notification{position:fixed;top:100px;right:20px;background:var(--card-bg);border:1px solid var(--border-color);border-radius:8px;box-shadow:var(--shadow);padding:1rem;min-width:300px;z-index:1001;transform:translateX(400px);transition:.3s}.notification.show{transform:translateX(0)}.notification-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem}.notification-close{background:none;border:none;color:var(--text-secondary);font-size:1.2rem;cursor:pointer;width:24px;height:24px;display:flex;align-items:center;justify-content:center}.notification-success{border-left:4px solid var(--accent-green)}.notification-info{border-left:4px solid var(--accent-blue)}.notification-warning{border-left:4px solid var(--accent-orange)}.notification-error{border-left:4px solid var(--accent-red)}';document.head.appendChild(s);}document.body.appendChild(n);setTimeout(()=>n.classList.add('show'),50);n.querySelector('.notification-close').onclick=()=>{n.classList.remove('show');setTimeout(()=>n.remove(),300);};setTimeout(()=>{if(!n.parentNode)return;n.classList.remove('show');setTimeout(()=>n.remove(),300);},5000);}

// Download CV
function initDownloadCV(){const btn=document.querySelector('.btn-secondary');if(!btn)return;btn.addEventListener('click',()=>{showNotification('تحميل','جاري تجهيز السيرة الذاتية...','info');setTimeout(()=>showNotification('تم','اكتمل التحميل (محاكاة).','success'),1800);});}

// Meeting modal
function initMeetingModal(){const btn=document.querySelector('.btn-primary');if(!btn)return;btn.addEventListener('click',()=>{if(!btn.textContent.includes('طلب اجتماع'))return;const modal=document.createElement('div');modal.className='modal-overlay';modal.innerHTML='<div class="modal"><div class="modal-header"><h3>طلب اجتماع</h3><button class="modal-close">&times;</button></div><div class="modal-body"><form class="meeting-form"><div class="form-group"><label>الاسم</label><input name="m-name" required></div><div class="form-group"><label>بريدك للتواصل</label><input name="m-email" type="email" required></div><div class="form-group"><label>الهاتف (اختياري)</label><input name="m-phone" type="tel" pattern="[0-9+\-\s]{6,20}" title="أرقام فقط مع + أو - أو مسافات"></div><div class="form-group"><label>التاريخ المفضل</label><input name="m-date" type="date" required></div><div class="form-group"><label>الوقت المفضل</label><select name="m-time" required><option value="">اختر الوقت</option><option>09:00</option><option>10:00</option><option>11:00</option><option>14:00</option><option>15:00</option><option>16:00</option></select></div><div class="form-group"><label>موضوع الاجتماع</label><textarea name="m-subject" rows="3" required></textarea></div><div class="modal-actions"><button type="button" class="btn btn-secondary modal-cancel">إلغاء</button><button type="submit" class="btn btn-primary">إرسال طلب الاجتماع</button></div></form></div></div>';if(!document.querySelector('#modal-styles')){const st=document.createElement('style');st.id='modal-styles';st.textContent='.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:1002;display:flex;align-items:center;justify-content:center;opacity:0;transition:.3s}.modal-overlay.show{opacity:1}.modal{background:var(--card-bg);border:1px solid var(--border-color);border-radius:12px;max-width:500px;width:90%;max-height:90vh;overflow-y:auto;transform:scale(.85);transition:.3s}.modal-overlay.show .modal{transform:scale(1)}.modal-header{display:flex;justify-content:space-between;align-items:center;padding:1.2rem;border-bottom:1px solid var(--border-color)}.modal-body{padding:1.2rem}.meeting-form .form-group{margin-bottom:1rem}.meeting-form input,.meeting-form select,.meeting-form textarea{width:100%;padding:.75rem;background:var(--secondary-bg);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-family:inherit}.modal-actions{display:flex;gap:1rem;margin-top:1rem}.modal-actions .btn{flex:1}';document.head.appendChild(st);}document.body.appendChild(modal);setTimeout(()=>modal.classList.add('show'),30);function close(){modal.classList.remove('show');setTimeout(()=>modal.remove(),300);}modal.querySelector('.modal-close').onclick=close;modal.querySelector('.modal-cancel').onclick=close;modal.querySelector('.meeting-form').onsubmit=e=>{e.preventDefault();const f=e.target;const name=f.querySelector('input[name="m-name"]').value.trim();const email=f.querySelector('input[name="m-email"]').value.trim();const phone=f.querySelector('input[name="m-phone"]').value.trim();const date=f.querySelector('input[name="m-date"]').value.trim();const time=f.querySelector('select[name="m-time"]').value.trim();const subjectText=f.querySelector('textarea[name="m-subject"]').value.trim();if(phone && !/^[0-9+\-\s]{6,20}$/.test(phone)){showNotification('رقم هاتف غير صالح','تنسيق مسموح: أرقام + مسافات + + -','error');return;}const body=`طلب اجتماع جديد:%0D%0Aالاسم: ${name}%0D%0Aالبريد للتواصل: ${email}%0D%0Aالهاتف: ${phone||'—'}%0D%0Aالتاريخ المفضل: ${date}%0D%0Aالوقت المفضل: ${time}%0D%0Aالموضوع:%0D%0A${subjectText}`;const mailSubject='طلب اجتماع من الموقع';window.location.href=`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(mailSubject)}&body=${body}`;close();showNotification('طلب الاجتماع','تم إعداد بريد الطلب إلى عنوان الاعتماد.','success');};modal.addEventListener('click',e=>{if(e.target===modal)close();});});}
// Projects logic migrated to projects-extended.js (API driven)
