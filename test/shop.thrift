namespace cpp demo.shop
namespace java demo.shop

include "common.thrift"

// A sellable item. Fields exercise qualified types, enums as defaults,
// containers and field annotations.
struct Product {
  1: required common.UUID id,
  2: required string name,
  3: optional string description,
  4: required common.Money price,
  5: optional list<string> tags,
  6: optional common.StringMap attributes,
  7: optional common.Status status = common.Status.PENDING,
  8: optional list<common.Category> categories,
  9: optional bool onSale (since = "2026-01-01")
}

struct OrderItem {
  1: required common.UUID productId,
  2: required i32 quantity,
  3: required common.Money unitPrice,
  4: optional common.Money discount
}

struct Order {
  1: required common.UUID id,
  2: required common.UUID buyerId,
  3: required list<OrderItem> items,
  4: required common.Address shippingAddress,
  5: optional common.Money totalAmount,
  6: optional common.Status status = common.Status.PENDING,
  7: optional common.Timestamp createdAt,
  // enum-keyed map
  8: optional map<common.Status, common.Timestamp> statusHistory,
  // deeply nested containers
  9: optional list<map<string, list<common.UUID>>> attachments,
  10: optional common.IdList relatedIds
}

// Only one branch can be set at a time.
union PaymentResult {
  1: common.UUID transactionId,
  2: common.BizException failure
}

// Constants: struct literal, enum list, scalar.
const common.Money ZERO_MONEY = {"currency": "USD", "amount": 0.0}
const list<common.Status> ACTIVE_STATUS = [common.Status.PAID, common.Status.SHIPPED]
const i32 MAX_PAGE_SIZE = 100
const string DEFAULT_REGION = "cn-north-1"

service CatalogService {
  Product getProduct(1: common.UUID id) throws (1: common.BizException ex),
  list<Product> searchProducts(1: string keyword, 2: i32 page = 1, 3: i32 size = MAX_PAGE_SIZE),
  oneway void refreshCache()
}

// Inherits every CatalogService method.
service OrderService extends CatalogService {
  common.UUID createOrder(1: Order order) throws (1: common.BizException ex),
  Order getOrder(1: common.UUID id) throws (1: common.BizException ex),
  bool cancelOrder(1: common.UUID orderId, 2: string reason),
  PaymentResult payOrder(1: common.UUID orderId, 2: common.Money amount, 3: bool useWallet = 0),
  map<common.UUID, Order> batchGetOrders(1: common.IdList ids),
  void markStatus(1: common.UUID orderId, 2: common.Status status)
}
