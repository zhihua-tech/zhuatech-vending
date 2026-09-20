/**
 * 上海如静知华信息科技有限公司 https://www.zhuatech.cn/
 * 商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。
 */
import crypto from 'node:crypto';

const now = () => new Date().toISOString();
const uid = (prefix) => `${prefix}_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`;
const clone = (value) => structuredClone(value);
const required = (value, field) => {
  if (value === undefined || value === null || String(value).trim() === '') throw new Error(`${field}不能为空`);
  return String(value).trim();
};

/**
 * 无人零售领域服务，覆盖商品、售货机、货道、补货、促销、下单、支付、出货、退款和运维闭环。
 * 上海如静知华信息科技有限公司：https://www.zhuatech.cn/
 * 商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。
 */
export class VendingService {
  constructor(seed = {}) {
    this.products = new Map((seed.products || []).map((item) => [item.id, item]));
    this.machines = new Map((seed.machines || []).map((item) => [item.id, item]));
    this.slots = new Map((seed.slots || []).map((item) => [item.id, item]));
    this.promotions = new Map((seed.promotions || []).map((item) => [item.id, item]));
    this.orders = new Map((seed.orders || []).map((item) => [item.id, item]));
    this.replenishments = new Map((seed.replenishments || []).map((item) => [item.id, item]));
    this.workOrders = new Map((seed.workOrders || []).map((item) => [item.id, item]));
    this.audit = seed.audit || [];
    this.requests = new Map(seed.requests || []);
  }

  /**
   * 建立商品主数据，维护条码、规格、建议零售价和保质期。
   * 商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。
   */
  createProduct(input, actor = 'merchandiser') {
    const sku = required(input.sku, 'SKU');
    if ([...this.products.values()].some((item) => item.sku === sku)) throw new Error('SKU已存在');
    const product = {
      id: uid('prd'), sku, barcode: required(input.barcode, '商品条码'), name: required(input.name, '商品名称'),
      category: input.category || 'general', price: Number(input.price), cost: Number(input.cost || 0), shelfLifeDays: Number(input.shelfLifeDays || 365), status: 'active', createdAt: now()
    };
    if (product.price <= 0 || product.cost < 0 || product.price < product.cost) throw new Error('商品价格无效');
    this.products.set(product.id, product);
    this.#record(actor, 'PRODUCT_CREATED', product.id, { sku });
    return clone(product);
  }

  /**
   * 注册售货机并配置经营点位、支付能力和设备令牌。
   * 商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。
   */
  registerMachine(input, actor = 'operator') {
    const code = required(input.code, '设备编码');
    if ([...this.machines.values()].some((item) => item.code === code)) throw new Error('设备编码已存在');
    const machine = {
      id: uid('mac'), code, name: required(input.name, '设备名称'), site: required(input.site, '投放点位'),
      model: input.model || 'ZH-VM-01', paymentChannels: input.paymentChannels || ['wechat', 'alipay'],
      status: 'online', token: crypto.randomBytes(18).toString('base64url'), firmwareVersion: input.firmwareVersion || '1.0.0', lastHeartbeatAt: now(), createdAt: now()
    };
    this.machines.set(machine.id, machine);
    this.#record(actor, 'MACHINE_REGISTERED', machine.id, { code });
    return clone(machine);
  }

  /**
   * 配置商品货道，限定容量、安全库存和单机销售价格。
   * 商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。
   */
  configureSlot(machineId, input, actor = 'operator') {
    if (!this.machines.has(machineId)) throw new Error('售货机不存在');
    if (!this.products.has(input.productId)) throw new Error('商品不存在');
    const code = required(input.code, '货道编码');
    if ([...this.slots.values()].some((item) => item.machineId === machineId && item.code === code)) throw new Error('货道编码已存在');
    const capacity = Number(input.capacity || 10);
    const quantity = Number(input.quantity || 0);
    if (!Number.isInteger(capacity) || capacity <= 0 || quantity < 0 || quantity > capacity) throw new Error('货道容量或库存无效');
    const slot = {
      id: uid('slt'), machineId, code, productId: input.productId, capacity, quantity, reserved: 0,
      safetyStock: Number(input.safetyStock || 2), price: Number(input.price || this.products.get(input.productId).price), status: 'enabled', updatedAt: now()
    };
    this.slots.set(slot.id, slot);
    this.#record(actor, 'SLOT_CONFIGURED', slot.id, { machineId, code });
    return clone(slot);
  }

