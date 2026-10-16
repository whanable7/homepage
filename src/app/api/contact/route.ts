import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { parseContactMessage, contactMessageText } from "@/lib/contact-message";

export async function POST(request: NextRequest) {
  let message;
  try {
    message = parseContactMessage(await request.json());
  } catch {
    return NextResponse.json(
      { error: "문의 내용을 확인해 주세요." },
      { status: 400 },
    );
  }
  const apiKey = process.env.RESEND_API_KEY?.trim(),
    to = process.env.CONTACT_TO_EMAIL?.trim();
  if (!apiKey || !to)
    return NextResponse.json(
      { error: "문의 메일을 보낼 수 없습니다. 이메일 주소로 직접 보내주세요." },
      { status: 503 },
    );
  try {
    const { error } = await new Resend(apiKey).emails.send({
      from:
        process.env.CONTACT_FROM_EMAIL?.trim() ||
        "Jungwhan Park <onboarding@resend.dev>",
      to,
      replyTo: message.email,
      subject: `[Website Contact] ${message.subject}`,
      text: contactMessageText(message),
    });
    if (error) {
      console.error("Contact delivery failed", {
        name: error.name,
        message: error.message
          .replaceAll(apiKey, "[redacted]")
          .replace(/re_[A-Za-z0-9_-]+/g, "[redacted]")
          .slice(0, 400),
      });
      return NextResponse.json(
        { error: "메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요." },
        { status: 502 },
      );
    }
    return NextResponse.json({ success: true });
  } catch {
    console.error("Contact delivery unavailable");
    return NextResponse.json(
      { error: "메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 502 },
    );
  }
}
