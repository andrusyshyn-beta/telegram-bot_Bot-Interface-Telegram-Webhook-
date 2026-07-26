const results = [];
const allOffers = $input.first().json.data || [];
const users = $('Filter Active').all();
const sentItems = $('Read Sent Items').all();
const sentIds = sentItems.map(i => i.json.OfferID);

const normalize = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/ł/g, "l");

for (const user of users) {
  const u = user.json;
  let targetDistricts = u.District ? u.District.split(',').map(s => s.trim().toLowerCase()) : [];
  
  for (const offer of allOffers) {
    if (sentIds.includes(offer.id)) continue;

    let passRooms = true;
    let passPrice = true;
    let passDistrict = false;

    // Check Price
    if (u['Max Price'] && offer.params) {
        let priceParam = offer.params.find(p => p.key === 'price');
        if (priceParam && priceParam.value && priceParam.value.value) {
            if (priceParam.value.value > parseInt(u['Max Price'])) {
                passPrice = false;
            }
        }
    }

    // Check District
    if (targetDistricts.length === 0 || targetDistricts.includes('any') || targetDistricts.includes('confirm_districts')) {
      passDistrict = true;
    } else if (offer.location && offer.location.district) {
      let dName = normalize(offer.location.district.name);
      passDistrict = targetDistricts.some(td => {
          let nTd = normalize(td);
          return dName.includes(nTd) || nTd.includes(dName);
      });
    }

    if (passRooms && passPrice && passDistrict) {
      results.push({ json: { ...offer, TargetUser: u } });
    }
  }
}
return results;
