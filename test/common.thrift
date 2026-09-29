namespace cpp demo.common
namespace java demo.common
namespace py demo.common

// Order lifecycle. Referenced by shop.thrift via `common.Status.XXX`.
enum Status {
  PENDING = 0,
  PAID = 1,
  SHIPPED = 2,
  DELIVERED = 3,
  CANCELLED = 0xff,
  REFUNDED = 5
}

// Scalar aliases reused across services.
typedef string UUID
typedef i64 Timestamp
typedef list<UUID> IdList
typedef map<string, string> StringMap

struct Money {
  1: required string currency (max_length = "3"),
  2: required double amount
}

struct Address {
  1: required string country,
  2: required string city,
  3: optional string detail,
  4: optional string zipCode
}

exception BizException {
  1: required i32 code,
  2: required string message,
  3: optional StringMap details
}

// Self-referencing tree node (recursive struct).
struct Category {
  1: required UUID id,
  2: required string name,
  3: optional list<Category> children,
  4: optional Category parent,
  5: optional Status status = Status.PENDING
}
