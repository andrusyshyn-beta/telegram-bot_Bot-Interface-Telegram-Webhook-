const results = [];
const allInputs = $input.all();
const activeUsers = $('Filter Active').all();
const sentItems = $('Read Sent Items').all();

for (let i = 0; i < allInputs.length; i++) {
  const inputItem = allInputs[i];
  
  // 1. ВИЗНАЧАЄМО КОРИСТУВАЧА ЗА TG_ID З URL
  let user = null;
  let tgIdFromUrl = null;
  
  try {
    const reqUrl = inputItem.json.url || (inputItem.json.metadata ? inputItem.json.metadata.url : '') || '';
    const match = reqUrl.match(/tg_id=(\d+)/);
    if (match && match[1]) {
      tgIdFromUrl = match[1];
    }
  } catch (e) {}

  if (tgIdFromUrl) {
    const matchedUser = activeUsers.find(u => String(u.json['Telegram ID']) === String(tgIdFromUrl));
    if (matchedUser) {
      user = matchedUser.json;
    }
  }

  if (!user) {
    if (inputItem.pairedItem) {
      const pairedIndex = Array.isArray(inputItem.pairedItem) ? inputItem.pairedItem[0]?.item : inputItem.pairedItem.item;
      if (pairedIndex !== undefined && activeUsers[pairedIndex]) {
        user = activeUsers[pairedIndex].json;
      }
    }
  }

  if (!user) {
    user = activeUsers[i] ? activeUsers[i].json : null;
  }

  if (!user || !user['Telegram ID']) continue;

  const offers = inputItem.json.data || [];
  const userState = user.State || 'active';
  const isFirstRunPhase = (userState === 'first_run_1' || userState === 'first_run_2' || userState === 'first_run');
  
  const userDistrictStr = user.District || 'any';
  const userDistricts = userDistrictStr === 'district_any' || userDistrictStr === 'any' 
    ? [] 
    : userDistrictStr.split(',').map(d => d.trim().toLowerCase()).filter(d => d);

  let hasNewOffersForFirstRun = false;

  for (const offer of offers) {
    // БРОНЯ ВІД ДУБЛІКАТІВ
    const alreadySent = sentItems.find(si => String(si.json['Item ID']) === String(offer.id) && String(si.json['Telegram ID']) === String(user['Telegram ID']));
    const alreadyInQueue = results.find(r => String(r.json['Item ID']) === String(offer.id) && String(r.json['Telegram ID']) === String(user['Telegram ID']));
    
    if (alreadySent || alreadyInQueue) continue;

    // ФІЛЬТРАЦІЯ OTODOM І БІЗНЕСУ
    if (offer.url && offer.url.includes('otodom')) continue;
    if (offer.external_url && offer.external_url.includes('otodom')) continue;
    if (offer.partner && offer.partner.code && offer.partner.code.includes('otodom')) continue;

    const isBusinessUser = offer.user && (offer.user.business || offer.user.is_business || offer.user.company_name);
    if (isBusinessUser) continue;

    const distName = (offer.location?.district?.name || '').toLowerCase();
    
    if (userDistricts.length > 0) {
      const isMatch = userDistricts.some(d => distName.includes(d));
      if (!isMatch) continue;
    }
    
    let area = '', floor = '', rent = '', deposit = '', priceStr = '';
    let parsedPrice = 0, parsedRent = 0;
    let isAgencyParam = false;
    
    for (const p of offer.params || []) {
      if (p.key === 'm') area = p.value?.label;
      if (p.key === 'floor_select') floor = p.value?.label;
      if (p.key === 'deposit') deposit = p.value?.label;
      
      if (p.key === 'private_business') {
        const val = p.value || {};
        if (val.key === 'business' || String(val.label).includes('Firm') || String(val.label).includes('Biuro')) {
          isAgencyParam = true;
        }
      }
      
      if (p.key === 'rent') {
        rent = p.value?.label;
        if (p.value?.key) {
          parsedRent = parseFloat(String(p.value.key).replace(/\s/g, '').replace(',', '.'));
        } else if (p.value?.label) {
          parsedRent = parseFloat(p.value.label.replace(/\s|zł|zl/gi, '').replace(',', '.'));
        }
        if (isNaN(parsedRent)) parsedRent = 0;
      }
      
      if (p.key === 'price') {
        priceStr = p.value?.label || p.value?.value;
        if (p.value?.value) {
          parsedPrice = parseFloat(p.value.value);
        } else if (p.value?.label) {
          parsedPrice = parseFloat(p.value.label.replace(/\s|zł|zl/gi, '').replace(',', '.'));
        }
        if (isNaN(parsedPrice)) parsedPrice = 0;
      }
    }
    
    if (isAgencyParam) continue;
    
    if (area) {
       let parsedArea = parseFloat(String(area).replace(/[^0-9,.]/g, '').replace(',', '.'));
       if (!isNaN(parsedArea)) {
         if (user['Min Area']) {
           const minArea = parseFloat(user['Min Area']);
           if (!isNaN(minArea) && parsedArea < minArea) continue;
         }
         if (user['Max Area']) {
           const maxArea = parseFloat(user['Max Area']);
           if (!isNaN(maxArea) && parsedArea > maxArea) continue;
         }
       }
    }
    
    const totalCost = parsedPrice + parsedRent;
    
    if (user['Max Price']) {
      const maxBudget = parseFloat(user['Max Price']);
      if (!isNaN(maxBudget)) {
        let minBudget = 4000;
        if (maxBudget > 6000) minBudget = maxBudget - 1500;
        if (totalCost < minBudget || totalCost > maxBudget) continue; 
      } else {
        if (totalCost < 4000) continue;
      }
    } else {
      if (totalCost < 4000) continue;
    }
    
    let hasOtodomPhotos = false;
    const photos = [];
    if (offer.photos && Array.isArray(offer.photos)) {
      for (const p of offer.photos) {
        const photoUrl = (p.link || '').toLowerCase();
        if (photoUrl.includes('otodom') || photoUrl.includes('uicdn') || photoUrl.includes('rfrcdn')) {
          hasOtodomPhotos = true;
          break; 
        }
        photos.push({ type: 'photo', media: p.link.replace('{width}', '800').replace('{height}', '600') });
      }
    }
    
    if (hasOtodomPhotos || photos.length === 0) continue;
    
    let userMsg = `🚪 ${user.Rooms || '?'} pokoje, ${area}\n`;
    if (priceStr) userMsg += `💰 Ціна оренди - ${priceStr}\n`;
    userMsg += `\n📍 Варшава, ${offer.location?.district?.name || ''}\n\n`;
    if (floor) userMsg += `🏢 Поверх : ${floor}\n`;
    if (deposit) userMsg += `💵 Кауція: ${deposit}\n`;
    if (rent) userMsg += `🧾 Чинш: ${rent}\n`;
    
    let adminMsg = `[СИСТЕМА] Відправлено ID: ${user['Telegram ID']}\n${userMsg}\n\n🔗 ${offer.url}`;
    
    const payloadObj = {
        id: offer.id,
        userMedia: JSON.stringify(photos.slice(0, 10)),
        adminMedia: JSON.stringify(photos.slice(0, 10)),
        userMsg: userMsg,
        adminMsg: adminMsg,
        chatId: user['Telegram ID'],
        adminTopicId: user['Admin Topic ID']
    };

    hasNewOffersForFirstRun = true;

    results.push({
      json: {
        'Telegram ID': user['Telegram ID'],
        'Item ID': offer.id,
        'Status': 'Pending',
        'message_type': 'apartment',
        'chatId': user['Telegram ID'], 
        'id': offer.id, 
        'Payload': JSON.stringify(payloadObj)
      }
    });
  }

  // ЯКЩО ЦЕ НОВИЙ КОРИСТУВАЧ (first_run / first_run_1 / first_run_2) -> КЕРУВАННЯ СТАНАМИ ТА ТРИГЕРОМ ВІДПРАВНИКА
  if (isFirstRunPhase) {
    let nextState = 'active';
    if (userState === 'first_run_1' || userState === 'first_run') {
      nextState = 'first_run_2'; // Після першого знаходження стан переходить у 2-й етап (на наступну годину)
    } else if (userState === 'first_run_2') {
      nextState = 'active'; // Через годину після 2-го знаходження переводимо в звичайний розклад активного
    }

    // 1. Оновлення стану в таблиці Users
    results.push({
      json: {
        message_type: 'upgrade_state',
        chatId: user['Telegram ID'],
        nextState: nextState,
        payload: ''
      }
    });

    // 2. Якщо були знайдені нові квартири для новенького -> МИТТЄВИЙ ВИКЛИК ВІДПРАВНИКА
    if (hasNewOffersForFirstRun) {
      results.push({
        json: {
          message_type: 'trigger_sender',
          chatId: user['Telegram ID'],
          payload: ''
        }
      });
    }
  }
}

return results;
