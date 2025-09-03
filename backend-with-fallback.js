// 智能司机图标系统 - 带天气API回退版本
export default {
    async fetch(request, env, ctx) {
      // 处理CORS
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      };
      
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
      }
      
      const url = new URL(request.url);
      
      // 处理订单查询请求
      if (request.method === 'POST' && url.pathname === '/track-order') {
        try {
          const { phone } = await request.json();
          
          if (!phone) {
            return new Response(JSON.stringify({
              success: false,
              error: "手机号码不能为空"
            }), { 
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          // 调用你的后端API（从环境变量获取）
          const backendUrl = env.BACKEND_URL;
          
          const response = await fetch(`${backendUrl}/api/delivery/public/track-order`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ phone })
          });
          
          const data = await response.json();
          
          return new Response(JSON.stringify(data), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
          
        } catch (error) {
          return new Response(JSON.stringify({
            success: false,
            error: "查询失败，请稍后重试"
          }), { 
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
      
      // 处理司机位置查询请求 - 通过路线ID
      if (request.method === 'GET' && url.pathname.startsWith('/driver-location/')) {
        try {
          const routeId = url.pathname.split('/')[2];
          
          if (!routeId) {
            return new Response(JSON.stringify({
              success: false,
              error: "路线ID不能为空"
            }), { 
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          // 调用后端API获取司机位置
          const backendUrl = env.BACKEND_URL;
          
          const response = await fetch(`${backendUrl}/api/delivery/routes/${routeId}/driver-location`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `ApiKey ${env.API_KEY}`
            }
          });
          
          const data = await response.json();
          
          return new Response(JSON.stringify(data), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
          
        } catch (error) {
          return new Response(JSON.stringify({
            success: false,
            error: "获取司机位置失败，请稍后重试"
          }), { 
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
      
      // 处理天气查询请求 - 智能回退版本
      if (request.method === 'GET' && url.pathname.startsWith('/weather/')) {
        try {
          const pathParts = url.pathname.split('/');
          if (pathParts.length < 4) {
            return new Response(JSON.stringify({
              success: false,
              error: "缺少经纬度参数"
            }), { 
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          const lat = parseFloat(pathParts[2]);
          const lng = parseFloat(pathParts[3]);
          
          if (isNaN(lat) || isNaN(lng)) {
            return new Response(JSON.stringify({
              success: false,
              error: "无效的经纬度参数"
            }), { 
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          // 检查环境变量中的天气API配置
          if (!env.WEATHER_API_KEY) {
            return new Response(JSON.stringify({
              success: true,
              isRaining: false,
              weather: "Unknown",
              description: "天气API未配置，使用默认值",
              temperature: null,
              location: `${lat},${lng}`,
              fallback: "no_api_key"
            }), { 
              status: 200,
              headers: { 
                ...corsHeaders, 
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=300' // 5分钟缓存
              }
            });
          }
          
          // 尝试调用OpenWeatherMap API
          const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${env.WEATHER_API_KEY}&units=metric`;
          
          let weatherResponse;
          try {
            weatherResponse = await fetch(weatherUrl);
          } catch (error) {
            // 网络错误回退
            return new Response(JSON.stringify({
              success: true,
              isRaining: false,
              weather: "Unknown",
              description: "网络连接失败，使用默认值",
              temperature: null,
              location: `${lat},${lng}`,
              fallback: "network_error"
            }), { 
              status: 200,
              headers: { 
                ...corsHeaders, 
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=300'
              }
            });
          }
          
          if (!weatherResponse.ok) {
            // API错误回退（包括401无效密钥）
            return new Response(JSON.stringify({
              success: true,
              isRaining: false,
              weather: "Unknown",
              description: "天气API暂时不可用，使用默认值",
              temperature: null,
              location: `${lat},${lng}`,
              fallback: "api_error",
              debug: {
                status: weatherResponse.status,
                message: "API key may be inactive or invalid"
              }
            }), { 
              status: 200,
              headers: { 
                ...corsHeaders, 
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=300'
              }
            });
          }
          
          const weatherData = await weatherResponse.json();
          
          // 检查是否下雨 (rain, drizzle, thunderstorm)
          const weatherMain = weatherData.weather?.[0]?.main?.toLowerCase() || '';
          const isRaining = ['rain', 'drizzle', 'thunderstorm'].includes(weatherMain);
          
          return new Response(JSON.stringify({
            success: true,
            isRaining: isRaining,
            weather: weatherData.weather?.[0]?.main || 'Unknown',
            description: weatherData.weather?.[0]?.description || '',
            temperature: weatherData.main?.temp || null,
            location: weatherData.name || `${lat},${lng}`,
            fallback: "none"
          }), {
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json',
              'Cache-Control': 'public, max-age=1800' // 30分钟缓存
            }
          });
          
        } catch (error) {
          // 系统错误回退
          return new Response(JSON.stringify({
            success: true,
            isRaining: false,
            weather: "Unknown",
            description: "系统暂时不可用，使用默认值",
            temperature: null,
            location: "Unknown",
            fallback: "system_error",
            debug: {
              error: error.message
            }
          }), { 
            status: 200,
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json',
              'Cache-Control': 'public, max-age=300'
            }
          });
        }
      }

      // 处理Google Maps JavaScript API URL请求
      if (request.method === 'GET' && url.pathname === '/maps/js-api-url') {
        try {
          if (!env.GOOGLE_MAPS_API_KEY) {
            return new Response(JSON.stringify({
              error: "Google Maps API key not configured"
            }), { 
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          const googleMapsUrl = `https://maps.googleapis.com/maps/api/js?key=${env.GOOGLE_MAPS_API_KEY}&libraries=geometry&language=zh-CN&region=AU`;
          
          return new Response(JSON.stringify({ 
            url: googleMapsUrl,
            status: 'OK'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
          
        } catch (error) {
          return new Response(JSON.stringify({
            error: "Failed to generate Google Maps URL",
            details: error.message
          }), { 
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // 处理Google Maps API代理请求
      if (request.method === 'GET' && url.pathname.startsWith('/maps/')) {
        try {
          const service = url.pathname.split('/')[2];
          
          const allowedServices = ['geocoding', 'staticmap'];
          if (!allowedServices.includes(service)) {
            return new Response(JSON.stringify({
              error: "Service not allowed"
            }), { 
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          if (!env.GOOGLE_MAPS_API_KEY) {
            return new Response(JSON.stringify({
              error: "Google Maps API key not configured"
            }), { 
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          const googleApiUrl = new URL(`https://maps.googleapis.com/maps/api/${service}/json`);
          
          url.searchParams.forEach((value, key) => {
            googleApiUrl.searchParams.set(key, value);
          });
          
          googleApiUrl.searchParams.set('key', env.GOOGLE_MAPS_API_KEY);
          
          const response = await fetch(googleApiUrl.toString());
          
          if (!response.ok) {
            return new Response(JSON.stringify({
              error: `Google Maps API error: ${response.status}`,
              details: response.statusText
            }), { 
              status: response.status,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          const data = await response.json();
          
          return new Response(JSON.stringify(data), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
          
        } catch (error) {
          return new Response(JSON.stringify({
            error: "Maps service error",
            details: error.message
          }), { 
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      return new Response('Not Found', { status: 404 });
    }
  };
