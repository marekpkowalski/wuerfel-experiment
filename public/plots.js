// Chart drawing with Plotly (loaded as the global `Plotly` from /vendor/plotly.min.js).
// Every chart shows what a fair die would give, so students compare data with theory.
import { t } from './i18n.js';
import { FACE_COLORS } from './dice.js';
import { FACES, P_FACE, countSd } from './stats.js';

const INK = '#1e2b4f';
const PENCIL = '#5b6478';
const RULE = '#dce3ee';
const OBSERVED = '#7d93be';
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const CONFIG = { displayModeBar: false, responsive: true };

function layout(extra) {
  return {
    height: 280,
    margin: { l: 56, r: 16, t: 12, b: 52 },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { family: FONT, size: 14, color: INK },
    hoverlabel: { font: { family: FONT, size: 14 } },
    showlegend: false,
    ...extra,
  };
}

function axis(title, extra = {}) {
  return {
    title: { text: title, font: { size: 13, color: PENCIL } },
    gridcolor: RULE,
    zeroline: false,
    linecolor: RULE,
    tickfont: { size: 13 },
    fixedrange: true,
    ...extra,
  };
}

function emptyNote() {
  return [{ text: t('no_data'), showarrow: false, xref: 'paper', yref: 'paper', x: 0.5, y: 0.5, font: { size: 16, color: PENCIL } }];
}

/**
 * How often each face came up: one circle per face with an error bar of ±1σ,
 * where σ = √(n · 1/6 · 5/6) is the spread expected from chance alone for a fair
 * die. The dashed line is the expected value n/6. For a fair die, about two thirds
 * of the error bars should reach the dashed line.
 */
export function frequencyChart(el, freq, { percent = false } = {}) {
  const n = freq.reduce((a, b) => a + b, 0);
  const scale = percent && n > 0 ? 100 / n : 1;
  const expected = n * P_FACE * scale;
  const sd = countSd(n) * scale;
  const y = freq.map((c) => c * scale);
  const fmt = (v) => (percent ? `${v.toFixed(1)} %` : String(Math.round(v)));
  const sdText = percent ? `${sd.toFixed(1)} %` : sd.toFixed(1);

  const data = n > 0 ? [{
    type: 'scatter',
    mode: 'markers+text',
    x: FACES,
    y,
    error_y: { type: 'constant', value: sd, color: INK, thickness: 2, width: 8 },
    marker: { size: 16, color: FACE_COLORS, line: { color: INK, width: 2 } },
    text: y.map(fmt),
    textposition: 'middle right',
    textfont: { color: INK, size: 14 },
    cliponaxis: false,
    hovertemplate: `${t('face_axis')} %{x}: %{text} ± ${sdText}<extra></extra>`,
  }] : [];

  const shapes = n > 0 ? [
    { type: 'line', xref: 'x', yref: 'y', x0: 0.5, x1: 6.5, y0: expected, y1: expected, line: { color: INK, width: 2, dash: 'dash' } },
  ] : [];

  const top = Math.max(...y.map((v) => v + sd), expected + 2 * sd, percent ? 25 : 1);
  Plotly.react(el, data, layout({
    xaxis: axis(t('face_axis'), { tickvals: FACES, range: [0.5, 6.7], gridcolor: 'rgba(0,0,0,0)' }),
    yaxis: axis(percent ? t('percent_axis') : t('count_axis'), { range: [0, top * 1.12] }),
    shapes,
    annotations: n > 0 ? [] : emptyNote(),
  }), CONFIG);
}

/** Observed number of runs per length (bars) against the fair-die expectation (diamonds). */
export function runChart(el, observed, expected) {
  const obsKeys = Object.keys(observed).map(Number);
  const expKeys = Object.keys(expected).map(Number).filter((k) => expected[k] >= 0.3);
  const kMax = Math.max(4, ...obsKeys, ...expKeys);
  const ks = Array.from({ length: kMax }, (_, i) => i + 1);
  const hasData = obsKeys.length > 0;

  const data = [
    {
      type: 'bar', name: t('observed'), x: ks, y: ks.map((k) => observed[k] || 0),
      marker: { color: OBSERVED, line: { color: INK, width: 1 } },
      hovertemplate: `${t('run_axis')} %{x}: %{y}<extra>${t('observed')}</extra>`,
    },
    {
      type: 'scatter', mode: 'lines+markers', name: t('expected'), x: ks, y: ks.map((k) => expected[k] || 0),
      line: { color: INK, width: 1.5, dash: 'dash' },
      marker: { symbol: 'diamond', size: 10, color: '#ffffff', line: { color: INK, width: 2 } },
      hovertemplate: `${t('run_axis')} %{x}: %{y:.1f}<extra>${t('expected')}</extra>`,
    },
  ];

  Plotly.react(el, hasData ? data : [], layout({
    showlegend: hasData,
    legend: { orientation: 'h', x: 0, y: 1.12, font: { size: 13 } },
    margin: { l: 56, r: 16, t: 34, b: 52 },
    xaxis: axis(t('run_axis'), { tickvals: ks, range: [0.5, kMax + 0.5], gridcolor: 'rgba(0,0,0,0)' }),
    yaxis: axis(t('runs_axis'), { rangemode: 'tozero' }),
    annotations: hasData ? [] : emptyNote(),
    bargap: 0.3,
  }), CONFIG);
}
