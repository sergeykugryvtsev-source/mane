'use strict';
// Set these to the real gift before sharing. Relative URLs are supported.
const CONFIG = { musicUrl: '', certificateImage: '', certificateUrl: '' };
const descriptions = [
  'Кажется, тебе кое-что передали… Нажми на конверт.',
  'Приглашение на кулинарный мастер-класс.',
  'У тебя наверняка сложилось впечатление, что вершина моих кулинарных способностей — паста с васаби… Предлагаю проверить, есть ли у меня шансы на что-то посерьёзнее.',
  'Хочу пригласить тебя на кулинарный мастер-класс. Выберем что-нибудь интересное и приготовим вкусный ужин вместе.',
  'Но самое важное… Это подарок тебе, и только тебе решать, как им воспользоваться. Ты можешь пойти со мной, с кем-то другим или выбрать удобное время для себя. Никаких обязательств и ожиданий. Просто приятный опыт и новые впечатления.',
  'Пусть в твоей жизни будет больше приятных моментов, новых впечатлений и вкусных открытий.'
];
const slides = document.querySelector('#slides');
let current = 0, opening = false, opened = false;
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
slides.querySelector('.postpone').addEventListener('click', () => {
  document.querySelector('#later').hidden = false;
  setTimeout(() => document.querySelector('#later').hidden = true, 4000);
});
function go(index) {
  if(index<0||index>5||opening)return;
  current=index;
  loadImage(current);
  document.querySelector('#later').hidden = true;
  [...slides.children].forEach((el,i)=>{el.classList.toggle('active',i===current);el.inert=i!==current;});
  document.querySelector('#back').hidden=current===0;
  document.querySelector('#announcement').textContent=`Экран ${current+1} из 6. ${descriptions[current]}`;
  slides.children[current].querySelector('button').focus({preventScroll:true});
}
function openEnvelope() {
  if(opening)return;
  if(opened){go(1);return;}
  opened=true; opening=true;
  music.setEnabled(true);
  document.querySelector('#opening').classList.add('play');
  slides.children[0].classList.add('unsealing');
  setTimeout(()=>{opening=false;go(1);document.querySelector('#opening').classList.remove('play');},matchMedia('(prefers-reduced-motion: reduce)').matches?0:1400);
}
document.querySelector('#back').addEventListener('click',()=>go(current-1));
document.addEventListener('keydown',e=>{
  if(document.querySelector('dialog').open||opening)return;
  if(e.key==='ArrowRight'&&current>0)go(current+1);
  if(e.key==='ArrowLeft')go(current-1);
});
const music = {
  enabled:false, context:null, gain:null, timer:null, audio:null, step:0,
  async setEnabled(value) {
    this.enabled=value;
    const toggle=document.querySelector('#sound');
    toggle.setAttribute('aria-pressed',String(value));
    toggle.setAttribute('aria-label',value?'Выключить музыку':'Включить музыку');
    toggle.innerHTML=value?'♫ <span>Выкл.</span>':'♪ <span>Звук</span>';
    if(!value){if(this.audio)this.audio.pause();if(this.context)await this.context.suspend();return;}
    try {
      if(CONFIG.musicUrl){
        if(!this.audio){this.audio=new Audio(CONFIG.musicUrl);this.audio.loop=true;this.audio.volume=.2;}
        await this.audio.play();
      } else {
        if(!this.context){
          this.context=new (window.AudioContext||window.webkitAudioContext)();
          this.gain=this.context.createGain();this.gain.gain.value=.11;this.gain.connect(this.context.destination);
        }
        await this.context.resume();
        if(!this.timer){this.note();this.timer=setInterval(()=>this.note(),750);}
      }
    } catch(error){console.warn('Музыка недоступна:',error.name);this.setEnabled(false);}
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
if(CONFIG.certificateImage||CONFIG.certificateUrl){
  const content=document.querySelector('#certificate-content');content.replaceChildren();
  if(CONFIG.certificateImage){const img=new Image();img.src=CONFIG.certificateImage;img.alt='Подарочный сертификат';img.className='certificate-image';content.append(img);}
  if(CONFIG.certificateUrl){const link=document.createElement('a');link.href=CONFIG.certificateUrl;link.textContent='Открыть сертификат';link.className='certificate-link';link.target='_blank';link.rel='noopener noreferrer';content.append(link);}
}
