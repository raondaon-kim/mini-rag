import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function* streamChat(
  systemPrompt: string,
  userMessage: string,
  model = "claude-haiku-4-5-20251001"
): AsyncGenerator<string, void, unknown> {
  const stream = await client.messages.create({
    model,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
    stream: true,
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      yield event.delta.text;
    }
  }
}
