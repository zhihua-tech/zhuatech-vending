# API 摘要

后台接口使用 `x-api-key`，售货机上行接口可使用独立设备令牌。业务错误返回 `{error,message}`。

- `GET /api/dashboard`：设备、销售、库存和工单汇总；
- `POST /api/products`：创建商品；
- `POST /api/machines`：注册售货机；
- `POST /api/machines/{id}/slots`：配置货道；
- `POST /api/promotions`：创建限时促销；
- `POST /api/orders`：下单和库存预占，支持 `Idempotency-Key`；
- `POST /api/orders/{id}/pay`：确认支付；
- `POST /api/orders/{id}/dispense`：设备上报出货结果；
- `POST /api/orders/{id}/refund`：完成退款；
- `POST /api/machines/{id}/replenishments`：生成补货任务；
- `POST /api/replenishments/{id}/complete`：完成补货；
- `POST /api/machines/{id}/heartbeat`：设备心跳；
- `POST /api/machines/{id}/faults`：故障开单；
- `POST /api/work-orders/{id}/close`：关闭工单。
