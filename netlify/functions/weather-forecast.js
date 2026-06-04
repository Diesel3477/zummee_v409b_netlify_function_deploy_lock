// Zummee Weather Forecast Proxy — v774
// Server-side weather proxy with safe fallback responses.
// Goals:
// - Keep browser code off third-party APIs.
// - Avoid CORS failures.
// - Avoid Weather Hub breaking when a third-party API returns 5xx.
// - Return a usable model even during upstream outages.

const https = require('https');

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'public, max-age=300, s-maxage=600'
};

const ZIP_COORDS = {
  // Atlanta / north-metro defaults used by current Zummee test communities.
  '30303': { lat: 33.7529, lon: -84.3880, place: 'Atlanta, GA' },
  '30305': { lat: 33.8317, lon: -84.3857, place: 'Atlanta, GA' },
  '30306': { lat: 33.7869, lon: -84.3515, place: 'Atlanta, GA' },
  '30307': { lat: 33.7693, lon: -84.3360, place: 'Atlanta, GA' },
  '30308': { lat: 33.7718, lon: -84.3757, place: 'Atlanta, GA' },
  '30309': { lat: 33.7984, lon: -84.3883, place: 'Atlanta, GA' },
  '30318': { lat: 33.7865, lon: -84.4454, place: 'Atlanta, GA' },
  '30324': { lat: 33.8191, lon: -84.3549, place: 'Atlanta, GA' },
  '30326': { lat: 33.8497, lon: -84.3600, place: 'Atlanta, GA' },
  '30327': { lat: 33.8680, lon: -84.4190, place: 'Atlanta, GA' },
  '30328': { lat: 33.9360, lon: -84.3774, place: 'Sandy Springs, GA' },
  '30339': { lat: 33.8714, lon: -84.4635, place: 'Atlanta, GA' },
  '30004': { lat: 34.1438, lon: -84.3009, place: 'Alpharetta, GA' },
  '30022': { lat: 34.0268, lon: -84.2422, place: 'Alpharetta, GA' },
  '30024': { lat: 34.0479, lon: -84.0957, place: 'Suwanee, GA' },
  '30040': { lat: 34.2212, lon: -84.1488, place: 'Cumming, GA' },
  '30041': { lat: 34.1901, lon: -84.0907, place: 'Cumming, GA' },
  '30062': { lat: 34.0020, lon: -84.4635, place: 'Marietta, GA' },
  '30066': { lat: 34.0385, lon: -84.5038, place: 'Marietta, GA' },
  '30114': { lat: 34.2385, lon: -84.4891, place: 'Canton, GA' },
  '30115': { lat: 34.2147, lon: -84.4238, place: 'Canton, GA' },
  '30188': { lat: 34.1177, lon: -84.5096, place: 'Woodstock, GA' },
  '30189': { lat: 34.1283, lon: -84.5711, place: 'Woodstock, GA' },
  '30101': { lat: 34.0754, lon: -84.6477, place: 'Acworth, GA' },
  '30102': { lat: 34.0897, lon: -84.6044, place: 'Acworth, GA' }
};

function json(statusCode, body){
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) };
}

function digitsZip(value){
  return String(value || '').replace(/\D+/g, '').slice(0, 5);
}

function toNumber(value, fallback = 0){
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function miles(meters){
  const n = toNumber(meters, 0);
  if(!n) return '--';
  return Math.max(0, Math.round((n / 1609.344) * 10) / 10);
}

function httpsJson(url, timeoutMs = 6500){
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      timeout: timeoutMs,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'ZummeeWeatherProxy/1.1 (+https://zummee.net)'
      }
    }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        if(res.statusCode < 200 || res.statusCode >= 300){
          const e = new Error('upstream-status-' + res.statusCode);
          e.status = res.statusCode;
          e.body = raw.slice(0, 300);
          reject(e);
          return;
        }
        try{ resolve(JSON.parse(raw)); }
        catch(parseErr){
          parseErr.status = res.statusCode;
          parseErr.body = raw.slice(0, 300);
          reject(parseErr);
        }
      });
    });
    req.on('timeout', () => {
      req.destroy(new Error('upstream-timeout'));
    });
    req.on('error', reject);
  });
}

