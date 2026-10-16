export interface ContactMessage {
  name: string;
  email: string;
  subject: string;
  message: string;
}
export function parseContactMessage(body: unknown): ContactMessage {
  if (!body || typeof body !== "object") throw new Error("Invalid message");
  const values = body as Record<string, unknown>;
  const result = {} as ContactMessage;
  for (const key of ["name", "email", "subject", "message"] as const) {
    if (typeof values[key] !== "string" || !values[key].trim())
      throw new Error("Missing field");
    result[key] = values[key].trim();
  }
  if (
    result.name.length > 200 ||
    result.email.length > 254 ||
    result.subject.length > 300 ||
    result.message.length > 20000
  )
    throw new Error("Message is too long");
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email) ||
    /[\r\n]/.test(result.subject + result.name)
  )
    throw new Error("Invalid message headers");
  return result;
}
export function contactMessageText(value: ContactMessage) {
  return `이름: ${value.name}\n이메일: ${value.email}\n제목: ${value.subject}\n\n${value.message}`;
}
