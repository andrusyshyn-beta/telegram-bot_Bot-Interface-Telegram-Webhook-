const data = $input.first().json;
let chatId = '';
let text = '';
let callbackData = '';
let isCallback = false;
let messageId = null;

if (data.message) {
  chatId = String(data.message.chat.id);
  text = data.message.text || '';
} else if (data.callback_query) {
  isCallback = true;
  chatId = String(data.callback_query.message.chat.id);
  messageId = data.callback_query.message.message_id;
  callbackData = data.callback_query.data;
}

return { json: { chatId, text, callbackData, isCallback, messageId } };
