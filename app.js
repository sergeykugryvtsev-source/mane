'use strict';
// Set these to the real gift before sharing. Relative URLs are supported.
const CONFIG = {
  musicUrl: 'assets/iowa-mayaki-soft.mp3',
  laterMusicUrl: 'assets/later-song-soft.mp3',
  certificateImage: '',
  certificateUrl: '',
  certificateFile: 'assets/test-certificate.pdf',
  certificateIsTest: true,
  // Public Formspree form URL; never put mail passwords or private API keys here.
  downloadNotificationEndpoint: 'https://formspree.io/f/mjyglneq'
};
const descriptions = [
  'Кажется, тебе кое-что передали… Нажми на конверт.',
  'Приглашение на кулинарный мастер-класс.',
  'У тебя наверняка сложилось впечатление, что вершина моих кулинарных способностей — паста с васаби… Предлагаю проверить, есть ли у меня шансы на что-то посерьёзнее.',
  'Хочу пригласить тебя на кулинарный мастер-класс. Выберем что-нибудь интересное и приготовим вкусный ужин вместе.',
  'Но самое важное… Это подарок тебе, и только тебе решать, как им воспользоваться. Ты можешь пойти со мной, с кем-то другим или выбрать удобное время для себя. Никаких обязательств и ожиданий. Просто приятный опыт и новые впечатления.',
  'Пусть в твоей жизни будет больше приятных моментов, новых впечатлений и вкусных открытий.',
  'Всему своё время. Справка: корень солодки содержит глицирризиновую кислоту. Она обладает противовоспалительными свойствами, но в больших количествах может задерживать жидкость и повышать артериальное давление. Сертификат действует год. Есть время выбрать свой день.',
  'Когда передумаешь — возвращайся. Твоё приглашение будет ждать здесь.'
];
const slides = document.querySelector('#slides');
let current = 0, opening = false, opened = false;
let closePageTimer;
// Load the first photograph immediately; warm the next one only after it loads.
// This avoids six large downloads competing on a mobile connection.
function loadImage(index) {
  const img = slides.children[index]?.querySelector('img[data-src]');
  if (!img) return;
  img.addEventListener('load', () => {
    const next = slides.children[index + 1]?.querySelector('img[data-src]');
    if (next) {
      if ('requestIdleCallback' in window) requestIdleCallback(() => loadImage(index + 1));
      else setTimeout(() => loadImage(index + 1), 300);
    }
  }, { once: true });
  img.src = img.dataset.src;
  delete img.dataset.src;
}
loadImage(0);
slides.querySelector('.seal').addEventListener('click', openEnvelope);
slides.querySelectorAll('.next').forEach(button => button.addEventListener('click', () => go(current + 1)));
slides.querySelector('.details').addEventListener('click', showCertificate);
slides.querySelector('.slide-6 .postpone').addEventListener('click', () => {
  if (opening || current !== 5) return;
  void notifyAction('invitation_postponed', 'Оставить на потом');
  void go(6);
});
slides.querySelector('.later-return').addEventListener('click', () => go(5));
slides.querySelector('.later-close').addEventListener('click', () => {
  void notifyAction('close_page_clicked', 'Закрыть страницу');
  void music.setEnabled(false);
  try { window.close(); } catch { /* Some browsers reject closing a user-opened tab. */ }
  // If closing succeeds, this timer disappears with the tab. Otherwise explain the limitation.
  clearTimeout(closePageTimer);
  closePageTimer = setTimeout(() => {
    if (current === 7 && !opening) document.querySelector('#close-page-status').hidden = false;
  }, 300);
});
// Shared 4-second timeline: rising smoke for the envelope, a light sweep elsewhere.
async function go(index) {
  if (index < 0 || index >= slides.children.length || index === current || opening) return false;
  // Switch inside the tap gesture, before decoding or animation (needed by iOS).
  music.useTrack(index >= 6 ? CONFIG.laterMusicUrl : CONFIG.musicUrl);
  opening = true;
  const invitation = document.querySelector('.invitation');
  const isEnvelope = current === 0 && index === 1;
  const source = slides.children[current];
  const target = slides.children[index];
  const photo = target.querySelector('.art img');
  const back = document.querySelector('#back');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const controls = [...source.querySelectorAll('button'), ...target.querySelectorAll('button'), back];
  const disabledBefore = controls.map(button => button.disabled);
  controls.forEach(button => { button.disabled = true; });
  invitation.setAttribute('aria-busy', 'true');
  document.querySelector('#later').hidden = true;
  clearTimeout(closePageTimer);
  document.querySelector('#close-page-status').hidden = true;
  let changed = false;
  try {
    loadImage(index);
    await photo.decode();
    let useSmoke = isEnvelope;
    if (useSmoke && !reducedMotion) {
      try { await invitation.querySelector('.smoke-plume').decode(); }
      catch { useSmoke = false; } // Decorative asset errors must not block the invitation.
    }
    source.classList.add('reveal-source');
    target.classList.add('reveal-target');
    invitation.classList.toggle('reduced-reveal', reducedMotion);
    invitation.classList.toggle('reverse-reveal', index < current);
    invitation.classList.add('page-transition', useSmoke ? 'transition-smoke' : 'transition-light');
    await pause(900);
    current = index;
    [...slides.children].forEach((el, i) => {
      el.classList.toggle('active', i === current);
      el.inert = i !== current;
    });
    back.hidden = current === 0;
    document.querySelector('#announcement').textContent = `${target.getAttribute('aria-label')}. ${descriptions[current]}`;
    changed = true;
    await pause(3100);
    return true;
  } catch {
    music.useTrack(current >= 6 ? CONFIG.laterMusicUrl : CONFIG.musicUrl);
    const status = document.querySelector('#later');
    status.textContent = 'Не удалось загрузить следующий экран. Попробуй ещё раз.';
    status.hidden = false;
    photo.dataset.src = photo.getAttribute('src');
    photo.removeAttribute('src');
    return false;
  } finally {
    // Remove the outgoing layer while it is still covered by the opaque target.
    invitation.classList.remove('page-transition', 'transition-smoke', 'transition-light', 'reduced-reveal', 'reverse-reveal');
    source.classList.remove('reveal-source');
    target.classList.remove('reveal-target');
    invitation.removeAttribute('aria-busy');
    controls.forEach((button, i) => { button.disabled = disabledBefore[i]; });
    opening = false;
    (changed ? target : source).querySelector('button').focus({ preventScroll: true });
  }
}
async function openEnvelope() {
  if (opening) return;
  // Resume audio in the original tap, before waiting for any image or animation.
  if (!opened) music.setEnabled(true);
  if (await go(1)) opened = true;
}
document.querySelector('#back').addEventListener('click',()=>go(current-1));
document.addEventListener('keydown',e=>{
  if(document.querySelector('dialog').open||opening)return;
  if(e.key==='ArrowRight'&&current>0)go(current+1);
  if(e.key==='ArrowLeft')go(current-1);
});
const music = {
  enabled:false, context:null, gain:null, timer:null, audio:null, step:0,
  trackUrl:'', positions:new Map(), playRequest:0, selection:0,
  useTrack(url) {
    if (!url || url === this.trackUrl) return;
    // Keep the same media element unlocked by the first tap on iOS.
    // Invalidate old play promises before replacing its source.
    this.playRequest += 1;
    const selection = ++this.selection;
    if (!this.audio) {
      this.audio = new Audio();
      this.audio.preload = 'metadata'; this.audio.loop = true; this.audio.volume = 1;
      this.audio.id = 'background-music'; this.audio.hidden = true;
      document.body.append(this.audio);
    }
    if (this.context) void this.context.suspend();
    if (this.audio && this.trackUrl && Number.isFinite(this.audio.currentTime)) {
      this.positions.set(this.trackUrl, this.audio.currentTime);
    }
    this.audio.pause();
    this.trackUrl = url;
    const resumeAt = this.positions.get(url) || 0;
    this.audio.addEventListener('loadedmetadata', () => {
      if (selection !== this.selection || !resumeAt) return;
      try { this.audio.currentTime = Math.min(resumeAt, Math.max(0, this.audio.duration - .25)); }
      catch { /* Playback can still start if seeking is unavailable. */ }
    }, { once: true });
    this.audio.src = url;
    this.audio.load();
    if (this.enabled) void this.setEnabled(true);
  },
  async setEnabled(value) {
    const request = ++this.playRequest;
    this.enabled=value;
    const toggle=document.querySelector('#sound');
    toggle.setAttribute('aria-pressed',String(value));
    toggle.setAttribute('aria-label',value?'Выключить музыку':'Включить музыку');
    toggle.innerHTML=value?'♫ <span>Выкл.</span>':'♪ <span>Звук</span>';
    if(!value){if(this.audio)this.audio.pause();if(this.context)await this.context.suspend();return;}
    try {
      if(this.audio || CONFIG.musicUrl){
        if(!this.audio){this.audio=new Audio(CONFIG.musicUrl);this.audio.loop=true;this.audio.volume=1;}
        await this.audio.play();
      } else {
        if(!this.context){
          this.context=new (window.AudioContext||window.webkitAudioContext)();
          this.gain=this.context.createGain();this.gain.gain.value=.11;this.gain.connect(this.context.destination);
        }
        await this.context.resume();
        if(!this.timer){this.note();this.timer=setInterval(()=>this.note(),750);}
      }
    } catch(error){
      if (request !== this.playRequest) return;
      console.warn('Музыка недоступна:',error.name);
      void this.setEnabled(false);
    }
  },
  note(){
    if(!this.enabled||this.context.state!=='running')return;
    const melody=[60,64,67,71,69,67,64,62,57,60,64,67,65,64,60,59];
    const time=this.context.currentTime;
    const osc=this.context.createOscillator(),amp=this.context.createGain();
    osc.type='sine';osc.frequency.value=440*2**((melody[this.step++%melody.length]-69)/12);
    amp.gain.setValueAtTime(0,time);amp.gain.linearRampToValueAtTime(.5,time+.025);amp.gain.exponentialRampToValueAtTime(.001,time+2.5);
    osc.connect(amp);amp.connect(this.gain);osc.start(time);osc.stop(time+2.6);
  }
};
// Read just the media metadata ahead of the tap; playback still needs a gesture.
if (CONFIG.musicUrl) {
  music.audio = new Audio();
  music.audio.preload = 'metadata';
  music.audio.loop = true;
  // The file itself is attenuated by 18 dB and fades in over 3 seconds.
  // This also works on iOS, where HTMLMediaElement.volume can be ignored.
  music.audio.volume = 1;
  music.audio.src = CONFIG.musicUrl;
  music.trackUrl = CONFIG.musicUrl;
  music.audio.id = 'background-music';
  music.audio.hidden = true;
  document.body.append(music.audio);
}
document.querySelector('#sound').addEventListener('click',()=>music.setEnabled(!music.enabled));
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){if(music.context)music.context.suspend();if(music.audio)music.audio.pause();}
  else if(music.enabled)music.setEnabled(true);
});
const dialog=document.querySelector('#certificate');
function showCertificate(){dialog.showModal();}
function closeCertificate(){dialog.close();}
document.querySelector('#close-certificate').addEventListener('click',closeCertificate);
document.querySelector('#return').addEventListener('click',closeCertificate);
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeCertificate();}});
if(CONFIG.certificateImage||CONFIG.certificateUrl||CONFIG.certificateFile){
  const content=document.querySelector('#certificate-content');content.replaceChildren();
  if(CONFIG.certificateImage){const img=new Image();img.src=CONFIG.certificateImage;img.alt='Подарочный сертификат';img.className='certificate-image';content.append(img);}
  const previewUrl = CONFIG.certificateUrl || CONFIG.certificateFile;
  if(previewUrl){const link=document.createElement('a');link.href=previewUrl;link.textContent='Открыть сертификат';link.className='certificate-link';link.target='_blank';link.rel='noopener noreferrer';content.append(link);}
  if (CONFIG.certificateIsTest) {
    document.querySelector('#certificate-title').textContent = 'Проверка скачивания';
    const note = document.createElement('p');
    note.className = 'note';
    note.textContent = 'Временный тестовый PDF. Это не подарочный сертификат. Настоящий сертификат будет добавлен позже.';
    content.prepend(note);
    const link = content.querySelector('a');
    if (link) link.textContent = 'Открыть тестовый PDF';
  }
}
const certificateFile = CONFIG.certificateFile || CONFIG.certificateImage ||
  (/\.(pdf|png|jpe?g|webp)(?:[?#]|$)/i.test(CONFIG.certificateUrl) ? CONFIG.certificateUrl : '');
const downloadButton = document.querySelector('#download-certificate');
const downloadStatus = document.querySelector('#download-status');
let notificationEndpoint = '';
try {
  const endpoint = new URL(CONFIG.downloadNotificationEndpoint);
  if (endpoint.protocol === 'https:' && endpoint.hostname === 'formspree.io' && /^\/f\/[a-z0-9]+\/?$/i.test(endpoint.pathname)) {
    notificationEndpoint = endpoint.href;
  }
} catch { /* The service is optional until its real form URL is supplied. */ }
downloadButton.disabled = !certificateFile;
if (CONFIG.certificateIsTest) downloadButton.textContent = 'Скачать тестовый PDF ↓';
document.querySelector('#download-unavailable').hidden = Boolean(certificateFile);

// keepalive lets the browser finish a small request even if window.close succeeds.
// These events record a click, not proof that the tab closed or the gift was declined.
const actionNotificationTimes = new Map();
async function notifyAction(event, button) {
  if (!notificationEndpoint) return;
  const now = Date.now();
  if (now - (actionNotificationTimes.get(event) || 0) < 1500) return;
  actionNotificationTimes.set(event, now);
  try {
    const response = await fetch(notificationEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        _subject: `Нажата кнопка «${button}»`,
        event,
        message: `Посетитель нажал кнопку «${button}» на странице приглашения.`,
        occurred_at: new Date(now).toISOString()
      })
    });
    if (!response.ok) console.warn('Уведомление о нажатии кнопки не принято:', response.status);
  } catch {
    console.warn('Уведомление о нажатии кнопки не отправлено.');
  }
}

