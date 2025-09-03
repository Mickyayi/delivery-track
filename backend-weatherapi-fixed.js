// 智能司机图标系统 - WeatherAPI.com版本（修复根路径）
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
      
      // 处理根路径 - 显示API状态
      if (url.pathname === '/') {
        return new Response(JSON.stringify({
          status: 'OK',
          service: 'Delivery Track API v3.0.0',
          features: '智能司机状态识别系统',
          timestamp: new Date().toISOString(),
          endpoints: {
            'POST /track-order': '订单查询',
            'GET /driver-location/{route_id}': '司机位置',
            'GET /weather/{lat}/{lng}': '天气查询 (WeatherAPI.com)',
            'GET /maps/js-api-url': 'Google Maps API',
            'GET /maps/geocoding': '地理编码'
          },
          weather_provider: 'WeatherAPI.com',
          smart_icons: {
            normal: '正常配送 (延误≤15分钟)',
            late: '可能延误 (延误>15分钟)', 
            rain: '雨天配送 (优先级最高)'
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
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
      
      // 处理司机位置查询请求
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
      
      // 处理天气查询请求 - 使用WeatherAPI.com
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
          
          // 检查WeatherAPI密钥
          if (!env.WEATHER_API_KEY) {
            return new Response(JSON.stringify({
              success: true,
              isRaining: false,
              weather: "Unknown",
              description: "天气API未配置，使用默认值",
              temperature: null,
              location: `${lat},${lng}`,
              provider: "fallback"
            }), { 
              status: 200,
              headers: { 
                ...corsHeaders, 
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=300'
              }
            });
          }
          
          // 调用WeatherAPI.com
          const weatherUrl = `https://api.weatherapi.com/v1/current.json?key=${env.WEATHER_API_KEY}&q=${lat},${lng}&aqi=no`;
          
          let weatherResponse;
          try {
            weatherResponse = await fetch(weatherUrl);
          } catch (error) {
            return new Response(JSON.stringify({
              success: true,
              isRaining: false,
              weather: "Unknown",
              description: "网络连接失败，使用默认值",
              temperature: null,
              location: `${lat},${lng}`,
              provider: "fallback",
              error: "network_error"
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
            return new Response(JSON.stringify({
              success: true,
              isRaining: false,
              weather: "Unknown",
              description: "天气API暂时不可用，使用默认值",
              temperature: null,
              location: `${lat},${lng}`,
              provider: "fallback",
              error: `api_error_${weatherResponse.status}`
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
          
          // WeatherAPI.com 数据格式解析
          const condition = weatherData.current?.condition?.text?.toLowerCase() || '';
          const conditionCode = weatherData.current?.condition?.code || 0;
          
          // 检查是否下雨 - WeatherAPI.com 的条件码
          const rainyConditions = [
            'rain', 'drizzle', 'shower', 'thunderstorm', 'storm',
            'light rain', 'moderate rain', 'heavy rain', 'torrential rain',
            'light drizzle', 'heavy drizzle', 'patchy rain',
            'thundery outbreaks', 'blizzard'
          ];
          
          // 雨天条件码范围 (1063-1276是降水相关)
          const rainyConditionCodes = [
            1063, 1066, 1069, 1072, 1150, 1153, 1168, 1171, 
            1180, 1183, 1186, 1189, 1192, 1195, 1198, 1201,
            1204, 1207, 1240, 1243, 1246, 1249, 1252, 1255,
            1258, 1261, 1264, 1273, 1276
          ];
          
          const isRaining = rainyConditions.some(cond => condition.includes(cond)) || 
                           rainyConditionCodes.includes(conditionCode);
          
          return new Response(JSON.stringify({
            success: true,
            isRaining: isRaining,
            weather: weatherData.current?.condition?.text || 'Unknown',
            description: weatherData.current?.condition?.text || '',
            temperature: weatherData.current?.temp_c || null,
            location: weatherData.location?.name || `${lat},${lng}`,
            provider: "weatherapi.com",
            debug: {
              condition: condition,
              conditionCode: conditionCode,
              isRaining: isRaining
            }
          }), {
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json',
              'Cache-Control': 'public, max-age=1800' // 30分钟缓存
            }
          });
          
        } catch (error) {
          return new Response(JSON.stringify({
            success: true,
            isRaining: false,
            weather: "Unknown",
            description: "系统暂时不可用，使用默认值",
            temperature: null,
            location: "Unknown",
            provider: "fallback",
            error: "system_error"
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

      // Google Maps API相关端点
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

      return new Response(JSON.stringify({
        error: 'Not Found',
        message: '请访问根路径查看可用的API端点',
        available_endpoints: ['/', '/track-order', '/weather/{lat}/{lng}', '/maps/js-api-url']
      }), { 
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  };
