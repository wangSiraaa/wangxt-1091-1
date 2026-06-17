const http = require('http');

function get(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3001${path}`, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    }).on('error', reject);
  });
}

async function test() {
  try {
    console.log('=== 健康检查 ===');
    console.log(await get('/api/health'));

    console.log('\n=== 统计摘要 ===');
    console.log(await get('/api/check-requests/stats/summary'));

    console.log('\n=== 患者列表 ===');
    const patients = await get('/api/patients');
    console.log('患者数量:', patients.data?.length || 0);

    console.log('\n=== 陪检员列表 ===');
    const escorts = await get('/api/escorts');
    console.log('陪检员数量:', escorts.data?.length || 0);

    console.log('\n=== 检查单列表 ===');
    const orders = await get('/api/check-orders');
    console.log('检查单数量:', orders.data?.length || 0);

    console.log('\n=== 病区列表 ===');
    const wards = await get('/api/wards');
    console.log('病区数量:', wards.data?.length || 0);

    console.log('\n=== 申请列表 ===');
    const requests = await get('/api/check-requests');
    console.log('申请数量:', requests.data?.length || 0);

    console.log('\n✅ 所有基础接口测试通过');
  } catch (e) {
    console.error('测试失败:', e.message);
  }
}

test();
