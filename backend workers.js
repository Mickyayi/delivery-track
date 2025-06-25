export default {
    async fetch(request, env, ctx) {
      // 处理CORS
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
          const backendUrl = env.BACKEND_URL; // 稍后在设置中配置
          
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
          const routeId = url.pathname.split('/')[2]; // 从 /driver-location/{route_id} 获取路线ID
          
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
              'X-API-Key': env.API_KEY // 需要在环境变量中配置
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
      
      return new Response('Not Found', { status: 404 });
    }
  };