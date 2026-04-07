import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSession } from "@/lib/auth";
import { getEmailById } from "@/lib/queries";

const anthropic = new Anthropic();

type EmailAction = "reply" | "confirm-interview" | "decline" | "draft";

function buildPrompt(
  action: EmailAction,
  email: Record<string, unknown>,
  customMessage?: string
): string {
  const fromName = (email.from_name as string) || "there";
  const subject = (email.subject as string) || "(no subject)";
  const classification = (email.classification as string) || "";

  const base = `You are writing a professional email reply in UK English on behalf of a job applicant. Keep the tone warm but professional. Be concise — no more than 150 words. Do not include a subject line. Do not include email headers. Just write the body text.

Original email details:
- From: ${fromName}
- Subject: ${subject}
- Classification: ${classification}
`;

  switch (action) {
    case "confirm-interview":
      return `${base}
Write a reply confirming an interview invitation. Confirm the date/time mentioned in the subject or context. Express genuine enthusiasm for the opportunity. Ask if there are any preparation materials or specific topics to review beforehand. Sign off with the applicant's first name only.`;

    case "decline":
      return `${base}
Write a polite decline reply. Thank them for considering you. Briefly mention that you've decided to pursue other opportunities at this time. Leave the door open for future contact. Sign off with the applicant's first name only.`;

    case "reply":
      return `${base}
Write a professional reply based on this guidance from the applicant: "${customMessage || "Thank you, I'd like to discuss further."}"
Sign off with the applicant's first name only.`;

    case "draft":
      return `${base}
Write a general professional reply acknowledging their email. Sign off with the applicant's first name only.`;
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { action: EmailAction; emailId: string; customMessage?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { action, emailId, customMessage } = body;

  if (!action || !emailId) {
    return NextResponse.json(
      { error: "action and emailId are required" },
      { status: 400 }
    );
  }

  const validActions: EmailAction[] = [
    "reply",
    "confirm-interview",
    "decline",
    "draft",
  ];
  if (!validActions.includes(action)) {
    return NextResponse.json(
      { error: `Invalid action. Must be one of: ${validActions.join(", ")}` },
      { status: 400 }
    );
  }

  // Fetch the email from DB
  const email = await getEmailById(session.tenantId, emailId);
  if (!email) {
    return NextResponse.json({ error: "Email not found" }, { status: 404 });
  }

  // Generate reply with Claude Haiku
  const prompt = buildPrompt(action, email, customMessage);

  try {
    const message = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    const draft = textBlock?.text ?? "";

    return NextResponse.json({ draft, emailId, action });
  } catch (error) {
    console.error("Claude API error:", error);
    return NextResponse.json(
      { error: "Failed to generate reply" },
      { status: 500 }
    );
  }
}

// Send endpoint — separate from draft generation
export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { emailId: string; replyContent: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { emailId, replyContent } = body;

  if (!emailId || !replyContent) {
    return NextResponse.json(
      { error: "emailId and replyContent are required" },
      { status: 400 }
    );
  }

  const email = await getEmailById(session.tenantId, emailId);
  if (!email) {
    return NextResponse.json({ error: "Email not found" }, { status: 404 });
  }

  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json(
      { error: "N8N_WEBHOOK_URL not configured" },
      { status: 503 }
    );
  }

  try {
    const resp = await fetch(webhookUrl + "/email-action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "send-reply",
        tenantId: session.tenantId,
        emailId,
        replyContent,
        originalEmailId: email.id,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("n8n webhook error:", resp.status, errText);
      return NextResponse.json(
        { error: "Failed to send via n8n" },
        { status: 502 }
      );
    }

    return NextResponse.json({ sent: true, emailId });
  } catch (error) {
    console.error("n8n webhook fetch error:", error);
    return NextResponse.json(
      { error: "Failed to reach n8n webhook" },
      { status: 502 }
    );
  }
}