async function notifyDownload(filename) {
  if (!notificationEndpoint) return;
  const status = document.querySelector('#notification-status');
  if (CONFIG.certificateIsTest) status.textContent = 'Отправляем тестовое уведомление…';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(notificationEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      keepalive: true,
      signal: controller.signal,
      body: JSON.stringify({
        _subject: CONFIG.certificateIsTest ? '[ТЕСТ] Проверка скачивания файла' : 'Нажата кнопка скачивания подарочного сертификата',
        event: 'certificate_download_requested',
        message: CONFIG.certificateIsTest ? 'Тестовая проверка: нажата кнопка скачивания временного PDF. Это не настоящий сертификат. Сохранение файла на телефон браузер не подтверждает.' : 'Посетитель нажал «Скачать сертификат». Это запрос на скачивание; сохранение файла на телефон браузер не подтверждает.',
        test: Boolean(CONFIG.certificateIsTest),
        file: filename,
        occurred_at: new Date().toISOString()
      })
    });
    if (!response.ok) {
      console.warn('Уведомление о запросе скачивания не принято:', response.status);
      if (CONFIG.certificateIsTest) status.textContent = 'Файл можно скачать, но форма не приняла уведомление. Попробуй ещё раз.';
    } else if (CONFIG.certificateIsTest) {
      status.textContent = 'Форма приняла тестовое уведомление. Проверь Яндекс Почту и папку «Спам».';
    }
  } catch {
    console.warn('Уведомление о запросе скачивания не отправлено. Скачивание остаётся доступным.');
    if (CONFIG.certificateIsTest) status.textContent = 'Файл можно скачать, но уведомление не отправилось. Проверь интернет и попробуй ещё раз.';
  }
  finally { clearTimeout(timeout); }
}

downloadButton.addEventListener('click', () => {
  if (downloadButton.disabled || !certificateFile) return;
  const file = new URL(certificateFile, document.baseURI);
  if (!['https:', 'http:'].includes(file.protocol)) return;
  const ext = file.pathname.match(/\.(pdf|png|jpe?g|webp)$/i)?.[1] || 'pdf';
  const filename = `${CONFIG.certificateIsTest ? 'Тестовый файл' : 'Подарочный сертификат'}.${ext}`;
  const link = document.createElement('a');
  link.href = file.href;
  link.download = filename;
  if (file.origin !== location.origin) link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.append(link);
  link.click();
  link.remove();
  downloadStatus.textContent = 'Если файл открылся в браузере, выбери «Поделиться» → «Сохранить в Файлы».';
  // Send only the button-click event, after the browser has been asked to download.
  // Mail delivery must never block the certificate or masquerade as proof of saving.
  void notifyDownload(filename);
  downloadButton.disabled = true;
  setTimeout(() => { downloadButton.disabled = false; }, 1500);
});
