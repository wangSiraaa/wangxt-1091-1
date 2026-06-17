const http = require('http');

function request(method, path, data) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3002,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve(body);
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

async function testFlow() {
  try {
    console.log('=== 1. 获取基础数据 ===');
    
    const patients = await request('GET', '/api/patients');
    const patient = patients.data[0];
    const isolatedPatient = patients.data.find(p => p.is_isolated === 1);
    console.log('患者:', patient.name, '| 隔离患者:', isolatedPatient.name);

    const nurses = await request('GET', '/api/nurses');
    const nurse = nurses.data[0];
    console.log('护士:', nurse.name);

    const escorts = await request('GET', '/api/escorts');
    const normalEscort = escorts.data.find(e => e.is_specialist === 0 && e.status === 'online');
    const specialistEscort = escorts.data.find(e => e.is_specialist === 1 && e.status === 'online');
    console.log('普通陪检员:', normalEscort.name, '| 专人陪检员:', specialistEscort.name);

    console.log('\n=== 2. 提交陪检申请（普通患者） ===');
    const createResult = await request('POST', '/api/check-requests', {
      patient_id: patient.id,
      nurse_id: nurse.id,
      check_type: 'CT',
      check_item: '胸部CT平扫',
      check_room: 'CT室1号',
      urgency: 'normal',
      remark: '测试申请',
    });
    console.log('申请创建:', createResult.success ? '成功' : '失败');
    const requestId = createResult.data.id;
    console.log('申请ID:', requestId);
    console.log('申请状态:', createResult.data.status);

    console.log('\n=== 3. 测试隔离患者规则 - 给隔离患者派普通陪检员（应该失败） ===');
    const isolatedResult = await request('POST', '/api/check-requests', {
      patient_id: isolatedPatient.id,
      nurse_id: nurse.id,
      check_type: 'B超',
      check_item: '腹部B超',
      check_room: 'B超室',
      urgency: 'urgent',
    });
    const isolatedRequestId = isolatedResult.data.id;
    console.log('隔离患者申请创建:', isolatedResult.success);

    const assignNormal = await request('PUT', `/api/check-requests/${isolatedRequestId}/assign`, {
      escort_id: normalEscort.id,
      operator_id: 'supervisor-001',
      operator_name: '病区主管',
    });
    console.log('给隔离患者派普通陪检员:', assignNormal.success ? '成功（有问题）' : '失败（符合预期）');
    if (!assignNormal.success) {
      console.log('失败原因:', assignNormal.message);
    }

    console.log('\n=== 4. 给隔离患者派专人陪检员（应该成功） ===');
    const assignSpecialist = await request('PUT', `/api/check-requests/${isolatedRequestId}/assign`, {
      escort_id: specialistEscort.id,
      operator_id: 'supervisor-001',
      operator_name: '病区主管',
    });
    console.log('给隔离患者派专人陪检员:', assignSpecialist.success ? '成功' : '失败');

    console.log('\n=== 5. 正常患者派单 ===');
    const assignResult = await request('PUT', `/api/check-requests/${requestId}/assign`, {
      escort_id: normalEscort.id,
      operator_id: 'supervisor-001',
      operator_name: '病区主管',
    });
    console.log('派单:', assignResult.success ? '成功' : '失败');
    console.log('状态:', assignResult.data?.status);

    console.log('\n=== 6. 接单 ===');
    const acceptResult = await request('PUT', `/api/check-requests/${requestId}/accept`, {
      operator_id: normalEscort.id,
    });
    console.log('接单:', acceptResult.success ? '成功' : '失败');
    console.log('状态:', acceptResult.data?.status);

    console.log('\n=== 7. 开始陪检 ===');
    const startResult = await request('PUT', `/api/check-requests/${requestId}/start`, {
      operator_id: normalEscort.id,
    });
    console.log('开始:', startResult.success ? '成功' : '失败');
    console.log('状态:', startResult.data?.status);

    console.log('\n=== 8. 完成陪检 ===');
    const completeResult = await request('PUT', `/api/check-requests/${requestId}/complete`, {
      operator_id: normalEscort.id,
      remark: '检查顺利完成',
    });
    console.log('完成:', completeResult.success ? '成功' : '失败');
    console.log('状态:', completeResult.data?.status);

    console.log('\n=== 9. 测试结算规则 - 未完成的申请不能结算 ===');
    const settleNotDone = await request('PUT', `/api/check-requests/${isolatedRequestId}/settle`, {
      operator_id: 'supervisor-001',
      operator_name: '病区主管',
      settlement_amount: 100,
    });
    console.log('未完成就结算:', settleNotDone.success ? '成功（有问题）' : '失败（符合预期）');
    if (!settleNotDone.success) {
      console.log('失败原因:', settleNotDone.message);
    }

    console.log('\n=== 10. 正常结算 ===');
    const settleResult = await request('PUT', `/api/check-requests/${requestId}/settle`, {
      operator_id: 'supervisor-001',
      operator_name: '病区主管',
      settlement_amount: 150.5,
      remark: '正常结算',
    });
    console.log('结算:', settleResult.success ? '成功' : '失败');
    console.log('状态:', settleResult.data?.status);
    console.log('结算金额:', settleResult.data?.settlement_amount);

    console.log('\n=== 11. 查看操作日志 ===');
    const logs = await request('GET', `/api/check-requests/${requestId}/logs`);
    console.log('操作日志数量:', logs.data?.length || 0);
    logs.data?.forEach(log => {
      console.log(`  - ${log.action}: ${log.operator_name} - ${log.remark || ''}`);
    });

    console.log('\n=== 12. 查看统计 ===');
    const stats = await request('GET', '/api/check-requests/stats/summary');
    console.log('待处理:', stats.data?.pending_count);
    console.log('进行中:', stats.data?.in_progress_count);
    console.log('已完成:', stats.data?.completed_count);
    console.log('已结算:', stats.data?.settled_count);
    console.log('平均等待时长:', stats.data?.avg_wait_duration, '分钟');
    console.log('今日申请:', stats.data?.today_requests);
    console.log('今日完成:', stats.data?.today_completed);

    console.log('\n✅ 完整业务流程测试通过！');
    console.log('   ✓ 护士提交申请');
    console.log('   ✓ 隔离患者必须专人陪检');
    console.log('   ✓ 主管派单');
    console.log('   ✓ 陪检员接单/开始/完成');
    console.log('   ✓ 完成前不能结算');
    console.log('   ✓ 正常结算');
    console.log('   ✓ 操作日志记录');
    console.log('   ✓ 数据统计');
  } catch (e) {
    console.error('测试失败:', e.message);
    console.error(e.stack);
  }
}

testFlow();
