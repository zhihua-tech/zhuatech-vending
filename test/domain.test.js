import test from 'node:test';
import assert from 'node:assert/strict';
import { VendingService } from '../src/domain.js';

function fixture(quantity = 5) {
  const service = new VendingService();
  const product = service.createProduct({ sku: 'SKU1', barcode: '6901', name: '饮用水', price: 4, cost: 1.5 });
  const machine = service.registerMachine({ code: 'M1', name: '一号机', site: '园区' });
  const slot = service.configureSlot(machine.id, { code: 'A01', productId: product.id, capacity: 10, quantity, safetyStock: 2 });
  return { service, product, machine, slot };
}

test('订单完成库存预占、支付和成功出货闭环', () => {
  const { service, machine, slot } = fixture();
  const order = service.createOrder({ machineId: machine.id, lines: [{ slotId: slot.id, quantity: 2 }] }, 'terminal', 'order-1');
  assert.equal(service.slots.get(slot.id).reserved, 2);
  service.payOrder(order.id, { channel: 'wechat', tradeNo: 'WX1' });
  const completed = service.reportDispense(order.id, { results: [{ slotId: slot.id, success: true }] });
  assert.equal(completed.status, 'completed');
  assert.equal(service.slots.get(slot.id).quantity, 3);
  assert.equal(service.slots.get(slot.id).reserved, 0);
});

test('促销价格生效且订单请求幂等', () => {
  const { service, product, machine, slot } = fixture();
  service.createPromotion({ name: '九折', type: 'discount', value: 0.1, productIds: [product.id], endAt: new Date(Date.now() + 86400_000).toISOString() });
  const first = service.createOrder({ machineId: machine.id, lines: [{ slotId: slot.id, quantity: 1 }] }, 'terminal', 'same');
  const second = service.createOrder({ machineId: machine.id, lines: [{ slotId: slot.id, quantity: 1 }] }, 'terminal', 'same');
  assert.equal(first.id, second.id);
  assert.equal(first.payableAmount, 3.6);
  assert.equal(service.slots.get(slot.id).reserved, 1);
});

test('出货失败进入退款并生成维修工单', () => {
  const { service, machine, slot } = fixture();
  const order = service.createOrder({ machineId: machine.id, lines: [{ slotId: slot.id, quantity: 1 }] });
  service.payOrder(order.id, { channel: 'alipay', tradeNo: 'ALI1' });
  const failed = service.reportDispense(order.id, { results: [{ slotId: slot.id, success: false }] });
  assert.equal(failed.status, 'refund-pending');
  assert.equal(service.workOrders.size, 1);
  assert.equal(service.completeRefund(order.id, { refundTradeNo: 'RF1' }).status, 'refunded');
});

test('低库存生成补货任务并受容量约束', () => {
  const { service, machine, slot } = fixture(1);
  const task = service.createReplenishment(machine.id);
  assert.equal(task.lines[0].expectedQuantity, 9);
  service.completeReplenishment(task.id, { lines: [{ slotId: slot.id, quantity: 9 }] });
  assert.equal(service.slots.get(slot.id).quantity, 10);
});