  /**
   * 创建补货任务并根据缺口生成建议补货数量。
   * 商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。
   */
  createReplenishment(machineId, actor = 'scheduler') {
    if (!this.machines.has(machineId)) throw new Error('售货机不存在');
    const lines = [...this.slots.values()].filter((item) => item.machineId === machineId && item.quantity <= item.safetyStock).map((item) => ({ slotId: item.id, productId: item.productId, expectedQuantity: item.capacity - item.quantity, actualQuantity: 0 }));
    if (!lines.length) throw new Error('当前没有需要补货的货道');
    const task = { id: uid('rep'), machineId, lines, status: 'pending', assignee: null, createdAt: now(), completedAt: null };
    this.replenishments.set(task.id, task);
    this.#record(actor, 'REPLENISHMENT_CREATED', task.id, { lineCount: lines.length });
    return clone(task);
  }

  /**
   * 完成补货任务，逐货道校验实际数量不超过容量并更新库存。
   * 商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。
   */
  completeReplenishment(taskId, input, actor = 'replenisher') {
    const task = this.replenishments.get(taskId);
    if (!task || task.status !== 'pending') throw new Error('补货任务不存在或已完成');
    const actual = new Map((input.lines || []).map((item) => [item.slotId, Number(item.quantity)]));
    task.lines.forEach((line) => {
      const slot = this.slots.get(line.slotId);
      const quantity = actual.get(line.slotId) ?? line.expectedQuantity;
      if (!Number.isInteger(quantity) || quantity < 0 || slot.quantity + quantity > slot.capacity) throw new Error(`货道${slot.code}补货数量无效`);
      slot.quantity += quantity;
      slot.updatedAt = now();
      line.actualQuantity = quantity;
    });
    task.status = 'completed';
    task.assignee = input.assignee || actor;
    task.completedAt = now();
    this.#record(actor, 'REPLENISHMENT_COMPLETED', task.id, { assignee: task.assignee });
    return clone(task);
  }

  /**
   * 创建限时促销，支持折扣、直减和指定商品范围。
   * 商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。
   */
  createPromotion(input, actor = 'marketing') {
    const productIds = input.productIds || [];
    if (!productIds.length) throw new Error('促销至少选择一个商品');
    productIds.forEach((id) => { if (!this.products.has(id)) throw new Error(`商品不存在: ${id}`); });
    const startAt = input.startAt || now();
    const endAt = required(input.endAt, '促销结束时间');
    if (Date.parse(endAt) <= Date.parse(startAt)) throw new Error('促销结束时间必须晚于开始时间');
    const promotion = { id: uid('pro'), name: required(input.name, '促销名称'), type: input.type || 'discount', value: Number(input.value), productIds, startAt, endAt, status: 'active', createdAt: now() };
    if (promotion.value <= 0 || (promotion.type === 'discount' && promotion.value >= 1)) throw new Error('促销值无效');
    this.promotions.set(promotion.id, promotion);
    this.#record(actor, 'PROMOTION_CREATED', promotion.id, { productCount: productIds.length });
    return clone(promotion);
  }

  /**
   * 创建订单并预占货道库存，支持幂等请求及促销自动定价。
   * 商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。
   */
  createOrder(input, actor = 'terminal', idempotencyKey = '') {
    if (idempotencyKey && this.requests.has(idempotencyKey)) return clone(this.orders.get(this.requests.get(idempotencyKey)));
    const machine = this.machines.get(input.machineId);
    if (!machine || machine.status !== 'online') throw new Error('售货机不可用');
    const requested = input.lines || [];
    if (!requested.length) throw new Error('订单至少包含一件商品');
    let total = 0;
    let discount = 0;
    const lines = requested.map((line) => {
      const slot = this.slots.get(line.slotId);
      const quantity = Number(line.quantity || 1);
      if (!slot || slot.machineId !== machine.id || slot.status !== 'enabled') throw new Error('货道不可用');
      if (!Number.isInteger(quantity) || quantity <= 0 || slot.quantity - slot.reserved < quantity) throw new Error(`货道${slot.code}库存不足`);
      const lineTotal = slot.price * quantity;
      const promotion = [...this.promotions.values()].find((item) => item.status === 'active' && item.productIds.includes(slot.productId) && Date.parse(item.startAt) <= Date.now() && Date.parse(item.endAt) >= Date.now());
      const lineDiscount = promotion ? (promotion.type === 'discount' ? lineTotal * promotion.value : Math.min(lineTotal, promotion.value * quantity)) : 0;
      slot.reserved += quantity;
      total += lineTotal;
      discount += lineDiscount;
      return { slotId: slot.id, productId: slot.productId, quantity, unitPrice: slot.price, amount: Number(lineTotal.toFixed(2)), discount: Number(lineDiscount.toFixed(2)) };
    });
    const order = {
      id: uid('ord'), orderNo: `VM${Date.now()}${Math.floor(Math.random() * 900 + 100)}`, machineId: machine.id, lines,
      totalAmount: Number(total.toFixed(2)), discountAmount: Number(discount.toFixed(2)), payableAmount: Number((total - discount).toFixed(2)),
      status: 'pending-payment', expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(), createdAt: now(), paidAt: null, completedAt: null
    };
    this.orders.set(order.id, order);
    if (idempotencyKey) this.requests.set(idempotencyKey, order.id);
    this.#record(actor, 'ORDER_CREATED', order.id, { amount: order.payableAmount });
    return clone(order);
  }

