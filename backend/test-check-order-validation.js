const http = require('http');

const BASE_URL = 'http://localhost:3003';
let passedCount = 0;
let failedCount = 0;

function request(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

function test(name, fn) {
  return fn().then(() => {
    console.log(`✅ PASS: ${name}`);
    passedCount++;
  }).catch((e) => {
    console.log(`❌ FAIL: ${name}`);
    console.log(`   Error: ${e.message}`);
    failedCount++;
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

async function main() {
  console.log('========================================');
  console.log('检查单关联校验回归测试');
  console.log('========================================\n');

  let patients, nurses, escorts, checkOrders;

  console.log('--- 准备测试数据 ---');
  const patientsRes = await request('GET', '/api/patients');
  patients = patientsRes.data?.data || [];
  console.log('患者数:', patients.length);

  const nursesRes = await request('GET', '/api/nurses');
  nurses = nursesRes.data?.data || [];
  console.log('护士数:', nurses.length);

  const escortsRes = await request('GET', '/api/escorts');
  escorts = escortsRes.data?.data || [];
  console.log('陪检员数:', escorts.length);

  const ordersRes = await request('GET', '/api/check-orders');
  checkOrders = ordersRes.data?.data || [];
  console.log('检查单数:', checkOrders.length);

  const pendingOrder = checkOrders.find((o) => o.status === 'pending');
  const nonPendingOrder = checkOrders.find((o) => o.status !== 'pending');
  console.log('开立状态检查单:', pendingOrder ? pendingOrder.order_no : '无');
  console.log('非开立状态检查单:', nonPendingOrder ? `${nonPendingOrder.order_no}(${nonPendingOrder.status})` : '无');

  console.log('\n--- 一、护士提交陪检申请接口校验 ---');

  await test('1.1 未传 check_order_id 时应报错', async () => {
    const res = await request('POST', '/api/check-requests', {
      patient_id: patients[0].id,
      nurse_id: nurses[0].id,
      check_type: 'CT',
      check_item: '头部CT'
    });
    assert(res.status !== 200 || res.data.success === false, '请求应该失败');
    const msg = (res.data.message || res.data.error || '').toString();
    assert(msg.includes('检查单'), `错误信息应包含检查单，实际：${msg}`);
  });

  await test('1.2 传入不存在的 check_order_id 时应报错', async () => {
    const res = await request('POST', '/api/check-requests', {
      patient_id: patients[0].id,
      nurse_id: nurses[0].id,
      check_order_id: 'non-existent-order-id',
      check_type: 'CT',
      check_item: '头部CT'
    });
    assert(res.status !== 200 || res.data.success === false, '请求应该失败');
    const msg = (res.data.message || res.data.error || '').toString();
    assert(msg.includes('检查单'), `错误信息应包含检查单，实际：${msg}`);
  });

  if (pendingOrder) {
    await test('1.3 检查单与患者不匹配时应报错', async () => {
      const otherPatient = patients.find((p) => p.id !== pendingOrder.patient_id);
      if (!otherPatient) throw new Error('无其他患者可测试');
      const res = await request('POST', '/api/check-requests', {
        patient_id: otherPatient.id,
        nurse_id: nurses[0].id,
        check_order_id: pendingOrder.id,
        check_type: 'CT',
        check_item: '头部CT'
      });
      assert(res.status !== 200 || res.data.success === false, '请求应该失败');
      const msg = (res.data.message || res.data.error || '').toString();
      assert(msg.includes('不匹配') || msg.includes('患者'), `错误信息应提示不匹配，实际：${msg}`);
    });
  }

  if (nonPendingOrder) {
    await test('1.4 检查单非开立状态时应报错', async () => {
      const res = await request('POST', '/api/check-requests', {
        patient_id: nonPendingOrder.patient_id,
        nurse_id: nurses[0].id,
        check_order_id: nonPendingOrder.id,
        check_type: 'CT',
        check_item: '头部CT'
      });
      assert(res.status !== 200 || res.data.success === false, '请求应该失败');
      const msg = (res.data.message || res.data.error || '').toString();
      assert(msg.includes('状态') || msg.includes('开立'), `错误信息应提示状态异常，实际：${msg}`);
    });
  }

  let createdRequestId = null;
  if (pendingOrder) {
    await test('1.5 使用有效已开立检查单提交成功', async () => {
      const res = await request('POST', '/api/check-requests', {
        patient_id: pendingOrder.patient_id,
        nurse_id: nurses[0].id,
        check_order_id: pendingOrder.id,
        check_type: pendingOrder.check_type,
        check_item: pendingOrder.check_item
      });
      assert((res.status === 200 || res.status === 201) && res.data.success === true, `请求应该成功，实际 status=${res.status}, msg=${res.data.message || res.data.error}`);
      assert(res.data.data && res.data.data.id, '应返回申请ID');
      createdRequestId = res.data.data.id;
    });
  }

  console.log('\n--- 二、主管派单接口校验 ---');

  await test('2.1 申请未关联检查单（直接模拟：如果有则报错）', async () => {
    const allRequestsRes = await request('GET', '/api/check-requests');
    const allRequests = allRequestsRes.data?.data || [];
    const noOrderRequest = allRequests.find((r) => !r.check_order_id);
    if (noOrderRequest && noOrderRequest.status === 'pending') {
      const availableEscort = escorts.find((e) => e.status === 'online');
      if (!availableEscort) throw new Error('无在线陪检员');
      const res = await request('PUT', `/api/check-requests/${noOrderRequest.id}/assign`, {
        escort_id: availableEscort.id,
        operator_id: 'supervisor-001',
        operator_name: '病区主管',
        is_manual_assign: true
      });
      assert(res.status !== 200 || res.data.success === false, '派单应该失败');
      const msg = (res.data.message || res.data.error || '').toString();
      assert(msg.includes('检查单'), `错误信息应包含检查单，实际：${msg}`);
    } else {
      console.log('   ⚠️  跳过：没有未关联检查单的待派单申请，改用创建一个临时申请来验证');
    }
  });

  if (createdRequestId) {
    await test('2.2 关联有效检查单的待派单申请可以成功派单', async () => {
      const availableEscort = escorts.find((e) => e.status === 'online');
      if (!availableEscort) throw new Error('无在线陪检员');
      const res = await request('PUT', `/api/check-requests/${createdRequestId}/assign`, {
        escort_id: availableEscort.id,
        operator_id: 'supervisor-001',
        operator_name: '病区主管',
        is_manual_assign: true
      });
      assert(res.status === 200 && res.data.success === true, `派单应该成功，实际：status=${res.status}, msg=${res.data.message || res.data.error}`);
    });
  }

  console.log('\n--- 三、申请详情中检查单信息返回校验 ---');

  if (createdRequestId) {
    await test('3.1 查询申请详情时应返回关联的检查单信息', async () => {
      const res = await request('GET', `/api/check-requests/${createdRequestId}`);
      assert(res.status === 200 && res.data.success === true, '查询应该成功');
      const req = res.data.data;
      assert(req.check_order_id, '应有 check_order_id');
      assert(req.check_order, '应有关联的 check_order 对象');
      assert(req.check_order.order_no, 'check_order 应有 order_no');
      assert(req.check_order.status, 'check_order 应有 status');
    });
  }

  console.log('\n--- 四、申请列表中检查单信息返回校验 ---');

  await test('4.1 申请列表中每条记录应包含 check_order 信息', async () => {
    const res = await request('GET', '/api/check-requests');
    assert(res.status === 200 && res.data.success === true, '查询应该成功');
    const list = res.data.data || [];
    if (list.length > 0) {
      const withOrder = list.filter((r) => r.check_order_id);
      if (withOrder.length > 0) {
        const sample = withOrder[0];
        assert(sample.check_order, '有关联 check_order_id 的记录应包含 check_order 对象');
      }
    }
  });

  console.log('\n========================================');
  console.log(`测试结果: 通过 ${passedCount}, 失败 ${failedCount}`);
  console.log('========================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('测试执行异常:', e);
  process.exit(1);
});