async function resolveZip(zip){
  if(ZIP_COORDS[zip]) return ZIP_COORDS[zip];
  try{
    const locJson = await httpsJson(`https://api.zippopotam.us/us/${encodeURIComponent(zip)}`, 5000);
    const place = (locJson.places && locJson.places[0]) || {};
    const lat = Number(place.latitude);
    const lon = Number(place.longitude);
    if(Number.isFinite(lat) && Number.isFinite(lon)){
      return {
        lat,
        lon,
        place: [place['place name'], place['state abbreviation']].filter(Boolean).join(', ') || `ZIP ${zip}`
      };
    }
  }catch(err){
    return { lat: 33.7488, lon: -84.3883, place: `ZIP ${zip}`, degraded: true, zipLookupError: String(err && err.message || err) };
  }
  return { lat: 33.7488, lon: -84.3883, place: `ZIP ${zip}`, degraded: true, zipLookupError: 'coordinates-unavailable' };
}

function weatherCodeSummary(code){
  code = Number(code || 0);
  if(code === 0) return 'Clear skies';
  if([1,2].includes(code)) return 'Partly cloudy';
  if(code === 3) return 'Cloudy';
  if([45,48].includes(code)) return 'Foggy';
  if([51,53,55,56,57].includes(code)) return 'Drizzle';
  if([61,63,65,66,67,80,81,82].includes(code)) return 'Rain likely';
  if([71,73,75,77,85,86].includes(code)) return 'Snow likely';
  if([95,96,99].includes(code)) return 'Thunderstorms possible';
  return 'Weather update';
}

function weatherCodeShort(code){
  code = Number(code || 0);
  if(code === 0) return 'Clear';
  if([1,2].includes(code)) return 'Partly cloudy';
  if(code === 3) return 'Cloudy';
  if([45,48].includes(code)) return 'Fog';
  if([51,53,55,56,57].includes(code)) return 'Drizzle';
  if([61,63,65,66,67,80,81,82].includes(code)) return 'Rain';
  if([71,73,75,77,85,86].includes(code)) return 'Snow';
  if([95,96,99].includes(code)) return 'Storms';
  return 'Forecast';
}

function evaluateWeatherRisk(base){
  const code = Number(base.weatherCode || 0);
  const rain = Number(base.rainChance || 0);
  const wind = Number(base.windMph || 0);
  const gust = Number(base.gustMph || 0);
  if([95,96,99].includes(code) || gust >= 45 || wind >= 35) return { level:'high', text:'High risk' };
  if(rain >= 70 || gust >= 30 || wind >= 24 || [61,63,65,80,81,82].includes(code)) return { level:'moderate', text:'Moderate risk' };
  return { level:'low', text:'Low risk' };
}

function fallbackModel(zip, communityName, placeLabel, message){
  const locationLabel = communityName ? `${communityName}${placeLabel ? ' • ' + placeLabel : ''}` : (placeLabel || `ZIP ${zip}`);
  return {
    zip,
    communityName,
    locationLabel,
    tempDisplay: '--',
    feelsLikeDisplay: '--',
    rainChanceDisplay: '--',
    windDisplay: '--',
    humidityDisplay: '--',
    visibilityDisplay: '--',
    summary: message || 'Forecast temporarily unavailable',
    sunrise: '',
    sunset: '',
    weatherCode: 0,
    rainChance: 0,
    windMph: 0,
    gustMph: 0,
    risk: { level:'low', text:'Low risk' },
    nowSub: 'Unavailable',
    laterLabel: 'Later',
    laterTempDisplay: '--',
    laterSub: 'Unavailable',
    tonightTempDisplay: '--',
    tonightSub: 'Unavailable',
    degraded: true
  };
}

