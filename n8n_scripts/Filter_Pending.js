const sentItems = $('Read Sent Items1').all();
const users = $('Read Active Users1').all();

// 1. Збираємо всі ID квартир, які ВЖЕ мають статус Sent
const alreadySentItemIds = new Set(
  sentItems
    .filter(i => i.json.Status === 'Sent')
    .map(i => String(i.json['Item ID']))
);

// 2. Ігноруємо дублікати Pending, якщо така квартира вже відправлялася
const pendingItems = sentItems.filter(i => 
  i.json.Status === 'Pending' && 
  !alreadySentItemIds.has(String(i.json['Item ID']))
);

if (pendingItems.length === 0) return [];

// 3. Автоматична дедуплікація користувачів за Telegram ID
const uniqueUsersMap = new Map();
for (const u of users) {
  const tid = String(u.json['Telegram ID']);
  if (tid && tid !== 'undefined') {
    uniqueUsersMap.set(tid, u);
  }
}

const itemsToSend = [];
const processedItemIdsInThisBatch = new Set();

for (const [telegramId, user] of uniqueUsersMap.entries()) {
  const userPending = pendingItems.filter(i => 
    String(i.json['Telegram ID']) === telegramId && 
    !processedItemIdsInThisBatch.has(String(i.json['Item ID']))
  );
  
  if (userPending.length > 0) {
    const item = userPending[0];
    processedItemIdsInThisBatch.add(String(item.json['Item ID']));
    
    try {
      const payloadData = JSON.parse(item.json.Payload);
      payloadData.row_number = item.json.row_number;
      payloadData.id = item.json['Item ID'] || payloadData.id;
      
      itemsToSend.push({
        json: payloadData
      });
    } catch (e) {
      // ignore
    }
  }
}

return itemsToSend;
