const input = $input.first().json;
const user = $('Read User State').first();

let currentStr = user.json.District || '';
if (currentStr === 'confirm_districts') currentStr = ''; // Очищаємо, якщо залишився старий системний стан
let selected = currentStr ? currentStr.split(',').filter(d => d.trim() !== '') : [];

if (input.action === 'toggle_district') {
  let clicked = input.callbackData.replace('district_', '');
  
  if (clicked === 'any') {
    selected = ['any'];
  } else {
    selected = selected.filter(d => d !== 'any'); // Знімаємо 'any', якщо вибрали конкретний
    
    if (selected.includes(clicked)) {
      selected = selected.filter(d => d !== clicked);
    } else {
      selected.push(clicked);
    }
  }
}

let newDistrictStr = selected.join(',');

// Будуємо клавіатуру
const districts = [
    "Bemowo", "Białołęka", "Bielany", "Mokotów", 
    "Ochota", "Praga-Południe", "Praga-Północ", "Rembertów",
    "Śródmieście", "Targówek", "Ursus", "Ursynów",
    "Wawer", "Wesoła", "Wilanów", "Włochy", "Wola", "Żoliborz"
];

let buttons = [];
let row = [];

for (let i = 0; i < districts.length; i++) {
    let rawName = districts[i];
    let safeName = rawName.toLowerCase();
    
    let text = rawName;
    if (selected.includes(safeName)) {
        text = "✅ " + rawName;
    }
    
    row.push({ text: text, callback_data: "district_" + safeName });
    
    if (row.length === 2) {
        buttons.push(row);
        row = [];
    }
}
if (row.length > 0) {
    buttons.push(row);
}

// Кнопка "Будь-який район"
let anyText = "Будь-який район (вся Варшава)";
if (selected.includes('any')) {
    anyText = "✅ " + anyText;
}
buttons.push([{ text: anyText, callback_data: "district_any" }]);

// Якщо щось вибрано - показуємо кнопку "Підтвердити"
if (selected.length > 0) {
    buttons.push([{ text: `✅ Підтвердити (${selected.length})`, callback_data: "confirm_districts" }]);
}

return {
  json: {
    chatId: input.chatId,
    messageId: input.messageId,
    action: input.action,
    newDistrictStr: newDistrictStr,
    replyMarkup: {
      inline_keyboard: buttons
    }
  }
};
