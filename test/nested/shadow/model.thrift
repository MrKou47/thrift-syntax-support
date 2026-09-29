namespace cpp nested.shadow

// Deliberately same name as base/foundation.thrift's Node.
// Alias qualification must keep the two symbols apart.
struct Node {
  1: optional i64 oid,
  2: optional string source
}
