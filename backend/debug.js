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
  console.log('=== 患者列表 ===');
  const patients = await get('/api/patients');
  console.log(JSON.stringify(patients, null, 2).slice(0, 500));

  console.log('\n=== 陪检员列表 ===');
  const escorts = await get('/api/escorts');
  console.log(JSON.stringify(escorts, null, 2).slice(0, 500));
}

test();
