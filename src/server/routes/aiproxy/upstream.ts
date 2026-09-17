/**
 * Upstream AI Caller for Gemini, OpenAI, Anthropic, and DeepSeek
 */

export function isMockApiKey(key: string | null | undefined): boolean {
  return Boolean(key && (key.startsWith("sk-test") || key.startsWith("mock")));
}

/**
 * Panggil upstream AI non-streaming untuk semua provider yang didukung.
 * Mengembalikan teks completion mentah dari provider.
 */
export async function callUpstreamNonStreaming(
  provider: string,
  model: string,
  apiKey: string,
  promptText: string
): Promise<string> {
  if (provider === "gemini") {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] }),
      }
    );
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini upstream error ${res.status}: ${errText.slice(0, 300)}`);
    }
    const data = (await res.json()) as any;
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }

  if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: promptText }],
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI upstream error ${res.status}: ${errText.slice(0, 300)}`);
    }
    const data = (await res.json()) as any;
    return data.choices?.[0]?.message?.content || "";
  }

  if (provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: model || "claude-3-5-haiku-latest",
        max_tokens: 2048,
        messages: [{ role: "user", content: promptText }],
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Anthropic upstream error ${res.status}: ${errText.slice(0, 300)}`);
    }
    const data = (await res.json()) as any;
    return (data.content || []).map((b: any) => b?.text || "").join("");
  }

  if (provider === "deepseek") {
    // DeepSeek kompatibel dengan OpenAI Chat Completions API
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || "deepseek-chat",
        messages: [{ role: "user", content: promptText }],
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`DeepSeek upstream error ${res.status}: ${errText.slice(0, 300)}`);
    }
    const data = (await res.json()) as any;
    return data.choices?.[0]?.message?.content || "";
  }

  throw new Error(
    `Provider "${provider}" tidak didukung. Gunakan: gemini, openai, anthropic, atau deepseek.`
  );
}

/**
 * Panggil upstream AI streaming (SSE) untuk semua provider yang didukung.
 * Mengembalikan array potongan teks hasil parse event stream provider.
 */
export async function callUpstreamStreamingChunks(
  provider: string,
  model: string,
  apiKey: string,
  promptText: string
): Promise<string[]> {
  if (provider === "gemini") {
    // Gemini streaming via alt=sse
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] }),
      }
    );
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini upstream error ${res.status}: ${errText.slice(0, 300)}`);
    }
    return parseSseDataLines(res, (json) => json?.candidates?.[0]?.content?.parts?.[0]?.text);
  }

  if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: promptText }],
        stream: true,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI upstream error ${res.status}: ${errText.slice(0, 300)}`);
    }
    return parseSseDataLines(res, (json) => json?.choices?.[0]?.delta?.content);
  }

  if (provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: model || "claude-3-5-haiku-latest",
        max_tokens: 2048,
        messages: [{ role: "user", content: promptText }],
        stream: true,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Anthropic upstream error ${res.status}: ${errText.slice(0, 300)}`);
    }
    return parseSseDataLines(res, (json) =>
      json?.type === "content_block_delta" ? json?.delta?.text : undefined
    );
  }

  if (provider === "deepseek") {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || "deepseek-chat",
        messages: [{ role: "user", content: promptText }],
        stream: true,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`DeepSeek upstream error ${res.status}: ${errText.slice(0, 300)}`);
    }
    return parseSseDataLines(res, (json) => json?.choices?.[0]?.delta?.content);
  }

  throw new Error(
    `Provider "${provider}" tidak didukung. Gunakan: gemini, openai, anthropic, atau deepseek.`
  );
}

/**
 * Parse respons SSE upstream: kumpulkan potongan teks dari setiap event
 * `data: {...}` memakai extractor yang dispesifikan per provider.
 */
export async function parseSseDataLines(
  res: Response,
  extract: (json: any) => string | undefined
): Promise<string[]> {
  const chunks: string[] = [];
  if (!res.body) return chunks;

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const text = extract(JSON.parse(payload));
        if (text) chunks.push(text);
      } catch {
        // Event non-JSON diabaikan
      }
    }
  }

  return chunks;
}
