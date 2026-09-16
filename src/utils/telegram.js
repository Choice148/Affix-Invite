import dotenv from 'dotenv';
dotenv.config();

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Sends a developer monitoring event notification to Telegram.
 * Operates non-blockingly and fails gracefully if tokens/chats are unconfigured.
 */
export async function sendTelegramNotification(eventDetails) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.log(`[TELEGRAM MONITOR - LOCAL] ${eventDetails.title}`);
    if (eventDetails.lines) {
      eventDetails.lines.forEach((line) => console.log(`  ${line}`));
    }
    return false;
  }

  const messageLines = [`🔐 <b>AuthSwitch Demo</b>`, ``, `<b>Event:</b> ${escapeHtml(eventDetails.title)}`];

  if (eventDetails.lines) {
    eventDetails.lines.forEach((line) => {
      // Line is formatted like "*Key:* Value" or "Key: Value"
      const cleanLine = line.replace(/^\*(.*?)\*:\s*/, '<b>$1:</b> ');
      messageLines.push(cleanLine);
    });
  }

  const messageText = messageLines.join('\n');

  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: messageText,
        parse_mode: 'HTML',
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[TELEGRAM MONITOR] Warning: API returned ${response.status}: ${errText}`);
      return false;
    }
    return true;
  } catch (error) {
    console.warn(`[TELEGRAM MONITOR] Failed to send notification:`, error.message);
    return false;
  }
}
