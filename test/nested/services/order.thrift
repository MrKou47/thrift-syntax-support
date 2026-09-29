namespace cpp nested.services

include "../base/foundation.thrift"
include "../shadow/model.thrift"

struct Order {
  1: required foundation.Node root,
  2: optional model.Node shadow,
  3: optional foundation.Level lvl = foundation.Level.HIGH,
  4: optional list<foundation.Node> history
}

service OrderSvc {
  foundation.Node getNode(1: string id) throws (1: foundation.Fault f),
  oneway void touch()
}
