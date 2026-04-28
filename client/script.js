const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

const canvas = document.getElementById('scratch');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const prizeEl = document.getElementById('prize');
const statusEl = document.getElementById('status');
const balanceEl = document.getElementById('balance');
const ticketsEl = document.getElementById('tickets');

let currentTicketData = { prize: '', value: 0 };
let isRevealed = false;
let isDrawing = false;
const userId = tg.initDataUnsafe?.user?.id || 'demo_user';

function resizeCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width; canvas.height = rect.height;
  drawScratchLayer();
}

function drawScratchLayer() {
  ctx.globalCompositeOperation = 'source-over';
  const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  grad.addColorStop(0, '#6b7280'); grad.addColorStop(1, '#4b5563');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = 'bold 16px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('✦ СТИРАЙТЕ ЗДЕСЬ ✦', canvas.width / 2, canvas.height / 2);
}

function scratch(x, y) {
  if (isRevealed) return;
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath(); ctx.arc(x, y, 25, 0, Math.PI * 2); ctx.fill();
  checkProgress();
}

function checkProgress() {
  if (isRevealed) return;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let transparent = 0;
  for (let i = 3; i < imageData.data.length; i += 16) {
    if (imageData.data[i] === 0) transparent++;
  }
  const percent = (transparent / (imageData.data.length / 16)) * 100;
  statusEl.textContent = `Стерто: ${Math.round(percent)}%`;
  if (percent >= 60) revealPrize();
}

function revealPrize() {
  if (isRevealed) return;
  isRevealed = true;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  canvas.style.pointerEvents = 'none';
  statusEl.textContent = '⏳ Сохраняем результат...';
  if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');

  fetch('/api/user/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, prizeValue: currentTicketData.value })
  })
  .then(res => res.json())
  .then(data => {
    balanceEl.textContent = data.newBalance;
    ticketsEl.textContent = data.ticketsLeft;
    prizeEl.textContent = currentTicketData.prize;
    statusEl.textContent = '✅ Готово! Переходим в чат...';

    // Сервер уже написал в чат, просто закрываем приложение
    setTimeout(() => tg.close(), 800);
  })
  .catch(err => {
    statusEl.textContent = '❌ Ошибка сети. Попробуйте позже.';
    console.error(err);
  });
}

function getCoords(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.touches ? e.touches[0].clientX : e.clientX) - rect.left,
    y: (e.touches ? e.touches[0].clientY : e.clientY) - rect.top
  };
}

canvas.addEventListener('pointerdown', e => { isDrawing = true; scratch(getCoords(e).x, getCoords(e).y); });
canvas.addEventListener('pointermove', e => { if (isDrawing) scratch(getCoords(e).x, getCoords(e).y); });
canvas.addEventListener('pointerup', () => isDrawing = false);
canvas.addEventListener('pointerleave', () => isDrawing = false);

window.addEventListener('load', () => {
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Загружаем баланс
  fetch(`/api/user/balance?userId=${userId}`)
    .then(r => r.json())
    .then(data => {
      balanceEl.textContent = data.balance;
      ticketsEl.textContent = data.tickets;
      if (data.tickets <= 0) {
        statusEl.textContent = '❌ Билеты закончились. Приходите завтра!';
        canvas.style.pointerEvents = 'none';
      }
    });

  // Генерируем приз
  fetch('/api/ticket/generate')
    .then(r => r.json())
    .then(data => { currentTicketData = data; prizeEl.textContent = '???'; });
});