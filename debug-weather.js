// 天气API调试版本
export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    const url = new URL(request.url);
    
    // 调试根路径 - 显示所有环境变量状态
    if (url.pathname === '/') {
      return new Response(JSON.stringify({
        status: 'Delivery Track API v3.0.0 - Debug Mode',
        timestamp: new Date().toISOString(),
        environment: {
          BACKEND_URL: env.BACKEND_URL ? 'CONFIGURED' : 'MISSING',
          API_KEY: env.API_KEY ? 'CONFIGURED' : 'MISSING',
          GOOGLE_MAPS_API_KEY: env.GOOGLE_MAPS_API_KEY ? 'CONFIGURED' : 'MISSING',
          WEATHER_API_KEY: env.WEATHER_API_KEY ? 'CONFIGURED' : 'MISSING',
          WEATHER_API_KEY_LENGTH: env.WEATHER_API_KEY ? env.WEATHER_API_KEY.length : 0
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // 处理天气查询请求 - 增强调试
    if (request.method === 'GET' && url.pathname.startsWith('/weather/')) {
      try {
        const pathParts = url.pathname.split('/');
        
        if (pathParts.length < 4) {
          return new Response(JSON.stringify({
            success: false,
            error: "缺少经纬度参数",
            debug: {
              pathParts: pathParts,
              pathLength: pathParts.length
            }
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
            error: "无效的经纬度参数",
            debug: {
              lat: pathParts[2],
              lng: pathParts[3],
              parsedLat: lat,
              parsedLng: lng
            }
          }), { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // 检查环境变量
        if (!env.WEATHER_API_KEY) {
          return new Response(JSON.stringify({
            success: false,
            error: "天气API未配置",
            isRaining: false,
            debug: {
              weatherKeyExists: false,
              environmentKeys: Object.keys(env)
            }
          }), { 
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // 调用OpenWeatherMap API - 增强错误处理
        const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${env.WEATHER_API_KEY}&units=metric`;
        
        let weatherResponse;
        let weatherError = null;
        
        try {
          weatherResponse = await fetch(weatherUrl);
        } catch (error) {
          weatherError = error.message;
        }
        
        if (weatherError || !weatherResponse) {
          return new Response(JSON.stringify({
            success: false,
            error: "网络请求失败",
            isRaining: false,
            debug: {
              weatherUrl: weatherUrl.replace(env.WEATHER_API_KEY, 'HIDDEN'),
              networkError: weatherError,
              keyLength: env.WEATHER_API_KEY.length
            }
          }), { 
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        if (!weatherResponse.ok) {
          let errorText = 'Unknown error';
          try {
            const errorData = await weatherResponse.json();
            errorText = errorData.message || errorData.error || `HTTP ${weatherResponse.status}`;
          } catch {
            errorText = `HTTP ${weatherResponse.status} ${weatherResponse.statusText}`;
          }
          
          return new Response(JSON.stringify({
            success: false,
            error: "天气API调用失败",
            isRaining: false,
            debug: {
              status: weatherResponse.status,
              statusText: weatherResponse.statusText,
              errorDetails: errorText,
              keyLength: env.WEATHER_API_KEY.length
            }
          }), { 
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const weatherData = await weatherResponse.json();
        
        // 检查是否下雨
        const weatherMain = weatherData.weather?.[0]?.main?.toLowerCase() || '';
        const isRaining = ['rain', 'drizzle', 'thunderstorm'].includes(weatherMain);
        
        return new Response(JSON.stringify({
          success: true,
          isRaining: isRaining,
          weather: weatherData.weather?.[0]?.main || 'Unknown',
          description: weatherData.weather?.[0]?.description || '',
          temperature: weatherData.main?.temp || null,
          location: weatherData.name || `${lat},${lng}`,
          debug: {
            weatherMain: weatherMain,
            fullWeatherData: weatherData.weather?.[0] || {},
            keyLength: env.WEATHER_API_KEY.length
          }
        }), {
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=1800'
          }
        });
        
      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          error: "天气查询服务异常",
          isRaining: false,
          debug: {
            exceptionMessage: error.message,
            exceptionStack: error.stack,
            keyExists: !!env.WEATHER_API_KEY
          }
        }), { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response(JSON.stringify({
      error: 'Not Found',
      path: url.pathname,
      method: request.method
    }), { 
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};
