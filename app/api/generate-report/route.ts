import OpenAI from "openai"

const MODEL = "gpt-4o-mini"

export async function POST(req: Request) {
  try {
    const { prompt, title, subtitle } = (await req.json()) as {
      prompt?: string
      title?: string
      subtitle?: string
    }

    if (!prompt) {
      return Response.json({ error: "prompt is required" }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return Response.json({ error: "OPENAI_API_KEY is not configured" }, { status: 400 })
    }

    const client = new OpenAI({ apiKey })
    const system = [
      "You generate professional report content based on a user prompt.",
      "Return plain text only. No markdown fences.",
      "Use headings and body text in a structured way (short headings, then paragraphs).",
      "Do not include the title or subtitle unless the prompt explicitly asks.",
    ].join(" ")

    const userPayload = {
      prompt,
      title: title ?? "",
      subtitle: subtitle ?? "",
    }

    const response = await client.responses.create({
      model: MODEL,
      input: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(userPayload) },
      ],
    })

    const content = response.output_text?.trim() ?? ""
    if (!content) {
      return Response.json({ error: "No content generated" }, { status: 500 })
    }

    return Response.json({ content })
  } catch (error) {
    return Response.json({ error: "generation_failed" }, { status: 500 })
  }
}
