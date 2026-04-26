import Groq from 'groq-sdk';
import { ollamaGenerate } from './ollamaService.js';

const OLLAMA_SCORING_MODEL = 'mistral:latest';
const GROQ_SCORING_MODEL   = process.env.GROQ_SCORING_MODEL || 'llama-3.3-70b-versatile';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const cleanJSON = (text) => {
  const stripped = text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  // Extract JSON array from anywhere in the response (models sometimes add preamble)
  if (!stripped.startsWith('[') && !stripped.startsWith('{')) {
    const match = stripped.match(/\[[\s\S]*\]/);
    if (match) return match[0];
  }
  return stripped;
};

function buildPrompt(jobs, profile) {
  return `You are a job-fit evaluator. Score ALL ${jobs.length} jobs for this candidate.

Use relative scoring — strong fits score higher than weak fits. Do NOT give every job the same score.

CANDIDATE:
Skills: ${profile.skills?.join(', ') || 'Not specified'}
Experience: ${profile.experienceYears || 0} years
Target Role: ${profile.targetRole || 'Not specified'}
Preferred Locations: ${profile.preferredLocations?.join(', ') || 'Any'}

JOBS:
${jobs.map((j, i) => `${i + 1}. "${j.title}" at ${j.company} | ${j.location || 'No location'} | ${j.salary || 'Salary not disclosed'}`).join('\n')}

Scoring rubric per job:
- skillsMatch: 0-40 pts
- roleMatch: 0-30 pts
- experienceMatch: 0-20 pts
- locationMatch: 0-10 pts
- score: sum of above (0-100)

Return ONLY a valid JSON array with exactly ${jobs.length} objects in the same order. No markdown, no explanation:
[{"score":85,"skillsMatch":35,"roleMatch":25,"experienceMatch":18,"locationMatch":7,"strengths":["strength1"],"gaps":["gap1"],"summary":"one sentence fit summary"}]`;
}

async function scoreWithGroq(jobs, profile) {
  const response = await groq.chat.completions.create({
    model: GROQ_SCORING_MODEL,
    messages: [{ role: 'user', content: buildPrompt(jobs, profile) }],
  });
  const rawText = response.choices[0]?.message?.content ?? '';
  console.log('[jobScoring:groq] raw response (first 500 chars):', rawText.slice(0, 500));
  return rawText;
}

async function scoreWithOllama(jobs, profile) {
  const rawText = await ollamaGenerate(buildPrompt(jobs, profile), { model: OLLAMA_SCORING_MODEL });
  console.log('[jobScoring:ollama] raw response (first 500 chars):', rawText.slice(0, 500));
  return rawText;
}

async function scoreJobsBatch(jobs, profile, provider, onProgress, offset = 0) {
  const rawText = provider === 'groq'
    ? await scoreWithGroq(jobs, profile)
    : await scoreWithOllama(jobs, profile);

  const scores = JSON.parse(cleanJSON(rawText));
  if (!Array.isArray(scores)) throw new Error(`Expected array, got ${typeof scores}`);
  console.log(`[jobScoring:${provider}] Parsed ${scores.length} scores for ${jobs.length} jobs`);

  return jobs.map((job, i) => {
    const s = scores[i] || {};
    const scored = {
      ...job,
      // Math.round ensures integer — Prisma Int? field rejects floats
      score: typeof s.score === 'number' ? Math.round(Math.min(100, Math.max(0, s.score))) : null,
      scoreDetails: {
        skillsMatch:     Math.round(s.skillsMatch || 0),
        roleMatch:       Math.round(s.roleMatch || 0),
        experienceMatch: Math.round(s.experienceMatch || 0),
        locationMatch:   Math.round(s.locationMatch || 0),
        strengths:       Array.isArray(s.strengths) ? s.strengths : [],
        gaps:            Array.isArray(s.gaps) ? s.gaps : [],
        summary:         s.summary || '',
      },
    };
    if (onProgress) onProgress(scored, offset + i);
    return scored;
  });
}

export async function scoreJobs(jobs, profile, onProgress, provider = 'groq') {
  console.log(`[jobScoring] Using provider: ${provider}, jobs: ${jobs.length}`);

  // Try all jobs in one call for relative comparison
  try {
    const results = await scoreJobsBatch(jobs, profile, provider, onProgress, 0);
    return results.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  } catch (err) {
    console.warn(`[jobScoring:${provider}] Single-batch failed, retrying in chunks of 10:`, err.message);
  }

  // Fallback: score each chunk independently — a failed chunk gets null scores,
  // but successfully scored chunks are preserved (not thrown away).
  const CHUNK = 5;
  const all = [];
  for (let i = 0; i < jobs.length; i += CHUNK) {
    const chunk = jobs.slice(i, i + CHUNK);
    try {
      const scored = await scoreJobsBatch(chunk, profile, provider, onProgress, i);
      all.push(...scored);
    } catch (err) {
      console.error(`[jobScoring:${provider}] Chunk ${i}–${i + chunk.length - 1} failed — those jobs unscored:`, err.message);
      chunk.forEach((job, j) => {
        const scored = { ...job, score: null, scoreDetails: null };
        if (onProgress) onProgress(scored, i + j);
        all.push(scored);
      });
    }
  }
  return all.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
}