exports.handler = async function(event){
  if(event.httpMethod === 'OPTIONS') return { statusCode:204, headers:JSON_HEADERS, body:'' };
  if(event.httpMethod !== 'GET') return json(405, { ok:false, error:'method-not-allowed' });

  const params = event.queryStringParameters || {};
  const zip = digitsZip(params.zip);
  const communityName = String(params.community || '').trim();
  if(zip.length !== 5) return json(400, { ok:false, error:'invalid-zip' });

  const loc = await resolveZip(zip);

  try{
    const weatherUrl = 'https://api.open-meteo.com/v1/forecast?' + new URLSearchParams({
      latitude: String(loc.lat),
      longitude: String(loc.lon),
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m,visibility',
      hourly: 'temperature_2m,precipitation_probability,weather_code',
      daily: 'sunrise,sunset,temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code',
      forecast_days: '2',
      temperature_unit: 'fahrenheit',
      wind_speed_unit: 'mph',
      precipitation_unit: 'inch',
      timezone: 'auto'
    }).toString();

    const wx = await httpsJson(weatherUrl, 7000);
    const current = wx.current || {};
    const hourly = wx.hourly || {};
    const times = hourly.time || [];
    const temps = hourly.temperature_2m || [];
    const probs = hourly.precipitation_probability || [];
    const codes = hourly.weather_code || [];
    const idxLater = Math.min(4, Math.max(1, times.length - 1));
    const idxTonight = Math.min(11, Math.max(0, times.length - 1));
    const baseRain = toNumber((wx.daily && wx.daily.precipitation_probability_max && wx.daily.precipitation_probability_max[0]) || probs[0] || 0, 0);
    const risk = evaluateWeatherRisk({
      weatherCode: toNumber(current.weather_code, 0),
      rainChance: baseRain,
      windMph: toNumber(current.wind_speed_10m, 0),
      gustMph: toNumber(current.wind_gusts_10m, 0)
    });
    const locationLabel = communityName ? `${communityName}${loc.place ? ' • ' + loc.place : ''}` : (loc.place || `ZIP ${zip}`);
    const model = {
      zip,
      communityName,
      locationLabel,
      tempDisplay: `${Math.round(toNumber(current.temperature_2m, 0))}°`,
      feelsLikeDisplay: `${Math.round(toNumber(current.apparent_temperature || current.temperature_2m, 0))}°`,
      rainChanceDisplay: `${Math.round(baseRain)}%`,
      windDisplay: `${Math.round(toNumber(current.wind_speed_10m, 0))} mph`,
      humidityDisplay: `${Math.round(toNumber(current.relative_humidity_2m, 0))}%`,
      visibilityDisplay: `${miles(current.visibility)} mi`,
      summary: weatherCodeSummary(current.weather_code || 0),
      sunrise: (wx.daily && wx.daily.sunrise && wx.daily.sunrise[0]) ? String(wx.daily.sunrise[0]).split('T')[1].slice(0,5) : '',
      sunset: (wx.daily && wx.daily.sunset && wx.daily.sunset[0]) ? String(wx.daily.sunset[0]).split('T')[1].slice(0,5) : '',
      weatherCode: toNumber(current.weather_code, 0),
      rainChance: baseRain,
      windMph: toNumber(current.wind_speed_10m, 0),
      gustMph: toNumber(current.wind_gusts_10m, 0),
      risk,
      nowSub: weatherCodeShort(current.weather_code || 0),
      laterLabel: (times[idxLater] ? new Date(times[idxLater]).toLocaleTimeString([], { hour:'numeric' }) : 'Later').replace(':00',''),
      laterTempDisplay: temps[idxLater] != null ? `${Math.round(toNumber(temps[idxLater], 0))}°` : '--',
      laterSub: weatherCodeShort(codes[idxLater] || current.weather_code || 0),
      tonightTempDisplay: temps[idxTonight] != null ? `${Math.round(toNumber(temps[idxTonight], 0))}°` : '--',
      tonightSub: weatherCodeShort(codes[idxTonight] || current.weather_code || 0),
      degraded: !!loc.degraded
    };
    return json(200, { ok:true, source:'zummee-weather-proxy-v774', model, diagnostics:{ zip, coords:{ lat:loc.lat, lon:loc.lon }, place:loc.place, degraded:!!loc.degraded } });
  }catch(err){
    // Do not break the Manager Hub just because the upstream weather API is unavailable.
    const message = String(err && err.message || err);
    return json(200, {
      ok:true,
      source:'zummee-weather-proxy-v774-fallback',
      degraded:true,
      upstreamError: message,
      model: fallbackModel(zip, communityName, loc.place || `ZIP ${zip}`, 'Forecast temporarily unavailable'),
      diagnostics:{ zip, coords:{ lat:loc.lat, lon:loc.lon }, place:loc.place, degraded:true, upstreamError:message }
    });
  }
};

