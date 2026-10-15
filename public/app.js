const storageKey = 'vault-anonymous-player-id';
const symbols = {
  coin: { alt: 'Moeda', src: '/symbols/coin.png' },
  blank: { alt: 'Em branco' },
  clover: { alt: 'Trevo', src: '/symbols/clover.png' },
  snake: { alt: 'Cobra', src: '/symbols/snake.png' },
  trap: { alt: 'Armadilha', src: '/symbols/trap.png' },
  crown: { alt: 'Coroa', src: '/symbols/crown.png' },
  'coin-bag': { alt: 'Bolsa de dinheiro', src: '/symbols/coin-bag.png' },
  'multiplier-2x': { alt: 'Multiplicador de duas vezes', src: '/symbols/multiplier-2x.png' },
};
const labels = {
  win: 'prêmio calculado',
  loss: 'sem prêmio nesta rodada',
  'snake-loss': 'a cobra anulou o giro',
  'snake-protected': 'armadilha protegeu a cobra',
};
const state = { result: null, selectedReel: 0, busy: true };
const $ = (selector) => document.querySelector(selector);
const reels = [...document.querySelectorAll('.reel')];

function playerId() {
  const current = localStorage.getItem(storageKey);
  if (current && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(current))
    return current;
  const next = crypto.randomUUID();
  localStorage.setItem(storageKey, next);
  return next;
}
async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'content-type': 'application/json', 'x-anonymous-player-id': playerId(), ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || 'Não foi possível concluir a ação.');
  return body;
}
function setBusy(value) {
  state.busy = value;
  $('#spin-button').disabled = value;
  $('#redeem-button').disabled = value || !state.result;
  $('#bonus-button').disabled = value || !state.result;
}
function message(text = '') {
  const node = $('#message');
  node.hidden = !text;
  node.textContent = text;
}
function symbolImage(symbol, className = 'symbol-image') {
  const asset = symbols[symbol];
  if (!asset.src) {
    const blank = document.createElement('span');
    blank.className = `${className} blank-symbol`;
    blank.setAttribute('role', 'img');
    blank.setAttribute('aria-label', asset.alt);
    blank.textContent = '─';
    return blank;
  }
  const image = document.createElement('img');
  image.className = className;
  image.src = asset.src;
  image.alt = asset.alt;
  return image;
}
function updatePlayer(player) {
  $('#coin-balance').textContent = player.coinBalance;
  $('#record').textContent = player.personalRecord;
}
function update(response) {
  updatePlayer(response.player);
  updateResult(response.result);
}
function updateResult(result) {
  document.body.classList.add('has-result');
  const settled = result.settledAt !== null;
  state.result = settled ? null : result;
  $('#prize').textContent = settled
    ? `${result.pendingPrize} moedas liquidado${result.pendingPrize === 1 ? '' : 's'}`
    : result.pendingPrize > 0
      ? `${result.pendingPrize} moedas aguardando resgate`
      : labels[result.evaluation.outcome];
  $('#outcome .outcome-label').textContent = settled
    ? 'prêmio liquidado'
    : labels[result.evaluation.outcome] || 'resultado do servidor';
  $('#spin-button').textContent = settled ? 'Rolar · 1 moeda' : 'Rolar novamente · 1 moeda';
  reels.forEach((reel, index) => {
    reel.querySelector('span').replaceChildren(symbolImage(result.reels[index]));
  });
  $('#redeem-button').disabled = settled;
  $('#bonus-button').disabled = settled;
  message();
}
async function perform(action) {
  if (state.busy) return;
  setBusy(true);
  try {
    update(await action());
    await loadHistory();
  } catch (error) {
    message(error.message);
  } finally {
    setBusy(false);
  }
}
function openHistory() {
  $('#history-panel').hidden = false;
  $('#history-toggle').setAttribute('aria-expanded', 'true');
}
async function loadHistory() {
  const history = await api('/v1/history?limit=10&offset=0');
  updatePlayer(history.player);
  $('#history-list').replaceChildren(
    ...history.items.map((item) => {
      const line = document.createElement('li');
      const symbolsPreview = document.createElement('span');
      symbolsPreview.className = 'history-symbols';
      item.reels.forEach((symbol) => symbolsPreview.append(symbolImage(symbol, 'history-symbol')));
      const details = document.createElement('small');
      details.textContent = `${item.pendingPrize} moedas · ${item.settledAt ? 'liquidado' : 'pendente'}`;
      line.append(symbolsPreview, details);
      return line;
    }),
  );
  const pendingResult = history.items.find((item) => item.settledAt === null);
  // A page refresh starts with an idle machine. Keep an existing pending
  // result only for the next server action; do not reveal it in the reels.
  if (state.result === null && pendingResult) state.result = pendingResult;
}
reels.forEach((reel) =>
  reel.addEventListener('click', () => {
    state.selectedReel = Number(reel.dataset.reel);
    reels.forEach((item, index) => {
      item.classList.toggle('is-selected', index === state.selectedReel);
      item.setAttribute('aria-pressed', String(index === state.selectedReel));
    });
  }),
);
$('#spin-button').addEventListener('click', () =>
  perform(() =>
    api('/v1/spins', {
      method: 'POST',
      body: JSON.stringify(state.result ? { pendingResultId: state.result.id } : {}),
    }),
  ),
);
$('#bonus-button').addEventListener('click', () =>
  perform(() =>
    api(`/v1/results/${state.result.id}/bonus-spins`, {
      method: 'POST',
      body: JSON.stringify({ reelIndex: state.selectedReel }),
    }),
  ),
);
$('#redeem-button').addEventListener('click', () =>
  perform(() => api(`/v1/results/${state.result.id}/redeem`, { method: 'POST' })),
);
$('#history-toggle').addEventListener('click', () => {
  openHistory();
  void loadHistory().catch((error) => message(error.message));
});
$('#history-close').addEventListener('click', () => {
  $('#history-panel').hidden = true;
  $('#history-toggle').setAttribute('aria-expanded', 'false');
});
async function initializeGame() {
  setBusy(true);
  try {
    await loadHistory();
  } catch (error) {
    message(error.message);
    return;
  }
  setBusy(false);
}
void initializeGame();
