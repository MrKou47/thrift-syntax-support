namespace cpp nested.services.deep

include "../../base/foundation.thrift"
include "../order.thrift"

struct Handler {
  1: required order.Order current,
  2: optional foundation.Node cursor,
  3: optional map<string, foundation.Level> levelMap
}

// Inherits OrderSvc defined one directory level up.
service HandlerSvc extends order.OrderSvc {
  void handle(1: order.Order o, 2: foundation.Level lvl),
  foundation.Fault classify(1: order.Order o)
}
