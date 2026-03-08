import { computeBattle } from './algorithm';
function el(id) { return document.getElementById(id); }
function parseInputs() {
    const attacker = Math.max(1, Math.floor(Number(el('attacker').value || 0)));
    const defender = Math.max(1, Math.floor(Number(el('defender').value || 0)));
    const seed = (el('seed').value || '').trim() || undefined;
    return { attacker, defender, seed };
}
function dieSVG(value, success) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 48 48');
    svg.setAttribute('width', '48');
    svg.setAttribute('height', '48');
    const g = document.createElementNS(ns, 'g');
    const bg = document.createElementNS(ns, 'rect');
    bg.setAttribute('x', '4');
    bg.setAttribute('y', '4');
    bg.setAttribute('rx', '10');
    bg.setAttribute('ry', '10');
    bg.setAttribute('width', '40');
    bg.setAttribute('height', '40');
    bg.setAttribute('fill', success ? '#183d2e' : '#3a1f25');
    bg.setAttribute('stroke', success ? '#2be3a0' : '#ff7d7d');
    bg.setAttribute('stroke-width', '1.5');
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', '24');
    text.setAttribute('y', '29');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('font-size', value >= 100 ? '14' : value >= 10 ? '16' : '18');
    text.setAttribute('font-weight', '800');
    text.setAttribute('fill', success ? '#9ff5d3' : '#ffb3b3');
    text.textContent = String(value);
    g.appendChild(bg);
    g.appendChild(text);
    svg.appendChild(g);
    return svg;
}
function clear(node) { while (node.firstChild)
    node.removeChild(node.firstChild); }
let last = null;
function render(output) {
    last = output;
    document.getElementById('attUnits').textContent = String(output.attacker.units);
    document.getElementById('defUnits').textContent = String(output.defender.units);
    document.getElementById('attThreshold').textContent = String(output.attacker.threshold);
    document.getElementById('defThreshold').textContent = String(output.defender.threshold);
    document.getElementById('attSuccesses').textContent = String(output.attacker.successes);
    document.getElementById('defSuccesses').textContent = String(output.defender.successes);
    document.getElementById('attSurvivors').textContent = String(output.attacker.survivors);
    document.getElementById('defSurvivors').textContent = String(output.defender.survivors);
    document.getElementById('rollCount').textContent = String(output.rollCount);
    const winnerText = output.winner === 'attacker' ? 'Attacker' : 'Defender';
    document.getElementById('winner').innerHTML = output.winner === 'attacker'
        ? `<span class='winner'>${winnerText}</span>`
        : `<span class='loser'>${winnerText}</span>`;
    const attDice = document.getElementById('attDice');
    const defDice = document.getElementById('defDice');
    clear(attDice);
    clear(defDice);
    output.attacker.rolls.forEach(v => {
        const ok = v <= output.attacker.threshold;
        const wrap = document.createElement('div');
        wrap.className = 'die-wrap';
        wrap.appendChild(dieSVG(v, ok));
        attDice.appendChild(wrap);
    });
    output.defender.rolls.forEach(v => {
        const ok = v <= output.defender.threshold;
        const wrap = document.createElement('div');
        wrap.className = 'die-wrap';
        wrap.appendChild(dieSVG(v, ok));
        defDice.appendChild(wrap);
    });
    document.getElementById('steps').textContent = output.steps.join('\n');
}
function runOnce() {
    const input = parseInputs();
    render(computeBattle(input));
}
function reroll() {
    if (!last) {
        runOnce();
        return;
    }
    const seedInp = el('seed');
    const s = seedInp.value.trim();
    if (s)
        seedInp.value = s + 'r';
    runOnce();
}
function setup() {
    document.getElementById('rollBtn').addEventListener('click', runOnce);
    document.getElementById('rerollBtn').addEventListener('click', reroll);
    document.querySelectorAll('[data-preset]').forEach(btn => {
        btn.addEventListener('click', () => {
            const [a, d] = btn.dataset.preset.split(',').map(Number);
            el('attacker').value = String(a);
            el('defender').value = String(d);
            runOnce();
        });
    });
    runOnce();
}
document.addEventListener('DOMContentLoaded', setup);
