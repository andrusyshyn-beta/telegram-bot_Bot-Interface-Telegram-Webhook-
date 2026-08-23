const sentItems = $('Read Sent Items1').all();
const users = $('Read Active Users1').all();

const pendingItems = sentItems.filter(i => i.json.Status === 'Pending');
if (pendingItems.length === 0) return [];

const uniqueUsersMap = new Map();
for (const u of users) {
  const tid = String(u.json['Telegram ID']);
  if (tid && tid !== 'undefined') {
    uniqueUsersMap.set(tid, u);
  }
}

const itemsToSend = [];

for (const [telegramId, user] of uniqueUsersMap.entries()) {
  const userPending = pendingItems.filter(i => String(i.json['Telegram ID']) === telegramId);
  
  // Беремо накопичені квартири для цього користувача за цей запуск (до 5 шт)
  const batch = userPending.slice(0, 5);
  
  for (const item of batch) {
    try {
      const payloadData = JSON.parse(item.json.Payload);
      payloadData.row_number = item.json.row_number;
      payloadData.id = item.json['Item ID'] || payloadData.id;
      
      // СУВОРЕ ЗВ'ЯЗУВАННЯ З ЗНАЧЕННЯМ СТОВПЧИКА 'Telegram ID':
      payloadData.chatId = telegramId;
      if (user.json['Admin Topic ID']) {
        payloadData.adminTopicId = user.json['Admin Topic ID'];
      }
      
      itemsToSend.push({
        json: payloadData
      });
    } catch (e) {
      // ignore
    }
  }
}

return itemsToSend;
