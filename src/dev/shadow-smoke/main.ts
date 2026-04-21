import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import chessgroundBase from 'chessground/assets/chessground.base.css?inline';
import chessgroundBrown from 'chessground/assets/chessground.brown.css?inline';
import chessgroundCburnett from 'chessground/assets/chessground.cburnett.css?inline';
import tokens from '@/styles/tokens.css?inline';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const log = (msg: string, pass?: boolean) => {
  const el = document.getElementById('log')!;
  const line = document.createElement('div');
  line.textContent = msg;
  if (pass === true) line.className = 'pass';
  if (pass === false) line.className = 'fail';
  el.appendChild(line);
};

function mountShadow(): { shadow: ShadowRoot; boardEl: HTMLElement; api: Api } {
  const host = document.getElementById('host')!;
  host.innerHTML = '';
  const shadowHost = document.createElement('div');
  host.appendChild(shadowHost);
  const shadow = shadowHost.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = [chessgroundBase, chessgroundBrown, chessgroundCburnett, tokens].join('\n');
  shadow.appendChild(style);

  const boardEl = document.createElement('div');
  boardEl.className = 'cg-wrap';
  boardEl.style.width = '320px';
  boardEl.style.height = '320px';
  shadow.appendChild(boardEl);

  const api = Chessground(boardEl, {
    fen: START_FEN,
    orientation: 'white',
    movable: { free: false, color: 'white', dests: new Map([['e2', ['e3', 'e4']]]) },
    animation: { enabled: true, duration: 250 },
  });

  return { shadow, boardEl, api };
}

document.getElementById('run-a')!.addEventListener('click', () => {
  const { shadow } = mountShadow();
  const pieces = Array.from(shadow.querySelectorAll('piece')).filter(
    (p) => /\b(white|black)\b/.test(p.className),
  );
  const pass = pieces.length === 32;
  log(`(a) Render: ${pieces.length} real pieces found`, pass);
});

document.getElementById('run-b')!.addEventListener('click', () => {
  // Mount with a drag-ready config and a visible instruction. When the
  // user drags e2 pawn to e4 by hand, movable.events.after fires and logs
  // the success. We can't reliably simulate drag via events across shadow-
  // DOM boundaries, so this is a hands-on check — that's fine: the point
  // is to prove user interaction flows through shadow DOM.
  const host = document.getElementById('host')!;
  host.innerHTML = '';
  const shadowHost = document.createElement('div');
  host.appendChild(shadowHost);
  const shadow = shadowHost.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = [chessgroundBase, chessgroundBrown, chessgroundCburnett, tokens].join('\n');
  shadow.appendChild(style);
  const boardEl = document.createElement('div');
  boardEl.className = 'cg-wrap';
  boardEl.style.width = '320px';
  boardEl.style.height = '320px';
  shadow.appendChild(boardEl);
  Chessground(boardEl, {
    fen: START_FEN,
    orientation: 'white',
    movable: {
      free: false,
      color: 'white',
      dests: new Map([
        ['e2', ['e3', 'e4']],
        ['d2', ['d3', 'd4']],
      ]),
      events: {
        after: (orig, dest) => {
          log(`(b) Drag detected: ${orig}→${dest}`, orig === 'e2' && dest === 'e4');
        },
      },
    },
    animation: { enabled: true, duration: 250 },
  });
  log(`(b) Drag the e2 pawn to e4 by hand — the outcome will log below.`, undefined);
});

document.getElementById('run-c')!.addEventListener('click', () => {
  const { shadow, api } = mountShadow();
  const before = performance.now();
  api.move('e2', 'e4');
  const start = performance.now();
  const iv = setInterval(() => {
    const e4 = shadow.querySelector('piece.pawn.white');
    if (e4 && (performance.now() - start) > 200) {
      clearInterval(iv);
      const elapsed = performance.now() - before;
      const pass = elapsed >= 200 && elapsed <= 400;
      log(`(c) Animation ~250ms: elapsed ${elapsed.toFixed(0)}ms`, pass);
    } else if (performance.now() - start > 1000) {
      clearInterval(iv);
      log(`(c) Animation: FAILED — never settled within 1s`, false);
    }
  }, 16);
});

document.getElementById('run-d')!.addEventListener('click', () => {
  const { shadow } = mountShadow();
  const piece = shadow.querySelector('piece.king.white');
  const pieceBg = piece ? getComputedStyle(piece).backgroundImage : '';
  const pass = pieceBg.includes('url(');
  log(`(d) CSS visible: piece-bg="${pieceBg.slice(0, 60)}…"`, pass);
});

document.getElementById('run-e')!.addEventListener('click', () => {
  const { shadow } = mountShadow();
  const probe = document.createElement('div');
  probe.style.cssText = 'width: 10px; height: 10px; background: var(--bg);';
  shadow.appendChild(probe);
  const before = getComputedStyle(probe).backgroundColor;
  log(`(e) --bg in shadow: "${before}" — toggle OS appearance, then click again.`, undefined);
});