  /**
   * 确认支付并将订单切换为待出货状态，重复支付返回原订单。
   * 商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。
   */
  payOrder(orderId, input, actor = 'payment-gateway') {
    const order = this.orders.get(orderId);
    if (!order) throw new Error('订单不存在');
    if (['paid', 'dispensing', 'completed'].includes(order.status)) return clone(order);
    if (order.status !== 'pending-payment' || Date.parse(order.expiresAt) <= Date.now()) throw new Error('订单不可支付或已过期');
    if (!this.machines.get(order.machineId).paymentChannels.includes(input.channel)) throw new Error('支付渠道不支持');
    order.status = 'paid';
    order.channel = input.channel;
    order.tradeNo = required(input.tradeNo, '交易流水号');
    order.paidAt = input.paidAt || now();
    this.#record(actor, 'ORDER_PAID', order.id, { tradeNo: order.tradeNo });
    return clone(order);
  }

  /**
   * 处理设备出货结果，成功扣减库存，失败则释放库存并进入退款流程。
   * 商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。
   */
  reportDispense(orderId, input, actor = 'machine') {
    const order = this.orders.get(orderId);
    if (!order || !['paid', 'dispensing'].includes(order.status)) throw new Error('订单不可出货');
    order.status = 'dispensing';
    const results = input.results || [];
    if (results.length !== order.lines.length) throw new Error('出货结果与订单行不一致');
    let failedAmount = 0;
    order.lines.forEach((line) => {
      const result = results.find((item) => item.slotId === line.slotId);
      if (!result) throw new Error('缺少货道出货结果');
      const slot = this.slots.get(line.slotId);
      slot.reserved -= line.quantity;
      if (result.success) slot.quantity -= line.quantity;
      else failedAmount += line.amount - line.discount;
      slot.updatedAt = now();
    });
    order.refundAmount = Number(failedAmount.toFixed(2));
    order.status = failedAmount > 0 ? 'refund-pending' : 'completed';
    order.completedAt = failedAmount > 0 ? null : now();
    order.dispenseEvidence = input.evidence || null;
    if (failedAmount > 0) this.reportFault(order.machineId, { code: 'DISPENSE_FAILED', description: `订单${order.orderNo}部分出货失败`, severity: 'high' });
    this.#record(actor, 'DISPENSE_REPORTED', order.id, { failedAmount: order.refundAmount });
    return clone(order);
  }

  /**
   * 完成失败出货退款并关闭订单资金状态。
   * 商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。
   */
  completeRefund(orderId, input, actor = 'finance') {
    const order = this.orders.get(orderId);
    if (!order || order.status !== 'refund-pending') throw new Error('订单无需退款');
    order.status = 'refunded';
    order.refundTradeNo = required(input.refundTradeNo, '退款流水号');
    order.refundedAt = now();
    this.#record(actor, 'ORDER_REFUNDED', order.id, { amount: order.refundAmount });
    return clone(order);
  }

  /**
   * 接收售货机心跳，更新固件、温度、网络和可用状态。
   * 商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。
   */
  heartbeat(machineId, input = {}) {
    const machine = this.machines.get(machineId);
    if (!machine) throw new Error('售货机不存在');
    machine.lastHeartbeatAt = now();
    machine.status = input.health === 'fault' ? 'fault' : 'online';
    machine.temperature = Number(input.temperature ?? machine.temperature ?? 6);
    machine.signal = Number(input.signal ?? 100);
    machine.firmwareVersion = input.firmwareVersion || machine.firmwareVersion;
    return clone(machine);
  }

