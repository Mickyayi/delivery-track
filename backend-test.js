// 简化的测试版本 - 用于调试Cloudflare Worker问题
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
    
    // 测试根路径
    if (url.pathname === '/') {
      return new Response(JSON.stringify({
        status: 'OK',
        message: 'Delivery Track API v3.0.0 - 智能司机状态识别系统',
        timestamp: new Date().toISOString(),
        endpoints: [
          'POST /track-order',
          'GET /driver-location/{route_id}',
          'GET /weather/{lat}/{lng}',
          'GET /maps/js-api-url',
          'GET /maps/geocoding'
        ]
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
        
        // 检查环境变量
        if (!env.BACKEND_URL) {
          return new Response(JSON.stringify({
            success: false,
            error: "BACKEND_URL环境变量未配置"
          }), { 
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // 调用你的后端API
        const response = await fetch(`${env.BACKEND_URL}/api/delivery/public/track-order`, {
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
          error: "查询失败，请稍后重试",
          details: error.message
        }), { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // 处理天气查询请求 - 简化版本
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
        
        // 检查天气API配置
        if (!env.WEATHER_API_KEY) {
          return new Response(JSON.stringify({
            success: false,
            error: "天气API未配置",
            isRaining: false,
            message: "WEATHER_API_KEY环境变量未设置"
          }), { 
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // 测试天气API调用
        const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${env.WEATHER_API_KEY}&units=metric`;
        
        const weatherResponse = await fetch(weatherUrl);
        if (!weatherResponse.ok) {
          return new Response(JSON.stringify({
            success: false,
            error: "天气API调用失败",
            isRaining: false,
            status: weatherResponse.status
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
          location: weatherData.name || `${lat},${lng}`
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
          details: error.message
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
