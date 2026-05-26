/**
 * 从自然语言文本中提取钢框架设计参数（离线关键词匹配）。
 * 用作 LLM 调用失败时的智能兜底方案。
 */
import type { RunPipelineParams } from '../types';

interface ParsedParams {
  params: RunPipelineParams;
  confidence: 'high' | 'medium' | 'low';
}

// ── Pattern matchers ─────────────────────────────────────────────

const STORY_PATTERNS = [
  /(\d+)\s*[层楼Ff]/,
  /(\d+)\s*stor(?:y|ies)/i,
  /[一二三四五六七八九十]\s*层/,
];
const CN_NUMS: Record<string, number> = {
  '一': 1, '二': 2, '两': 2, '三': 3, '四': 4, '五': 5,
  '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
};

const SPAN_PATTERNS = [
  /(\d+\.?\d*)\s*(?:m|米|M)\s*(?:跨|柱距|开间|柱网)/,
  /(?:跨|柱距|开间|柱网)\s*(\d+\.?\d*)\s*(?:m|米|M)?/,
  /(\d+\.?\d*)\s*(?:m|米|M)/,
];

const HEIGHT_PATTERNS = [
  /(?:层高|首层层高|底层层高)\s*(\d+\.?\d*)\s*(?:m|米|M)?/,
  /(?:高)\s*(\d+\.?\d*)\s*(?:m|米|M)/,
];

const LOAD_PATTERNS = [
  /吊车|行车|crane/i,
  /重载|heavy/i,
];

export function parseDesignParams(text: string): ParsedParams {
  let confidence: 'high' | 'medium' | 'low' = 'low';
  const flags = { crane: false, heavy: false };

  // ── Building type ──────────────────────────────────────────────
  const isWorkshop = /厂房|车间|仓库|workshop|factory|warehouse/i.test(text);
  const isOffice = /办公|写字楼|office/i.test(text);
  const isHighRise = /高层|tall|high.rise/i.test(text);

  let name = '钢框架';
  if (isWorkshop) { name = '厂房'; confidence = 'medium'; }
  else if (isOffice) { name = '办公楼'; confidence = 'medium'; }
  else if (isHighRise) { name = '高层建筑'; confidence = 'medium'; }

  // ── Stories ────────────────────────────────────────────────────
  let numStories = 4;
  for (const pat of STORY_PATTERNS) {
    const m = text.match(pat);
    if (m) {
      if (m[1]) {
        const cn = CN_NUMS[m[1]];
        numStories = cn || parseInt(m[1], 10);
      }
      confidence = 'high';
      break;
    }
  }
  // CN char match in full text
  for (const [cn, n] of Object.entries(CN_NUMS)) {
    if (text.includes(`${cn}层`)) {
      numStories = n;
      confidence = 'high';
      break;
    }
  }

  // ── Span ───────────────────────────────────────────────────────
  let span = 6;
  for (const pat of SPAN_PATTERNS) {
    const m = text.match(pat);
    if (m && m[1]) {
      span = parseFloat(m[1]);
      confidence = 'high';
      break;
    }
  }
  // 厂房默认更大跨度
  if (confidence !== 'high' && isWorkshop) span = 9;

  // ── Crane / special loads ──────────────────────────────────────
  for (const pat of LOAD_PATTERNS) {
    if (pat.test(text)) {
      flags.crane = true;
      confidence = 'high';
      break;
    }
  }

  // ── Story heights ──────────────────────────────────────────────
  let firstStoryH = 4.5;
  let typicalH = 3.6;
  for (const pat of HEIGHT_PATTERNS) {
    const m = text.match(pat);
    if (m && m[1]) { firstStoryH = parseFloat(m[1]); break; }
  }
  if (flags.crane && isWorkshop) { firstStoryH = 9.0; typicalH = 4.5; }
  else if (isWorkshop) { firstStoryH = 7.5; typicalH = 4.5; }
  else if (numStories >= 8) { firstStoryH = 4.5; typicalH = 3.9; }
  else if (numStories <= 2) { firstStoryH = 6.0; typicalH = 4.5; }

  const storyHeights: number[] = [firstStoryH];
  for (let i = 1; i < numStories; i++) storyHeights.push(typicalH);

  // ── Section & material ─────────────────────────────────────────
  const material = isWorkshop ? 'Q235' : 'Q355';
  const columnSection = isWorkshop ? 'HW350x350x12x19' : 'HW400x400x13x21';
  const beamSection = isWorkshop ? 'HM340x250x9x14' : 'HM390x300x10x16';

  // ── Loads ──────────────────────────────────────────────────────
  const deadLoad = isWorkshop ? 1.5 : 2.0;
  const liveLoad = flags.crane ? 8.0 : isWorkshop ? 5.0 : 3.0;
  const windPressure = isWorkshop ? 0.55 : 0.45;
  const seismicIntensity = isWorkshop ? 0.05 : 0.08;

  const params: RunPipelineParams = {
    grid_x: Array(3).fill(span),
    grid_y: Array(2).fill(span),
    num_stories: numStories,
    story_heights: storyHeights,
    column_section: columnSection,
    beam_section: beamSection,
    material,
    name,
    dead_load: deadLoad,
    live_load: liveLoad,
    wind_pressure: windPressure,
    seismic_intensity: seismicIntensity,
  };

  return { params, confidence };
}
