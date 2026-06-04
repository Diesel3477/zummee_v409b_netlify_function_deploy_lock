// Zummee Weather Forecast Proxy — v773
// Keeps browser code off third-party weather APIs to avoid CORS/502 failures.

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'public, max-age=300, s-maxage=600'
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

exports.handler = async function(event){
  if(event.httpMethod === 'OPTIONS') return { statusCode:204, headers:JSON_HEADERS, body:'' };
  if(event.httpMethod !== 'GET') return json(405, { ok:false, error:'method-not-allowed' });

  try{
    const params = event.queryStringParameters || {};
    const zip = digitsZip(params.zip);
    const communityName = String(params.community || '').trim();
    if(zip.length !== 5) return json(400, { ok:false, error:'invalid-zip' });

    const locUrl = `https://api.zippopotam.us/us/${encodeURIComponent(zip)}`;
    const locRes = await fetch(locUrl, { headers:{ 'Accept':'application/json', 'User-Agent':'ZummeeWeatherProxy/1.0' } });
    if(!locRes.ok) return json(502, { ok:false, error:'zip-lookup-failed', status:locRes.status });
    const locJson = await locRes.json();
    const place = (locJson.places && locJson.places[0]) || {};
    const lat = Number(place.latitude);
    const lon = Number(place.longitude);
    if(!Number.isFinite(lat) || !Number.isFinite(lon)) return json(502, { ok:false, error:'weather-coordinates-unavailable' });

    const weatherUrl = 'https://api.open-meteo.com/v1/forecast?' + new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m,visibility',
      hourly: 'temperature_2m,precipitation_probability,weather_code',
      daily: 'sunrise,sunset,temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code',
      forecast_days: '2',
      temperature_unit: 'fahrenheit',
      wind_speed_unit: 'mph',
      precipitation_unit: 'inch',
      timezone: 'auto'
    }).toString();

    const wxRes = await fetch(weatherUrl, { headers:{ 'Accept':'application/json', 'User-Agent':'ZummeeWeatherProxy/1.0' } });
    if(!wxRes.ok) return json(502, { ok:false, error:'forecast-fetch-failed', status:wxRes.status });
    const wx = await wxRes.json();

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

    const placeName = [place['place name'], place['state abbreviation']].filter(Boolean).join(', ');
    const locationLabel = communityName ? `${communityName}${placeName ? ' • ' + placeName : ''}` : (placeName || `ZIP ${zip}`);

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
      tonightSub: weatherCodeShort(codes[idxTonight] || current.weather_code || 0)
    };

    return json(200, { ok:true, source:'zummee-weather-proxy-v773', model });
  }catch(err){
    return json(500, { ok:false, error:'weather-proxy-error', message:String(err && err.message || err) });
  }
};
