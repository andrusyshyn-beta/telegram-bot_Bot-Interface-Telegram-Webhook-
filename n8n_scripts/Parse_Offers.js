const results = [];
const allInputs = $input.all();
const activeUsers = $('Filter Active').all();
const sentItems = $('Read Sent Items').all();

for (let i = 0; i < allInputs.length; i++) {
  const user = activeUsers[i].json;
  const offers = allInputs[i].json.data || [];
  
  const userDistrictStr = user.District || 'any';
  const userDistricts = userDistrictStr === 'district_any' || userDistrictStr === 'any' 
    ? [] 
    : userDistrictStr.split(',').map(d => d.trim().toLowerCase()).filter(d => d);

  for (const offer of offers) {
    // БРОНЯ ВІД ДУБЛІКАТІВ
    const alreadySent = sentItems.find(i => String(i.json['Item ID']) === String(offer.id) && String(i.json['Telegram ID']) === String(user['Telegram ID']));
    const alreadyInQueue = results.find(r => String(r.json['Item ID']) === String(offer.id) && String(r.json['Telegram ID']) === String(user['Telegram ID']));
    
    if (alreadySent || alreadyInQueue) continue;

    // ВАША ОРИГІНАЛЬНА ПОТУЖНА ЛОГІКА ФІЛЬТРАЦІЇ
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
}

return results;
