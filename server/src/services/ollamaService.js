export const OLLAMA_BASE_URL = 'https://bahadur3093-ollama-server.hf.space';
const TEXT_MODEL   = 'llama3.2:3b';
const VISION_MODEL = 'llava';

/**
 * Call the Ollama /api/generate endpoint.
 *
 * @param {string} prompt            - The text prompt
 * @param {object} [opts]
 * @param {string} [opts.imageBase64] - Base-64 encoded image (images only, NOT PDFs)
 * @param {string} [opts.mimeType]    - MIME type of the file (e.g. image/jpeg)
 */
export async function ollamaGenerate(prompt, opts = {}) {
  const { imageBase64, mimeType, model: modelOverride } = opts;

  if (mimeType === 'application/pdf') {
    throw new Error(
      'PDF parsing is not supported by Ollama. Please switch to Gemini for PDF files.'
    );
  }

  const isImage = imageBase64 && mimeType && mimeType.startsWith('image/');
  const model   = modelOverride || (isImage ? VISION_MODEL : TEXT_MODEL);

  const body = { model, prompt, stream: false };
  if (isImage) body.images = [imageBase64];

  const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`Ollama error ${response.status}: ${text}`);
  }

  const data = await response.json();
  return data.response;
}

/**
 * Multi-turn chat via the Ollama /api/chat endpoint.
 *
 * @param {Array<{role: 'system'|'user'|'assistant', content: string}>} messages
 * @param {string} [model] - override the default text model
 * @returns {Promise<string>} assistant reply text
 */
export async function ollamaChat(messages, model = TEXT_MODEL) {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ model, messages, stream: false }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`Ollama chat error ${response.status}: ${text}`);
  }

  const data = await response.json();
  return data.message?.content ?? '';
}