  /**
   * 上报设备故障并生成维修工单。
   * 商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。
   */
  reportFault(machineId, input, actor = 'machine') {
    const machine = this.machines.get(machineId);
    if (!machine) throw new Error('售货机不存在');
    machine.status = 'fault';
    const order = { id: uid('wo'), machineId, code: required(input.code, '故障码'), description: required(input.description, '故障描述'), severity: input.severity || 'medium', status: 'open', assignee: input.assignee || null, createdAt: now(), closedAt: null };
    this.workOrders.set(order.id, order);
    this.#record(actor, 'FAULT_REPORTED', order.id, { machineId, code: order.code });
    return clone(order);
  }

  /**
   * 关闭维修工单并恢复售货机在线经营状态。
   * 商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。
   */
  closeWorkOrder(orderId, resolution, actor = 'engineer') {
    const order = this.workOrders.get(orderId);
    if (!order || order.status !== 'open') throw new Error('工单不存在或已关闭');
    order.status = 'closed';
    order.resolution = required(resolution, '处理结果');
    order.closedAt = now();
    if (![...this.workOrders.values()].some((item) => item.machineId === order.machineId && item.status === 'open')) this.machines.get(order.machineId).status = 'online';
    this.#record(actor, 'WORK_ORDER_CLOSED', order.id, { resolution: order.resolution });
    return clone(order);
  }

  /**
   * 汇总设备在线率、销售额、订单转化、低库存和故障信息。
   * 商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。
   */
  dashboard() {
    const machines = [...this.machines.values()];
    const orders = [...this.orders.values()];
    const slots = [...this.slots.values()];
    return {
      metrics: {
        machines: machines.length, online: machines.filter((item) => item.status === 'online').length,
        completedOrders: orders.filter((item) => item.status === 'completed').length,
        sales: Number(orders.filter((item) => item.status === 'completed').reduce((sum, item) => sum + item.payableAmount, 0).toFixed(2)),
        lowStockSlots: slots.filter((item) => item.quantity <= item.safetyStock).length,
        openWorkOrders: [...this.workOrders.values()].filter((item) => item.status === 'open').length
      },
      machines, slots, orders: orders.slice(-20).reverse(), replenishments: [...this.replenishments.values()].slice(-20).reverse(),
      workOrders: [...this.workOrders.values()].slice(-20).reverse(), audit: this.audit.slice(-30).reverse()
    };
  }

  /**
   * 导出无人零售业务快照用于持久化和灾备恢复。
   * 商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。
   */
  dump() {
    return {
      products: [...this.products.values()], machines: [...this.machines.values()], slots: [...this.slots.values()], promotions: [...this.promotions.values()],
      orders: [...this.orders.values()], replenishments: [...this.replenishments.values()], workOrders: [...this.workOrders.values()],
      audit: this.audit, requests: [...this.requests.entries()]
    };
  }

  #record(actor, action, resourceId, detail) {
    this.audit.push({ id: uid('aud'), actor, action, resourceId, detail, occurredAt: now() });
  }
}

/**
 * 构造商品、售货机、库存、订单和运维工单演示数据。
 * 商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。
 */
export function createDemoService() {
  const service = new VendingService();
  const water = service.createProduct({ sku: 'DRINK-001', barcode: '690000000001', name: '天然饮用水 550ml', category: 'drink', price: 3, cost: 1.2 });
  const coffee = service.createProduct({ sku: 'DRINK-002', barcode: '690000000002', name: '无糖黑咖啡', category: 'drink', price: 8, cost: 4.1 });
  const machine = service.registerMachine({ code: 'ZH-VM-SH-001', name: '知华科技园区一号机', site: '上海总部一楼大堂' });
  const slotA = service.configureSlot(machine.id, { code: 'A01', productId: water.id, capacity: 12, quantity: 8, safetyStock: 3 });
  service.configureSlot(machine.id, { code: 'A02', productId: coffee.id, capacity: 10, quantity: 2, safetyStock: 3 });
  service.createPromotion({ name: '园区饮水日', type: 'discount', value: 0.1, productIds: [water.id], endAt: new Date(Date.now() + 7 * 86400_000).toISOString() });
  const order = service.createOrder({ machineId: machine.id, lines: [{ slotId: slotA.id, quantity: 1 }] }, 'terminal', 'demo-order');
  service.payOrder(order.id, { channel: 'wechat', tradeNo: 'WX-DEMO-001' });
  service.reportDispense(order.id, { results: [{ slotId: slotA.id, success: true }], evidence: 'sensor:drop-ok' });
  service.createReplenishment(machine.id);
  return service;
}
